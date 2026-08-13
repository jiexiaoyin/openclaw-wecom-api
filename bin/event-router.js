/**
 * wecom-skill Event Router v1.5.2
 *
 * 监听事件表 → 按 Event/ChangeType 分发到对应动作
 * 当前仅 P0:
 *   - 通讯录变更 (change_external_chat / change_type=create_user) → flushCache
 *   - 审批状态变化 (sys_approval_change / sys_approval_revoke) → 老板推送
 *
 * 接入：daemon.js 通过 globalThis.__wecomEventRouter 调本模块
 * 架构：v1.5.2 只需异步触发 (不要阻塞 daemon 入库逻辑)
 */

const path = require('path');

// R1 (2026-07-17 03:45 redundancy audit): Wecom 单例 + logger 复用
const Wecom = require('../sdk');
const config = require('../config.json');
const wSingleton = new Wecom(config);

// R7 (2026-07-26): 全部 console.* 迁移到 logger (per 7-25 P2)
const logger = require('../sdk/utils/logger');
const log = logger('event-router');

// P-A3 (2026-07-17 03:56 audit): 设计决策 — 不显式调用 phoneerp lookup_employee.js
//   原因: SDK addressbook.getUser() 已权威 API 验证 (errcode=0 + name 命中即为真 userid)
//         如再调 phoneerp lookup 会重复 I/O + 增加延迟
//         若后续需要查 SSOT 状态机 (pending/disabled) → 在 daemon 启动期 preload SSOT 一次即可
//   风险: 见 audit 报告 (LOW — API 失败时 SDK 内已有 fallback)

// v1.5.2 P0：企业微信通讯录变更
// 官方推送格式: Event='change_type', ChangeType in [create_user|update_user|delete_user]
// handler 内部判断 ChangeType
const ADDRESS_BOOK_CHANGE_TYPES = new Set([
  'create_user',
  'update_user',
  'delete_user',
]);

// 审批推送名单
const APPROVAL_EVENTS = new Set([
  'sys_approval_change',
  'sys_approval_revoke',
]);

class EventRouter {
  constructor(opts = {}) {
    this.handlerTimeout = opts.handlerTimeout || 5000; // 每事件 5s 上限
    this.handlers = new Map(); // eventName -> [fn]
    this.stats = { dispatched: 0, errors: 0, skipped: 0 };
    this.enabled = true;
  }

  on(eventName, fn) {
    if (!this.handlers.has(eventName)) this.handlers.set(eventName, []);
    this.handlers.get(eventName).push(fn);
  }

  /**
   * 路由入口：daemon 调此
   * @param {object} payload 事件 payload (见 daemon.js 注入)
   */
  async route(payload) {
    if (!this.enabled) {
      this.stats.skipped++;
      return;
    }
    const handlers = this.handlers.get(payload.Event) || [];

    if (handlers.length === 0) {
      this.stats.skipped++;
      return;
    }

    // 异步触发，不阻塞 daemon
    for (const fn of handlers) {
      Promise.race([
        Promise.resolve().then(() => fn(payload)).catch(err => {
          this.stats.errors++;
          log.error(`[event-router] handler error (${payload.Event}):`, err.message);
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('handler timeout')), this.handlerTimeout)),
      ]).catch(err => {
        this.stats.errors++;
        log.error(`[event-router] ${payload.Event}:`, err.message);
      });
    }
    this.stats.dispatched += handlers.length;
  }

  getStats() {
    return this.stats;
  }
}

// ========== 默认 handler 集合 (P0) ==========

/**
 * handler: 通讯录变更 → flush cache
 * daemon 收到 change_external_chat 后触发
 */
function addressbookCacheFlush() {
  return async (payload) => {
    // Event='change_type' + ChangeType ∈ [create_user|update_user|delete_user]
    if (payload.Event !== 'change_type') return;
    if (!ADDRESS_BOOK_CHANGE_TYPES.has(payload.ChangeType)) return;
    try {
      const w = wSingleton;
      if (typeof w.addressbook.flushCache === 'function') {
        const r = w.addressbook.flushCache();
        log.info(`[event-router] flushCache OK (${payload.ChangeType} from=${(payload.FromUserName || '').slice(0, 8)}) ${r.before ? JSON.stringify(r.before) : ''}`);
        return r;
      }
      log.warn(`[event-router] flushCache method not found`);
    } catch (e) {
      log.warn('[event-router] flushCache skipped', e);
    }
  };
}

