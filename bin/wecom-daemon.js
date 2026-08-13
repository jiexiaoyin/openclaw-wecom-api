#!/usr/bin/env node
/**
 * wecom-skill v1.2.0 — 自管 daemon（pure skill 范式）
 *
 * 监听 127.0.0.1:18790，接收企业微信自建应用回调。
 * **不**靠 openclaw framework（v1.2.0 关键决策 — 保持 pure skill 范式）。
 * 复用 sdk/crypto.js + sdk/utils/callback-helper.js + sdk/utils/events-store.js。
 *
 * 90238 协议关键约束：
 * - GET URL 验证：1 秒内返 echostr 解密明文
 * - POST 接收：5 秒内返 200 + async 写库
 *
 * systemd 启动：~/.config/systemd/user/wecom-skill-daemon.service
 * 1Panel 反代：/opt/1panel/www/conf.d/openclaw.juhe.chat.conf location = /plugins/wecom-skill/callback → 18790
 */
'use strict';

const http = require('http');
const path = require('path');

// 7-26 07:16 console→logger 迁移 (per 7-25 P2)
const logger = require('../sdk/utils/logger');
const log = logger('wecom-daemon');

// P3 升级 (2026-07-26): LOG_LEVEL 环境变量控制 (兼容 WECOM_LOG_LEVEL)
// systemd unit 可加: Environment=LOG_LEVEL=info|debug|warn|error
const _LOG_LEVEL = (process.env.LOG_LEVEL || process.env.WECOM_LOG_LEVEL || '').toLowerCase();
if (_LOG_LEVEL && logger.setLevel(_LOG_LEVEL)) {
    log.info(`LOG_LEVEL=${_LOG_LEVEL} (level=${logger.LEVELS[_LOG_LEVEL]})`);
} else {
    log.info(`LOG_LEVEL=default=info (set LOG_LEVEL=debug|warn|error to override)`);
}
const fs = require('fs');
const os = require('os');
const { verifyWecomSignature, decryptWecomEncrypted } = require('../sdk/crypto');
const { parseQueryParams, parseXML, readBodyWithLimit } = require('../sdk/utils/callback-helper');
const { createEventsStore } = require('../sdk/utils/events-store');
// v1.5.2 新增: event router
const { createDefaultRouter } = require('./event-router');

/** expand `~/foo` → `/root/foo`（避免字面 `~` 子目录被创建） */
function expandHome(p) {
  if (!p) return p;
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
}

const CONFIG_PATH = process.env.WECOM_CONFIG
  || path.join(process.env.HOME || '/root', '.openclaw/skills/wecom-skill/config.json');
