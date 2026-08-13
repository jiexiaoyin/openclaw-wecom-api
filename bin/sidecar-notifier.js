#!/usr/bin/env node
/**
 * wecom-skill v1.2.2 — sidecar-notifier
 *
 * 监听 wedoc 事件（add_record / update_record / delete_record）→ 推送 wxid_boss（gewe 通道）
 *
 * 设计要点（v1.2.2 老板 6/6 17:46 拍板）：
 * 1. 5s 一轮（per 16:50 偏好"不要 Cron，用真 daemon"）
 * 2. 顺序处理（按 id ASC，**不**按 record_id 去重，否则可能漏同 record 的多次 update）
 * 3. 单次事件 record_id 是 JSON 数组（XML 重复元素），解析后逐个处理
 * 4. 17:50 偏好"不使用日志验证"——直接 GeWe 推 wxid_boss
 * 5. delete 推送选项 A：record_id + 事件 ID + 时间（per 17:46 老板 17:56 go all 3 + A）
 *
 * 配置：
 * - DB_PATH:    /opt/openclaw/wecomConfig/events.db（daemon 写）
 * - STATE_FILE: /opt/openclaw/wecomConfig/sidecar-state.json
 * - CONFIG:     /opt/openclaw/skills/wecom-skill/config.json（deploy 端）
 * - NOTIFY:     /root/scripts/notify-owner.sh（GeWe 推送，token 隔离）
 *
 * 部署：dev → deploy 同步；systemd --user unit 自启
 */

'use strict';

const { DatabaseSync } = require('node:sqlite');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// 7-26 07:16 console→logger 迁移 (per 7-25 P2)
const logger = require('../sdk/utils/logger');
const log = logger('sidecar-notifier');

const WeComPlugin = require('../sdk');

// v2026-07-26 10:31 fix (老板 query B): 智能表格事件类型 mapping 抽独立 module
const { getSmartSheetEventType } = require('../sdk/utils/smartsheet-event-type');

// ========== 配置 ==========
// ⚠️ DB_PATH 必须跟 daemon config.json 的 dbPath 一致
//   daemon 写：/opt/openclaw/state/wecom-events.db（config.json 默认）
//   sidecar 读：必须同路径
//   v1.2.2 修复：18:24 老板测 add_record 时发现 sidecar 读错路径，0 字节文件读不到 80 条历史
const DB_PATH = '/opt/openclaw/state/wecom-events.db';
const STATE_FILE = '/opt/openclaw/wecomConfig/sidecar-state.json';
const SKILL_ROOT = '/opt/openclaw/skills/wecom-skill';
const CONFIG_PATH = path.join(SKILL_ROOT, 'config.json');
const NOTIFY_SCRIPT = '/root/scripts/notify-owner.sh';
const POLL_MS = 5000;
const LOG_TAG = '[sidecar]';

// ========== State ==========
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { last_id: 0 };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ========== DB ==========
// 每次轮询新开 readonly 句柄 + 及时关（避免跟 daemon writer 锁冲突 — v1.2.2 18:25 修）
function openDb() {
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    return new DatabaseSync(DB_PATH, { readonly: true });
  } catch (e) {
    log.error(`${LOG_TAG} DB open failed: ${e.message}`);
    return null;
  }
}

function getNewEvents(lastId) {
  const db = openDb();
  if (!db) return [];
  try {
    return db.prepare('SELECT * FROM events WHERE id > ? ORDER BY id ASC').all(lastId);
  } finally {
    try { db.close(); } catch {}
  }
}

// 兼容 record_id 是单 string 或 JSON 数组（v1.2.2 18:25 修：daemon arrayField 存单 string 时 JSON.parse 失败）
function parseRecordIds(recordId) {
  if (!recordId) return [];
  if (Array.isArray(recordId)) return recordId;
  const s = String(recordId).trim();
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : [s];
    } catch {
      return [s];
    }
  }
  return [s];
}

// ========== GeWe 推送（隔离 token） ==========
function notifyGeWe(text) {
  return new Promise((resolve, reject) => {
    execFile(NOTIFY_SCRIPT, [text], { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`notify failed: ${err.message} stderr=${stderr}`));
      resolve(stdout);
    });
  });
}

// ========== SDK（拉 records） ==========
let plugin = null;
function getPlugin() {
  if (plugin) return plugin;
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`config.json 不存在: ${CONFIG_PATH}`);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!config.corpId || !config.corpSecret) {
    throw new Error('未配置 corpId/corpSecret');
  }
  plugin = new WeComPlugin(config);
  return plugin;
}