/**
 * v1.5.2-fix: 解析 Applyer.UserId → "中文名 (userid) / 部门名" (SUPERSEDED by v2026-07-17 03:39 fix, 仅历史保留)
 * 用 addressbook 模块缓存 API, 失败时降级到 userid
 * v2026-07-17 03:39 fix (老板 query): 删除 32hex MD5 pattern 启发式,
 *   改为 依赖 addressbook.getUser() API (老板指出"API 是权威,不要凭 pattern")
 *   如果 API 返回 errcode=0 + name 命中, 即使用户 id 看上去像 MD5 也认为是真 userid
 *   (例: 罗琴 d41d8cd98f00b204e9800998ecf8427e 就是真 userid,验证后通过)
 */
async function resolveApplyUser(w, approval, fallbackFromUser) {
  const userId = approval?.Applyer?.UserId || approval?.ApplyUserName;
  if (!userId) return fallbackFromUser || '?';

  let name = userId;
  let dept = '';
  let apiOk = false;

  if (w?.addressbook) {
    try {
      const userResp = await w.addressbook.getUser(userId);
      if (userResp?.errcode === 0 && userResp.name) {
        name = userResp.name;
        apiOk = true;
      } else if (userResp?.errcode !== 0) {
        // API 验证失败: 用户id 是真的但取不到信息, 不当作 MD5 误判 (丟出去人能看出)
        log.warn(`[event-router] getUser(${userId.slice(0,12)}...) failed: errcode=${userResp?.errcode} ${userResp?.errmsg}`);
      }

      const partyId = Number(approval?.Applyer?.Party);
      if (Number.isFinite(partyId) && partyId > 0) {
        const deptResp = await w.addressbook.getDepartmentDetail(partyId);
        if (deptResp?.errcode === 0 && deptResp.name) dept = deptResp.name;
      }
    } catch (e) {
      // API 调用本身失败 (网络/认证), 退到 fallbackFromUser (原 sendUserName / 'sys')
      log.warn(`[event-router] getUser API exception: ${e.message}; fallback to ${fallbackFromUser}`);
      return fallbackFromUser || '?';
    }
  }

  // v2026-07-17 19:21 fix (老板 preference): 通知里不显示括号里的 userid, 只显示姓名
  return dept ? `${name} / ${dept}` : `${name}`;
}

/**
 * v2026-07-26 08:34 fix (老板 query 完整实现): 调试快照
 *
 * 背景: getApprovalDetail 失败 (网络/SDK/字段缺失) 时仅记 log 难以排查
 *   现实现: 写文件 /opt/openclaw/state/wecom-approval-debug/<sp_no>-<ts>.json
 *
 * 保留机制: 最多 20 个文件, FFO, 防止磁盘未控增长
 */
function writeDebugSnapshot(spNo, payload) {
  try {
    const fs = require('fs');
    const dir = '/opt/openclaw/state/wecom-approval-debug';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = `${dir}/${spNo}-${Date.now()}-${process.hrtime.bigint()}.json`;
    fs.writeFileSync(file, JSON.stringify({
      spNo,
      timestamp: new Date().toISOString(),
      payload,
    }, null, 2));

    // FFO 保留最新 20 个
    const files = fs.readdirSync(dir).filter(f => f.startsWith(`${spNo}-`)).sort();
    while (files.length > 20) {
      fs.unlinkSync(`${dir}/${files.shift()}`);
    }
    log.warn(`[event-router] 调试快照已写入 ${file}`);
  } catch (e) {
    log.error(`[event-router] 调试快照写失败: ${e.message}`);
  }
}