const MAX_BODY_BYTES = 1024 * 1024;  // 1MB cap（防 OOM / DoS）

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    log.error(`[wecom-daemon] config.json not found: ${CONFIG_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

/** XML 重复元素（DocId/FieldId/RecordId）可能多个 — 序列化为 JSON 字符串存一列 */
function arrayField(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return JSON.stringify(v);
  return v;
}

function createCallbackHandler({ appId, app, store }) {
  const { token, encodingAESKey, path: cbPath } = app.callback;
  const appCorpId = app.corpId;

  return async (req, res) => {
    try {
      // ========== GET: URL 验证（1 秒 deadline）==========
      if (req.method === 'GET') {
        const q = parseQueryParams(req.url);
        if (!verifyWecomSignature({
          token,
          timestamp: q.timestamp,
          nonce: q.nonce,
          encrypt: q.echostr,
          signature: q.msgSignature,
        })) {
          log.warn(`[${appId}] GET signature failed`);
          res.writeHead(401, { 'Content-Type': 'text/plain' });
          res.end('invalid signature');
          return;
        }
        // GET 跳过 receiveId 校验（sunnoy 模式：避免 corpId 错时 500，POST 再校验）
        const msg = decryptWecomEncrypted({
          encodingAESKey, encrypt: q.echostr, receiveId: '',
        });
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(msg);
        log.info(`[${appId}] URL verified (corpId=${appCorpId})`);
        return;
      }

      // ========== POST: 接收消息/事件（5 秒 deadline）==========
      if (req.method === 'POST') {
        // **关键**：必须在 res.end() 之前读完 body 缓存
        // （Node http req 'data' 事件在 res.end() 后 client 关闭时已 emit 完，
        //  setImmediate 里再 readBody 永远等不到 'end'）
        readBodyWithLimit(req, MAX_BODY_BYTES).then(body => {
          // 立即 200（不等解析 — 5 秒硬性要求）
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('success');

          // async 处理（不阻塞 ack；body 已在内存）
          setImmediate(async () => {
            try {
              const q = parseQueryParams(req.url);
              const outer = await parseXML(body);
              const encrypt = outer?.xml?.Encrypt;
              if (!encrypt) {
                // v1.5.2 P0-3 fix: 明文 POST 仍要响 success, 否则企业微信会重试 3 次
                // (生产中企业微信都会加密, 明文多为 debug 或伪造)
                log.warn(`[${appId}] POST no Encrypt field, acked success to avoid retry`);
                return;
              }
              if (!verifyWecomSignature({
                token, timestamp: q.timestamp, nonce: q.nonce,
                encrypt, signature: q.msgSignature,
              })) {
                // 同上: 签名失败也响 success (企业微信合法消息都在签名, 这多半是伪造)
                log.warn(`[${appId}] POST signature failed, acked success`);
                return;
              }
              // POST 校验 corpId（trailing 段）
              const inner = decryptWecomEncrypted({
                encodingAESKey, encrypt, receiveId: appCorpId,
              });
              const innerXml = await parseXML(inner);
              const m = innerXml.xml || {};

            // 只处理 event 类型
            if (m.MsgType !== 'event') return;
            // v1.5.2 修复：v1.2.0 只入库 doc_change / smart_sheet_change，漏了大部分业务事件
            //  现在入库所有 Event 表内 (sys_approval_change / change_external_chat / change_external_user 等)
            //  filtered via event store (不入 raw_xml 限发 bcan analyze).  不入 doc_id 不计入统计

              store.insert({
                appId,
                event: m.Event,
                changeType: m.ChangeType,
                fromUser: m.FromUserName,
                agentId: m.AgentID,
                createTime: parseInt(m.CreateTime, 10) || null,
                docId: arrayField(m.DocId),
                sheetId: m.SheetId || null,
                fieldId: arrayField(m.FieldId),
                recordId: arrayField(m.RecordId),
                formId: arrayField(m.FormId),
                rawXml: inner,
              });
              log.info(`[${appId}] event ${m.Event}/${m.ChangeType || '-'} from=${(m.FromUserName || '?').slice(0, 8)} docId=${(m.DocId || '-').slice(0, 20)}`);
              // v1.5.2 新增：event router 入口钩子 - 未来拆分到独立模块
              if (typeof globalThis.__wecomEventRouter === 'function') {
                try {
                  await globalThis.__wecomEventRouter({
                    appId,
                    Event: m.Event,
                    ChangeType: m.ChangeType,
                    FromUserName: m.FromUserName,
                    CreateTime: m.CreateTime,
                    ApprovalInfo: m.ApprovalInfo,
                    DocId: m.DocId,
                    SheetId: m.SheetId,
                    RecordId: m.RecordId,
                    State: m.State,
                    externalUserId: m.ExternalUserID,
                    welcomeCode: m.WelcomeCode,
                    rawXml: inner,
                  });
                } catch (routerErr) {
                  log.error(`[${appId}] event router error:`, routerErr.message);
                }
              }
            } catch (e) {
              log.error(`[${appId}] POST handler:`, e.message);
            }
          });
        }).catch(e => {
          log.error(`[${appId}] body read error:`, e.message);
          if (!res.headersSent) { res.writeHead(413); res.end('payload too large'); }
        });
        return;
      }

      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('method not allowed');
    } catch (e) {
      log.error(`[${appId}] callback:`, e.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('error');
      }
    }
  };
}

function main() {
  const config = loadConfig();
  // A3 (老板 13:31): placeholder corpSecret 检测 — 与 CLI 同步 (audit 2026-07-15 § P1 第三项)
  // 防止 corpSecret 仍是 __WAITING_FOR_xxx 占位时 daemon 启动后 401 刷屏
  if (config.corpSecret && config.corpSecret.startsWith('__WAITING_FOR')) {
    log.error(`[wecom-daemon] 应用 ${config.agentId || '?'} 的 corpSecret 还未下发，请在 ${CONFIG_PATH} 里填 corpSecret 后重试`);
    process.exit(1);
  }
  const cb = config.callback;
  if (!cb || !cb.token || !cb.encodingAESKey) {
    log.error('[wecom-daemon] config.json 缺 callback.token / callback.encodingAESKey');
    log.error('[wecom-daemon] 跑 wecom-cli setup 配，或手动编辑 config.json 加 callback 段');
    process.exit(1);
  }
  const port = cb.port || 18790;
  // v1.2.0 接受任何 /plugins/ 前缀路径 — daemon 是 nginx mirror 接收方
  // （企业微信只配 1 个回调 URL 给 sunnoy，wecom-skill 通过 mirror 接收 sunnoy path 转发的请求）
  const cbPath = cb.path || '/plugins/';
  const dbPath = expandHome(config.dbPath) || path.join(os.homedir(), '.openclaw/state/wecom-events.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const store = createEventsStore(dbPath);
  // v1.5.2 新增: 挂 event router 钓子 (Event → handler 多对多)
  //  可以独立 disable (globalThis.__wecomEventRouterEnabled = false)
  const eventRouter = createDefaultRouter({
    notifyFile: expandHome(config.notifyFile || '~/.openclaw/state/wecom-approval-pending.json'),
    // v1.5.2 P0-2 重构: 实时推送参数 (可选, 缺走 cron fallback)
    corpId: config.corpId,
    agentId: config.agentId,
    secret: config.corpSecret,
    // v2026-07-17 20:35 refactor (老板 query): 推送名单交给 config 管控
    //   notifyUser 直接写企业微信 native API touser 格式 (| 分隔多人)
    //   代码零业务逻辑, 改谁推谁只改 config.json
    toUser: config.notifyUser,
    // v2026-07-17 20:37 (老板 query): 推送开关交给 config 管控
    //   默认 true, 设置为 false 时 event-router 收到事件只记日志不推
    enabled: config.enableApprovalPush !== false,
  });
  globalThis.__wecomEventRouter = (payload) => eventRouter.route(payload);
  log.info(`[wecom-daemon] event router enabled (real-time push to=${config.notifyUser})`);
  const app = {
    corpId: config.corpId,
    callback: { token: cb.token, encodingAESKey: cb.encodingAESKey, path: cbPath },
  };
  const handler = createCallbackHandler({ appId: 'default', app, store });

  const server = http.createServer((req, res) => {
    // 接受任何 /plugins/ 路径（mirror 转发原 URI）
    if (req.url && req.url.startsWith('/plugins/')) return handler(req, res);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  // 端口冲突立即 exit 1（避免 restart loop 刷屏）
  server.on('error', (err) => {
    log.error('[wecom-daemon] server error:', err.message);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    log.info(`[wecom-daemon] listening on 127.0.0.1:${port} path=${cbPath} db=${dbPath}`);
  });

  const shutdown = (sig) => {
    log.info(`[wecom-daemon] ${sig} received, shutting down`);
    server.close(() => {
      try { store.close(); } catch (e) { /* ignore */ }
      process.exit(0);
    });
    // 强制退出兜底（5s）
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) main();