async function fetchRecordValues(docid, sheetId, recordIds) {
  if (!recordIds || recordIds.length === 0) return [];
  const p = getPlugin();
  const targetSet = new Set(recordIds);
  const found = new Map();
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;
  let safety = 0;
  let lastErr = null;

  // 翻页拉全表（v1.2.2 之前写死 limit:1000，sheet>1000 行后新加的 rid 永远在 1000 之外 → 一直 (未找到)）
  // v1.2.3 修：老板 09:10 发现 zThwkU (1740+ 之外的 rid) 永远 (未找到) 根因
  while (hasMore && safety < 20) {
    try {
      const r = await p.document.getRecords({ docid, sheetId, offset, limit: pageSize });
      const records = r.records || [];
      for (const rec of records) {
        if (targetSet.has(rec.record_id)) {
          found.set(rec.record_id, rec.values);
        }
      }
      hasMore = !!r.has_more;
      offset += pageSize;
      safety++;
      if (found.size === targetSet.size) break;  // 全部找到，提前收
      if (hasMore) {
        await new Promise(r => setTimeout(r, 200));  // 限速，避免撞 rate limit
      }
    } catch (e) {
      lastErr = e.message;
      log.error(`${LOG_TAG} fetch page offset=${offset} failed: ${e.message}`);
      break;  // 出错就停，别死循环
    }
  }

  return recordIds.map(rid => ({
    record_id: rid,
    values: found.has(rid) ? found.get(rid) : null,
    error: lastErr && !found.has(rid) ? lastErr : undefined,
  }));
}