/**
 * v2026-07-26 08:23 fix (老板 query): 解析审批单的字段填写内容
 *
 * 背景: 老板反馈当前通知只显示模板名+申请人+审批节点, 看不到具体填写内容
 *   (退款金额 / 支付宝账号 / 收款人全称 等关键决策信息缺失)
 *
 * 实现: 拉 SDK approval.getApprovalDetail(sp_no) 拿 apply_data.contents[]
 *   解析成 {key: '退款金额', value: '¥XXX.XX'} 数组, 拼到通知里
 *
 * 返回结构:
 *   [{ key: '退款类型', value: '移动5G金币' }, { key: '退款金额', value: '¥XXX' }, ...]
 *
 * 边界 case:
 *   - hidden=1 字段默认隐藏
 *   - 空值字段 (value.text === '' / value.new_number === '' / []) 默认跳过
 *   - control === 'Table' 复杂控件(列表子单) 暂只显示 "[列表 N 项]"
 *   - 多语言 title 优先取 zh_CN, fallback en
 *   - value 截断到 80 字符 (避免通知超长)
 *
 * 依赖: SDK approval.getApprovalDetail() (v1.5.1+ 已有)
 */
async function buildApprovalDetail(w, spNo, opts = {}) {
  const MAX_FIELD_VALUE = opts.maxFieldValue || 80;  // 单字段值最大长度
  const MAX_FIELDS = opts.maxFields || 30;            // 通知最多显示字段数
  const out = { fields: [], truncated: false };

  if (!w?.approval?.getApprovalDetail) {
    log.warn('[event-router] SDK approval.getApprovalDetail 不可用, 跳过详情');
    return out;
  }

  let resp;
  try {
    resp = await w.approval.getApprovalDetail(spNo);
  } catch (e) {
    log.warn(`[event-router] getApprovalDetail(${spNo}) 异常: ${e.message}`);
    // v2026-07-26 08:34 fix (老板 query 完整实现): 调试快照 — 保存异常上下文便于排查
    writeDebugSnapshot(spNo, { error: e.message, stack: e.stack });
    return out;
  }

  const info = resp?.info;
  if (!info) {
    log.warn(`[event-router] getApprovalDetail(${spNo}) 无 info 字段`);
    // v2026-07-26 08:34 fix: 调试快照 — 保存响应以便排查
    writeDebugSnapshot(spNo, { error: 'no info field', respKeys: Object.keys(resp || {}) });
    return out;
  }

  const contents = info?.apply_data?.contents || [];
  if (!Array.isArray(contents) || contents.length === 0) {
    return out;
  }

  // v2026-07-26 08:34 fix (老板 query 完整实现): 必填字段 (require: 1) 优先排序
  // 逻辑: require=1 在前, 其他按原顺序, hidden=1 跳过
  const sortedContents = contents
    .map((c, idx) => ({ c, idx, required: c.require === 1 ? 0 : 1, hidden: c.hidden === 1 ? 1 : 0 }))
    .sort((a, b) => {
      if (a.hidden !== b.hidden) return a.hidden - b.hidden;  // hidden 在后
      if (a.required !== b.required) return a.required - b.required;  // 必填在前
      return a.idx - b.idx;  // 同优先级保持原顺序
    })
    .map(x => x.c);

  for (const c of sortedContents) {
    if (out.fields.length >= MAX_FIELDS) {
      out.truncated = true;
      break;
    }

    // v2026-07-27 19:38 fix (老板 query sp_no=202607270003): Table 多 cell 行不参与外层 80 字截断
    // 原因: 5 cell 拼接 102 字符被截断到 80 + '…', 砍掉姓名尾 + 报销凭证 cell
    // 标记后, 步骤 5 直接放行; 单字段控件保持原行为
    let multiCell = false;

    // 1. 跳过隐藏字段
    if (c.hidden === 1) continue;

    // 2. 提取字段名 (优先 zh_CN, fallback en, fallback id)
    const titleArr = Array.isArray(c.title) ? c.title : [];
    let title = '';
    for (const t of titleArr) {
      if (t?.lang === 'zh_CN') { title = t.text; break; }
    }
    if (!title) {
      for (const t of titleArr) {
        if (t?.lang === 'en') { title = t.text; break; }
      }
    }
    if (!title) title = c.id || '未命名字段';
    title = String(title).trim();

    // 3. 提取字段值 (按 control 类型分发)
    const v = c.value || {};
    let value = '';
    switch (c.control) {
      case 'Text':
      case 'Textarea':
        value = v.text || '';
        break;
      case 'Number':
        value = v.new_number || '';
        break;
      case 'Money':
        // v2026-07-26 09:51 fix (老板 query): Money control value 字段是 new_money (不是 new_number)
        // 报错来源: 202607260001 退款金额字段 value.new_money="1500" 被误读成 new_number (空) → 金额字段被过滤
        const moneyVal = v.new_money ?? v.new_number ?? '';
        value = moneyVal ? `¥${moneyVal}` : '';
        break;
      case 'Date':
      case 'DateTime':
        value = v.date || v.date_time || v.new_number || '';
        break;
      case 'Selector':
        // 多选/单选 selector.options[].value[].text
        const opts2 = v.selector?.options || [];
        const labels = [];
        for (const o of opts2) {
          if (Array.isArray(o.value)) {
            for (const vv of o.value) {
              if (vv?.text) labels.push(vv.text);
            }
          }
        }
        value = labels.length > 0 ? labels.join(', ') : '';
        break;
      case 'Contact':
        // v.members[].name 或 userid
        const mems = v.members || [];
        const memNames = mems.map(m => m.name || m.userid).filter(Boolean);
        value = memNames.length > 0 ? memNames.join(', ') : '';
        break;
      case 'Table':
        // v2026-07-27 10:54 fix (老板 query): 展开明细 cell 内容 (per 7-16 18:08 [Fact])
        // 之前只显示 "[明细表 N 项]" 不显示 cell 实际值, 老板看不到金额/说明等
        const rows = v.children || v.stat_field || [];
        if (!Array.isArray(rows) || rows.length === 0) {
          value = '';
          break;
        }
        const tableLines = [];
        for (let ri = 0; ri < rows.length; ri++) {
          const list = rows[ri].list || [];
          if (list.length === 0) continue;
          const cellParts = [];
          for (const cell of list) {
            const cTitle = (Array.isArray(cell.title) ? cell.title[0]?.text : cell.title) || '';
            const cv = cell.value || {};
            let cellVal = '';
            // 复用 control-render 简化版
            if (cv.text) cellVal = cv.text;
            else if (cv.new_money) cellVal = `¥${cv.new_money}`;
            else if (cv.new_number) cellVal = cv.new_number;
            else if (cv.date?.s_timestamp) cellVal = new Date(Number(cv.date.s_timestamp) * 1000).toISOString().substring(0, 10);
            else if (Array.isArray(cv.files) && cv.files.length > 0) cellVal = `[附件 ${cv.files.length} 个]`;
            if (cellVal && cTitle) cellParts.push(`${cTitle}: ${cellVal}`);
            else if (cellVal) cellParts.push(cellVal);
          }
          if (cellParts.length > 0) tableLines.push(`  [明细 ${ri + 1}] ${cellParts.join(' | ')}`);
        }
        value = tableLines.join('\n');
        // v2026-07-27 19:38 fix: Table 行是多 cell, 内部已控长, 外层 80 字截断跳过
        multiCell = true;
        break;
      case 'File':
      case 'Files':
        const files = v.files || [];
        value = files.length > 0 ? `[附件 ${files.length} 个]` : '';
        break;
      default:
        // 未知控件 - 尝试 text/new_number/selector
        value = v.text || v.new_number || '';
        if (!value && v.selector?.options?.length > 0) {
          const opts3 = v.selector.options[0].value || [];
          value = opts3[0]?.text || '';
        }
    }

    value = String(value).trim();

    // 4. 跳过空值
    if (!value || value === '') continue;

    // 5. 截断过长值 (Table 多 cell 行跳过, 已在内部控长)
    if (!multiCell && value.length > MAX_FIELD_VALUE) {
      value = value.slice(0, MAX_FIELD_VALUE) + '…';
    }

    out.fields.push({ key: title, value });
  }

  return out;
}

/**
 * v2026-07-17 19:35 fix (老板 query): 在通知里展示节点级审批进度
 * 解析 approval.SpRecord (数组, 每条 = 一次审批动作) + approval.ProcessList/NodeList (抄送)
 * 返回:
 *   {
 *     approvers: [{ status: 1|2, names: '朱云', speech: 'ok' }, ...],
 *     cc: ['用户A', ...]
 *   }
 * status: 1 = 等待审批, 2 = 已审批
 * 依赖: SDK addressbook.getUser() (R5 已有) 解析 userid → 中文名
 */
async function buildApprovalProgress(w, approval) {
  const out = { approvers: [], cc: [] };
  if (!approval) return out;

  // 1) 主审批链路 (SpRecord)
  const records = approval.SpRecord || approval.sp_record || [];
  for (const rec of (Array.isArray(records) ? records : [records])) {
    const spStatus = Number(rec?.SpStatus ?? rec?.sp_status ?? 0); // 1=审批中, 2=已通过
    // v2026-07-26 08:24 fix: SDK getApprovalDetail 返回 approverattr (小写), 回调用 ApproverAttr (驼峰)
    const approverAttr = Number(rec?.ApproverAttr ?? rec?.approverattr ?? 0); // 1=审批人, 2=抄送人
    if (approverAttr !== 1) continue; // 跳过抄送节点, 后面单独解析

    // 一条 SpRecord 可能多人 (or 关系, 任意一个通过即可)
    // v2026-07-26 08:24 fix: SDK getApprovalDetail 返回 details (小写) + approver.userid (小写),
    //                                  回调用 Details (驼峰) + Approver.UserId (驼峰)
    const details = rec?.Details ?? rec?.details;
    const detailArr = Array.isArray(details) ? details : (details ? [details] : []);
    const names = [];
    const speeches = [];
    for (const det of detailArr) {
      const userId = det?.Approver?.UserId ?? det?.approver?.userid;
      if (!userId) continue;
      let name = userId;
      if (w?.addressbook?.getUser) {
        try {
          const r = await w.addressbook.getUser(userId);
          if (r?.errcode === 0 && r.name) name = r.name;
        } catch (e) { /* fallback to userid */ }
      }
      names.push(name);
      const speech = det?.Speech ?? det?.speech;
      if (speech && String(speech).trim()) speeches.push(String(speech).trim());
    }
    if (names.length === 0) continue;
    out.approvers.push({
      status: spStatus === 2 ? 2 : 1,
      names: names.length === 1 ? names[0] : names.join(' / '),
      speech: speeches.join(' | '),
    });
  }

  // 2) 抄送节点 (NodeList Type=2)
  // v2026-07-26 08:24 fix: SDK 返回 process_list.node_list (snake), 回调用 ProcessList.NodeList (驼峰)
  const processList = approval.ProcessList?.NodeList
    || approval.ProcessList?.node_list
    || approval.process_list?.NodeList
    || approval.process_list?.node_list
    || [];
  const processArr = Array.isArray(processList) ? processList : [processList];
  for (const node of processArr) {
    // v2026-07-26 08:24 fix: SDK 返回 node_type (小写), 回调用 NodeType (驼峰)
    if (Number(node?.NodeType ?? node?.node_type) !== 2) continue;
    const subList = node?.SubNodeList ?? node?.sub_node_list;
    const subs = Array.isArray(subList) ? subList : (subList ? [subList] : []);
    for (const sub of subs) {
      // v2026-07-26 08:24 fix: SDK 返回 userid (小写), 回调用 UserInfo.UserId (驼峰)
      const userId = sub?.UserInfo?.UserId ?? sub?.userid;
      if (!userId) continue;
      let name = userId;
      if (w?.addressbook?.getUser) {
        try {
          const r = await w.addressbook.getUser(userId);
          if (r?.errcode === 0 && r.name) name = r.name;
        } catch (e) { /* fallback */ }
      }
      out.cc.push(name);
    }
  }

  return out;
}