// ========== 推送格式 ==========
// v1.2.5 修：老板 09:17 反馈推送格式太难受。原 toISOString() 是 UTC，需转 Beijing
function fmtTimestamp(unixSec) {
  if (!unixSec) return '-';
  return new Date(unixSec * 1000).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

// 13 位毫秒时间戳字符串（WeCom date/datetime 字段原样存）
function fmtUnixMs(msStr) {
  const ms = parseInt(msStr, 10);
  if (isNaN(ms)) return String(msStr);
  return new Date(ms).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

// 拆 cell value 原始 WeCom 结构 → 人话
// 输入示例：
//   "1780794897968"            → "2026-06-07 17:14:57"
//   [{"text":"胡建清","type":"text"}] → "胡建清"
//   5000                        → "5000"
//   null / undefined / ""      → "-"
function fmtCellValue(v) {
  if (v === null || v === undefined || v === '') return '-';
  if (Array.isArray(v)) {
    return v.map(x => {
      if (x && typeof x === 'object') return x.text ?? JSON.stringify(x);
      return String(x);
    }).join(', ');
  }
  if (typeof v === 'string' && /^\d{13}$/.test(v)) return fmtUnixMs(v);
  if (typeof v === 'number') return String(v);
  return String(v);
}

// v2026-07-26 10:31 fix (SOP-7): fmtChangeType 抽到 sdk/utils/smartsheet-event-type
// 已替换: 2 处 `const t = fmtChangeType(...)` → `getSmartSheetEventType(...)`

// ========== v1.2.7 支出报备模板映射（老板 09:24 定 + 09:41 补） ==========
// 字段按 模板分组顺序 排列；空字符串不显示，仅做分组
const FIELD_GROUPS = [
  ['明细', '申请金额', '实际打款日期'],   // group 1：事由+金额+打款日期
  ['开户行', '收款人', '收款账户'],         // group 2：收款人块
  ['转出账户'],                              // group 3：转出块
];
// 原始字段名 → 模板显示名
const FIELD_LABELS = {
  '明细': '申请事由',
  '实际打款日期': '打款日期',
};
// WeCom 字段 ID → 原始 display_name（仅记录元信息，逻辑不依赖；保留以防 schema 变动）
// v1.2.7 09:41 老板提供：明细 field_id = fOUNKy
const FIELD_ID_METADATA = {
  'fOUNKy': '明细',
};
// 货币字段：原值是数字 / 数字文本，前加 ¥（含千位分隔）
// v1.2.6 偏好（09:20）：申请金额 和 明细 前加 ¥
const CURRENCY_FIELDS = new Set(['申请金额', '明细']);

function fmtRecordField(origName, value) {
  const label = FIELD_LABELS[origName] || origName;
  let display = fmtCellValue(value);
  if (CURRENCY_FIELDS.has(origName) && display !== '-') {
    // v1.2.7 修：只在 display 本身是纯数字（含千位分隔）时才加 ¥
    // 防止“物料-26高考”这类文本被误判成 -26
    if (/^-?[\d,]+(\.\d+)?$/.test(display)) {
      const num = parseFloat(display.replace(/,/g, ''));
      if (!isNaN(num)) display = '¥' + num.toLocaleString('zh-CN');
    }
  }
  return `  ${label}: ${display}`;
}

function formatRecordValues(values) {
  const blocks = [];
  for (const group of FIELD_GROUPS) {
    const lines = [];
    for (const origName of group) {
      if (values[origName] !== undefined) {
        lines.push(fmtRecordField(origName, values[origName]));
      }
    }
    if (lines.length) blocks.push(lines.join('\n'));
  }
  // 模板外的额外字段（保留以免丢信息）
  const extras = [];
  for (const [k, v] of Object.entries(values)) {
    if (!FIELD_GROUPS.some(g => g.includes(k))) {
      extras.push(`  ${k}: ${fmtCellValue(v)}`);
    }
  }
  if (extras.length) blocks.push(extras.join('\n'));
  return blocks.join('\n\n');
}

async function formatAddUpdate(evt, recordIds) {
  const t = getSmartSheetEventType(evt.change_type);
  let text = `${t}\n`;
  text += `事件 ID: ${evt.id}\n`;
  text += `操作人: ${evt.from_user || 'unknown'}\n`;
  text += `企微时间: ${fmtTimestamp(evt.create_time || evt.received_at)}\n`;
  text += `sidecar 时间: ${fmtTimestamp(evt.received_at)}\n`;
  text += `docid: ${evt.doc_id}\n`;
  text += `sheet_id: ${evt.sheet_id || '-'}\n`;
  text += `record 数: ${recordIds.length}\n`;

  if (recordIds.length > 0 && recordIds.length <= 5) {
    // 5 条以内拉 values 展示（避免单次推文过长）
    try {
      const values = await fetchRecordValues(evt.doc_id, evt.sheet_id, recordIds);
      text += '\n支出报备\n\n';
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (i > 0) text += '\n';
        if (v.error) {
          text += `⚠️ ${v.error}\n`;
        } else if (v.values === null) {
          text += `(未找到)\n`;
        } else {
          text += `${formatRecordValues(v.values)}\n`;
        }
      }
    } catch (e) {
      text += `\n(values 拉取失败: ${e.message})\n`;
    }
  } else if (recordIds.length > 5) {
    text += `\n(超过 5 条，仅展示 ID 列表；查值: node bin/wecom-cli.js document get_records --args '{...}')\n`;
    for (const rid of recordIds.slice(0, 10)) text += `  - ${rid}\n`;
    if (recordIds.length > 10) text += `  ... +${recordIds.length - 10} more\n`;
  }

  return text;
}

function formatDelete(evt, recordIds) {
  // 选项 A: record_id + 事件 ID + 时间（per 17:56 老板 go all 3 + A）
  const t = getSmartSheetEventType(evt.change_type);
  let text = `${t}\n`;
  text += `事件 ID: ${evt.id}\n`;
  text += `操作人: ${evt.from_user || 'unknown'}\n`;
  text += `企微时间: ${fmtTimestamp(evt.create_time || evt.received_at)}\n`;
  text += `sidecar 时间: ${fmtTimestamp(evt.received_at)}\n`;
  text += `docid: ${evt.doc_id}\n`;
  text += `sheet_id: ${evt.sheet_id || '-'}\n`;
  text += `record 数: ${recordIds.length}\n`;
  if (recordIds.length > 0) {
    text += 'record_ids:\n';
    for (const rid of recordIds.slice(0, 20)) text += `  - ${rid}\n`;
    if (recordIds.length > 20) text += `  ... +${recordIds.length - 20} more\n`;
  }
  return text;
}

// ========== Main ==========
let lastId = 0;

async function main() {
  const state = loadState();
  lastId = state.last_id || 0;
  log.info(`${LOG_TAG} start, last_id=${lastId}, poll=${POLL_MS}ms`);

  setInterval(async () => {
    if (!fs.existsSync(DB_PATH)) {
      // DB 还没生成（daemon 没收到 callback）
      return;
    }
    const events = getNewEvents(lastId);
    if (events.length === 0) return;

    log.info(`${LOG_TAG} processing ${events.length} events (last_id=${lastId} → ${events[events.length - 1].id})`);

    for (const evt of events) {
      let text = null;
      try {
        const recordIds = parseRecordIds(evt.record_id);
        if (evt.change_type === 'add_record') {
          text = await formatAddUpdate(evt, recordIds);
        } else if (evt.change_type === 'update_record' || evt.change_type === 'delete_record') {
          // v1.2.4 改：老板 09:13 决定删除和修改不再发通知，仅保留 add_record 通知
          log.info(`${LOG_TAG} evt ${evt.id} ${evt.change_type} → skip (v1.2.4 policy: only add_record notifies)`);
          lastId = evt.id;
          saveState({ last_id: lastId });
          continue;
        } else {
          log.warn(`${LOG_TAG} evt ${evt.id} unknown change_type: ${evt.change_type}, skip`);
          lastId = evt.id;
          saveState({ last_id: lastId });
          continue;
        }

        await notifyGeWe(text);
        lastId = evt.id;
        saveState({ last_id: lastId });
        log.info(`${LOG_TAG} evt ${evt.id} ${evt.change_type} → wxid_boss OK (recordIds=${recordIds.length})`);
      } catch (e) {
        log.error(`${LOG_TAG} evt ${evt.id} failed: ${e.message}`);
        // 不更新 last_id，下轮重试
        break;
      }
    }
  }, POLL_MS);
}

main().catch(err => {
  log.error(`${LOG_TAG} fatal: ${err.message}`);
  process.exit(1);
});