/**
 * handler: 审批状态变化 → 写本地通知文件 (后续由 OpenClaw cron 拉走推到老板微信/webchat)
 *
 * 设计：daemon 不直接调 OpenClaw message 工具（跨进程）
 *     写文件 /opt/openclaw/state/wecom-approval-pending.json
 *     OpenClaw agent 通过 heartbeat / cron 读取后发出
 *
 * v1.5.2 P0-2 实施：写文件即可，业务推送留给 cron/heartbeat 集成
 */
function approvalNotify({ corpId, agentId, secret, toUser, enabled = true, fallbackNotifyFile = '/opt/openclaw/state/wecom-approval-pending.json' } = {}) {
  return async (payload) => {
    if (!APPROVAL_EVENTS.has(payload.Event)) return;
    if (!enabled) {
      log.info(`[event-router] approval push disabled by config (event=${payload.Event})`);
      return;
    }

    const event = payload.Event;
    const ct = payload.ChangeType || '';
    const approval = payload.ApprovalInfo || payload.State || null;
    const sp_no = approval?.SpNo || '?';
    const sp_name = approval?.SpName || approval?.template_name || '未命名审批';
    const sp_status = Number(approval?.SpStatus || 0);
    // v2026-07-26 14:08 fix (老板 query B): 识别 StatuChangeEvent 区分动作类型
    //   1=申请 / 2=同意 / 3=驳回 / 4=转审 / 5=催办
    //   之前不区分 → 催办同事件被推 2 次 (StatuChangeEvent=1 + 5)
    //   现在: StatuChangeEvent=5 (催办) 用 ⏰ 图标 + '催办' 文案
    const statu_change_event = String(approval?.StatuChangeEvent || '');
    const isReminder = statu_change_event === '5';

    // v1.5.2-fix: SDK 实例前置 (SUPERSEDED by v2026-07-17 R1, 改为 wSingleton 模块单例)
    let w = null;
    try {
      w = wSingleton;
    } catch (e) {
      log.warn('[event-router] SDK init failed', e);
    }

    // v1.5.2-fix: 申请人优先取 ApprovalInfo.Applyer.UserId (SUPERSEDED by v2026-07-17 R5, 用 API getUser 验证)
    const apply_user = await resolveApplyUser(w, approval, payload.FromUserName);

    // v2026-07-26 10:22 fix (老板 query): 补 sp_status 全集 (企微官方: 1=审批中 / 2=已通过 / 3=已驳回 / 4=已撤销 / 6=通过后撤销 / 7=已删除 / 10=已支付)
    // 之前缺 6/7/10 导致 fallback 显示原始数字 ("状态: 6")
    // v2026-07-26 10:23 fix (老板 query "状态:6" bug): statusMap 移到独立 sdk/utils/sp-status.js
    //   (SOP-7: 枚举映射必须 100% 覆盖 SDK 文档所有值 + safe fallback)
    const { getSpStatusText } = require('../sdk/utils/sp-status');

    // v2026-07-17 19:35 fix (老板 query): 区分动作类型 NEW / PROGRESS / RESULT / REVOKE
    //   NEW      = SpStatus=1 且所有节点 status=1 → 刚发起
    //   PROGRESS = SpStatus=1 但部分节点已审 (status=2) → 流转中
    //   RESULT   = SpStatus=2/3 (终态) → 通过或驳回
    //   REVOKE   = sys_approval_revoke 事件
    const progress = await buildApprovalProgress(w, approval);
    const hasAnyApproved = progress.approvers.some(a => a.status === 2);
    const isFinal = sp_status === 2 || sp_status === 3;
    const isRevoke = event === 'sys_approval_revoke';
    let actionText;
    if (isReminder) actionText = '催办';  // v2026-07-26 14:08 老板 query B: 催办优先于其他
    else if (isRevoke) actionText = '撤销';
    else if (isFinal) actionText = '结果';
    else if (hasAnyApproved) actionText = '进度更新';
    else actionText = '新增';

    // v2026-07-26 08:23 fix (老板 query): 拉审批单详情 (退款金额/收款人/账号 等)
    const detail = await buildApprovalDetail(w, sp_no);

    // v2026-07-26 10:28 fix (老板 query B): 节点 status fallback 抽到独立 module (SOP-7)
    //   之前: spStatus === 2 ? '✅' : '🕐' (仅 1/2, 3/4 fallback 错误显示 '等待审批')
    //   现在: getNodeStatusInfo() 覆盖 1/2/3/4 + 未知值用 '❓'
    const { getNodeStatusInfo } = require('../sdk/utils/sp-record-status');
    // 格式化审批进度
    const lines = [];
    for (const a of progress.approvers) {
      const info = getNodeStatusInfo(a.status);
      const tail = a.status === 2 ? (a.speech ? ` (已审批: ${a.speech})` : ` (${info.label})`) : ` (${info.label})`;
      lines.push(`${info.text} ${a.names}${tail}`);
    }
    const progressBlock = lines.length > 0 ? `\n审批进度:\n${lines.join('\n')}` : '';
    const ccBlock = progress.cc.length > 0 ? `\n\n👀 抄送: ${progress.cc.join(', ')}` : '';

    // v2026-07-26 08:23 fix (老板 query): 字段详情块 (退款金额/收款人/账号/事由 等)
    const detailLines = [];
    for (const f of detail.fields) {
      detailLines.push(`  ${f.key}: ${f.value}`);
    }
    let detailBlock = '';
    if (detailLines.length > 0) {
      detailBlock = `\n📝 申请内容:\n${detailLines.join('\n')}`;
      if (detail.truncated) detailBlock += '\n  … (字段数超过上限, 部分未显示)';
    }

    let text = `${isReminder ? '⏰' : '📋'} 企业微信审批${actionText}${isReminder ? ' (申请人催办)' : ''}

模板/名称: ${sp_name}
单号: ${sp_no}
申请人: ${apply_user}
状态: ${getSpStatusText(sp_status)}${detailBlock}${progressBlock}${ccBlock}

🕐 ${new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })}`;

    // v2026-07-26 08:23 fix (老板 query): 企微文本硬限制 2048B, 超长截断
    // 策略: 保留头部 (模板/单号/申请人/状态) + 详情块 (按字段优先级逐行加) + 尾部 (进度/抄送/时间戳)
    const MAX_TEXT_BYTES = 2000;  // 留 48B 余量
    if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) {
      const head = `${isReminder ? '⏰' : '📋'} 企业微信审批${actionText}${isReminder ? ' (申请人催办)' : ''}\n\n模板/名称: ${sp_name}\n单号: ${sp_no}\n申请人: ${apply_user}\n状态: ${getSpStatusText(sp_status)}`;
      const tail = `${progressBlock}${ccBlock}\n\n🕐 ${new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })}`;
      const headBytes = Buffer.byteLength(head, 'utf8');
      const tailBytes = Buffer.byteLength(tail, 'utf8');
      const middleMax = MAX_TEXT_BYTES - headBytes - tailBytes - 30;
      const kept = [];
      for (const f of detail.fields) {
        const line = `  ${f.key}: ${f.value}`;
        const sep = kept.length > 0 ? '\n' : '';
        if (kept.join('\n').length + sep.length + line.length > middleMax / 3) {
          // 粗估: 中文每字 3B
          kept.push('  … (后续字段被截断)');
          break;
        }
        kept.push(line);
      }
      const middleStr = kept.length > 0 ? `\n📝 申请内容:\n${kept.join('\n')}` : '';
      text = head + middleStr + tail;
      log.warn(`[event-router] approval notification 超长截断 sp_no=${sp_no} fields=${detail.fields.length}`);
    }

    // P0-2 重构: 首选实时推 (SDK message.sendText), 失败走 cron fallback
    let realTimeOk = false;
    if (corpId && agentId && secret && toUser && w) {
      try {
        const result = await w.message.sendText(toUser, text, agentId);
        const ec = result?.errcode;
        if (ec === 0 || ec === undefined) {
          log.info(`[event-router] approval real-time push OK to=${toUser} sp_no=${sp_no} ec=${ec}`);
          realTimeOk = true;
        } else {
          log.warn(`[event-router] approval real-time push failed ec=${ec} err=${result?.errmsg}`);
        }
      } catch (e) {
        log.warn(`[event-router] approval real-time push error: ${e.message}`);
      }
    }
    
    // 实时推送失败 仍 写入 pending 文件 (OpenClaw cron 可重试)
    if (!realTimeOk) {
      try {
        const fs = require('fs');
        const dir = path.dirname(fallbackNotifyFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        let pending = [];
        if (fs.existsSync(fallbackNotifyFile)) {
          try { pending = JSON.parse(fs.readFileSync(fallbackNotifyFile, 'utf-8') || '[]'); } catch (_) { pending = []; }
        }
        pending.push({
          receivedAt: Math.floor(Date.now() / 1000),
          event, actionText, sp_no, sp_name, sp_status, apply_user,
          rawXml: (payload.rawXml || '').slice(0, 800),
        });
        pending = pending.slice(-50);
        fs.writeFileSync(fallbackNotifyFile, JSON.stringify(pending, null, 2));
        log.info(`[event-router] approval fallback pending updated: ${event} (total=${pending.length})`);
      } catch (e) {
        log.warn(`[event-router] approval fallback write fail:`, e.message);
      }
    }
  };
}

/**
 * v1.5.2 P1-C handler: add_external_contact → 自动发新人欢迎语
 *
 * 业务场景: 老板企业添加企业客户时, 企业微信推 change_external_contact
 *   raw_xml 含 WelcomeCode (20秒有效) — 必须实时调用, 不能异步
 *   调 messenger.sendWelcomeMessage(welcomeCode, content) 发送欢迎语
 *
 * 调试性: 失败保留欢迎语仅报错不重试 (超 20 秒重试也无效)
 */
function newCustomerWelcome() {
  return async (payload) => {
    if (payload.Event !== 'change_external_contact') return;
    if (payload.ChangeType !== 'add_external_contact') return;
    // 1. 解析 raw_xml 拿 welcomeCode + externalUserId + userId
    const raw = payload.rawXml || '';
    const wcMatch = raw.match(/<WelcomeCode><!\[CDATA\[([^\]]+)\]\]><\/WelcomeCode>/);
    if (!wcMatch) {
      log.warn('[event-router] no WelcomeCode in raw_xml');
      return;
    }
    const welcomeCode = wcMatch[1];
    const extMatch = raw.match(/<ExternalUserID><!\[CDATA\[([^\]]+)\]\]><\/ExternalUserID>/);
    const userMatch = raw.match(/<UserID><!\[CDATA\[([^\]]+)\]\]><\/UserID>/);
    const externalUserId = extMatch?.[1] || '?';
    const userId = userMatch?.[1] || '?';
    try {
      const w = wSingleton;
      // 默认欢迎语: 简明, 含 %NICKNAME% 占位符
      const result = await w.messenger.sendWelcomeMessage(welcomeCode, {
        msgType: 'text',
        text: '欢迎加入你的公司数码！有任何问题随时联系我—负责人。',
      });
      const ec = result?.errcode;
      log.info(`[event-router] welcome sent: externalUserId=${externalUserId.slice(0,12)} userId=${userId.slice(0,16)} ec=${ec}`);
    } catch (e) {
      log.warn(`[event-router] welcome failed (likely expired 20s):`, e.message);
    }
  };
}

/**
 * 创建默认 router (含 P0 handlers)
 */
function createDefaultRouter(opts = {}) {
  const router = new EventRouter(opts);

  // P0 cache: Event='change_type' + ChangeType in [create_user|update_user|delete_user]
  // handler 内部判断 ChangeType
  router.on('change_type', addressbookCacheFlush());

  router.on('sys_approval_change', approvalNotify(opts));
  router.on('sys_approval_revoke', approvalNotify(opts));

  // v1.5.2 P1-C: add_external_contact → 自动发新人欢迎语 (2026-07-15 18:33 老板取消)
  // router.on('change_external_contact', newCustomerWelcome());

  return router;
}

module.exports = {
  EventRouter,
  createDefaultRouter,
  addressbookCacheFlush,
  approvalNotify,
  buildApprovalDetail,    // v2026-07-26 08:23 fix: 解析审批单字段详情
  buildApprovalProgress,
  writeDebugSnapshot,     // v2026-07-26 08:34 fix: getApprovalDetail 失败时调试快照
  ADDRESS_BOOK_CHANGE_TYPES,
  APPROVAL_EVENTS,
};
