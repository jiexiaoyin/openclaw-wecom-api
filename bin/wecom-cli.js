#!/usr/bin/env node
/**
 * wecom-cli — 企业微信 OpenClaw Skill CLI 入口
 *
 * 用法:
 *   wecom-cli <domain> <action> --args '<json>' [--json]
 *   wecom-cli utils status [--json]
 *   wecom-cli utils setup   (交互式配置)
 *
 * 9 域 × 80+ actions (v1.1.0 新增 document/document_webhook 2 域共 38 actions):
 *   customers  contacts  approval  meeting  checkin  schedule  utils
 *   document  document_webhook
 *
 * 路径探测:
 *   SKILL_ROOT = bin/ 的父目录 = wecom-skill/ 所在位置
 *   config.json 在 SKILL_ROOT 下
 *   SDK 在 SKILL_ROOT/sdk/ 下
 *
 * 设计参考: ~/.openclaw/skills/phoneerp/cli.js (phoneerp 范式)
 */

'use strict';

const path = require('path');

// 7-26 07:16 console→logger 迁移 (per 7-25 P2)
const logger = require('../sdk/utils/logger');
const log = logger('wecom-cli');
const fs = require('fs');
// os already required above (line 26)

// ============================================================
// v1.5.2 多应用支持：--config <path> 切换 config 文件（提前解析）
// ============================================================
let __cli_configPath = path.join(__dirname, '..', 'config.json');
{
  const __raw = process.argv.slice(2);
  const __idx = __raw.indexOf('--config');
  if (__idx >= 0 && __idx + 1 < __raw.length) {
    __cli_configPath = path.resolve(__raw[__idx + 1]);
  }
}

// ============================================================
// 路径探测 — 用 __dirname 探测 skill 根目录（无硬编码）
// ============================================================
const SKILL_ROOT = path.join(__dirname, '..');
const CONFIG_PATH = __cli_configPath;
const CONFIG_EXAMPLE_PATH = path.join(SKILL_ROOT, 'config.example.json');
const SDK_INDEX = path.join(SKILL_ROOT, 'sdk/index.js');
const SDK_CONFIG = path.join(SKILL_ROOT, 'sdk/config.cjs');

// ============================================================
// 参数解析
// ============================================================
const rawArgs = process.argv.slice(2);
const isJsonMode = rawArgs.includes('--json');
if (isJsonMode) rawArgs.splice(rawArgs.indexOf('--json'), 1);

const args = rawArgs;
const domain = args[0];
const action = args[1];

const argsIdx = args.indexOf('--args');
const userArgs = argsIdx >= 0 ? safeParseJson(args[argsIdx + 1]) : {};

// JSON 模式：抑制 console.warn/error（但保留 console.log 用于最终输出）
if (isJsonMode) {
    // P3 升级 (2026-07-26): 用 logger.setEnabled(false) 替代 console.* 抑制
    // 比 console 覆盖更精确, 只影响 logger 链, 不影响 process.stdout.write 兜底
    require('../sdk/utils/logger').setEnabled(false);
}

// ============================================================
// SDK 加载 + 配置加载
// ============================================================
const WeComPlugin = require(SDK_INDEX);
const DocumentWebhook = require(path.join(SKILL_ROOT, 'sdk/modules/document/webhook'));
const { createEventsStore } = require(path.join(SKILL_ROOT, 'sdk/utils/events-store'));
const { execSync } = require('child_process');
const os = require('os');

/** expand `~/foo` → `/root/foo`（同 daemon.js — 避免双路径不一致） */
function expandHome(p) {
  if (!p) return p;
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
}

const EVENTS_DB_PATH = (() => {
  // 优先级：env > config.json dbPath > 默认
  if (process.env.WECOM_EVENTS_DB_PATH) return process.env.WECOM_EVENTS_DB_PATH;
  const cfg = loadConfig();
  return expandHome(cfg.dbPath) || path.join(os.homedir(), '.openclaw/state/wecom-events.db');
})();

// lazy init — db 不存在时返空 store（不抛错）
function getEventsStore() {
  try {
    return createEventsStore(EVENTS_DB_PATH);
  } catch (e) {
    return {
      insert: () => ({ changes: 0 }),
      get: () => null,
      list: () => [],
      stats: () => [],
      close: () => {},
      __db_error: e.message,
    };
  }
}

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        return {};
    }
    try {
        // 直接读 JSON（绕开 sdk/config.cjs 的 bug：get() 读 this.config 但属性是 this._config）
        const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        // 跳过占位符（等待老板下发 secret 的状态）
        if (cfg.corpSecret && cfg.corpSecret.startsWith('__WAITING_FOR')) {
          throw new Error(`应用 ${cfg.agentId || '?'} 的 corpSecret 还未下发，请在 ${CONFIG_PATH} 里填 corpSecret 后重试`);
        }
        return cfg;
    } catch (e) {
        if (e.message.includes('corpSecret')) throw e;  // 占位符提示照控上
        log.warn(`[wecom-cli] config 解析失败: ${e.message}`);
        return {};
    }
}

function getWecom() {
    const config = loadConfig();
    if (!config.corpId || !config.corpSecret) {
        throw new Error('未配置 corpId/corpSecret。请运行: wecom-cli utils setup');
    }
    return new WeComPlugin(config);
}

function safeParseJson(str) {
    if (!str) return {};
    try {
        return JSON.parse(str);
    } catch (e) {
        throw new Error(`--args JSON 解析失败: ${e.message}\n输入: ${str}`);
    }
}

/**
 * YYYY-MM-DD 字符串 → Unix 秒级时间戳
 * v1.0.2 新增：客户统计域的 startDate/endDate 之前直接传字符串，API 要 uint32
 * 支持: "2026-06-01" / "2026-06-01 09:00:00" / 数字（透传）
 */
function ymdToUnix(input) {
    if (input == null) return undefined;
    if (typeof input === 'number') return input;  // 已经是数字直接返回
    if (typeof input !== 'string') return input;
    // v1.5.2 修复：8 位 YYYYMMDD 数字串 → 走时间戳转换（不能当秒数）
    if (/^\d{8}$/.test(input)) {
      const y = parseInt(input.slice(0, 4), 10);
      const m = parseInt(input.slice(4, 6), 10) - 1;
      const d = parseInt(input.slice(6, 8), 10);
      return Math.floor(new Date(y, m, d, 0, 0, 0).getTime() / 1000);
    }
    // 其他纯数字 → 当秒数透传
    if (/^\d+$/.test(input)) return parseInt(input, 10);
    // 解析 "YYYY-MM-DD" 或 "YYYY-MM-DD HH:MM:SS"
    const d = new Date(input.replace(' ', 'T') + (input.includes('T') ? '' : 'T00:00:00+08:00'));
    if (isNaN(d.getTime())) {
        throw new Error(`无法解析日期: ${input}（期望 YYYY-MM-DD 格式）`);
    }
    return Math.floor(d.getTime() / 1000);
}

// ============================================================
// daily_report helper functions (v1.5.2 P1-D+)
// ============================================================

// 解析 UserID → 中文名 (按 2026-06-07 12:15 老板关注名单字段缺失)
async function resolveUserNames(userIds, w) {
    const map = {};
    if (!w) return map;
    for (const u of new Set(userIds)) {
        if (!u || u === "?") continue;
        try {
            const r = await w.addressbook.getUser(u);
            const data = r?.data || r;
            const user = data?.user || (Array.isArray(data) ? data[0] : data);
            if (user && user.name) map[u] = user.name;
        } catch (e) { /* silent */ }
    }
    return map;
}

// events 路径: 当天实时事件
async function dailyReportFromEvents(targetDate, store, a, w, todayCST) {
    const [y, m, d] = targetDate.split("-").map(Number);
    const localMidnight = new Date(y, m-1, d, 0, 0, 0);
    const sinceTs = Math.floor(localMidnight.getTime() / 1000);
    const untilTs = sinceTs + 86400;  // 次日 00:00 (per 2026-07-14 22:47)

    const all = store.list({ since: sinceTs, limit: 5000 });
    const cec = all
        .filter(e => e.event === "change_external_contact")
        .filter(e => e.received_at < untilTs);

    const employees = {};
    const extOwners = {};
    for (const e of cec) {
        const userMatch = e.raw_xml?.match(/<UserID><!\[CDATA\[([^\]]+)\]\]><\/UserID>/);
        const extMatch = e.raw_xml?.match(/<ExternalUserID><!\[CDATA\[([^\]]+)\]\]><\/ExternalUserID>/);
        const user = userMatch?.[1] || "?";
        const ext = extMatch?.[1] || "?";
        if (ext !== "?") extOwners[ext] = user;
        if (!employees[user]) employees[user] = { user, add: [], edit: [], del: [], del_follow: [], transfer_fail: [] };
        const t = new Date(e.received_at * 1000);
        const time = `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}:${String(t.getSeconds()).padStart(2,"0")}`;
        const item = { time, external: ext };
        if (e.change_type === "add_external_contact") employees[user].add.push(item);
        else if (e.change_type === "edit_external_contact") employees[user].edit.push(item);
        else if (e.change_type === "del_external_contact") employees[user].del.push(item);
        else if (e.change_type === "del_follow_user") employees[user].del_follow.push(item);
        else if (e.change_type === "transfer_fail") employees[user].transfer_fail.push(item);
    }

    let resolved = {};
    if (a.resolve !== false && w && Object.keys(extOwners).length > 0) {
        for (const [ext, owner] of Object.entries(extOwners)) {
            try {
                const r = await w.contact.getCustomerDetail(owner, ext);
                const info = r?.data || r;
                const extInfo = info?.external_contact || info;
                resolved[ext] = {
                    nickname: extInfo.name || extInfo.nickname || null,
                    type: extInfo.type ?? null,
                    avatar: extInfo.avatar || null,
                };
            } catch (e) { resolved[ext] = { _error: e.message.substring(0, 100) }; }
        }
    }

    const nameMap = await resolveUserNames(Object.keys(employees), w);
    const emps = Object.values(employees)
        .sort((a, b) => (b.add.length + b.edit.length + b.del.length + b.del_follow.length)
            - (a.add.length + a.edit.length + a.del.length + a.del_follow.length))
        .map(e => ({ ...e, name: nameMap[e.user] || null }));
    const anomalies = emps.filter(e => e.user.includes("@") || /^\d{11}/.test(e.user));

    return {
        date: targetDate,
        since: sinceTs, until: untilTs,
        source: "events",
        events_total: cec.length,
        anomalies_count: anomalies.length,
        anomalies_users: anomalies.map(a => a.user),
        employees: emps,
        resolved_customers: resolved,
        summary: {
            add: emps.reduce((s,e) => s + e.add.length, 0),
            edit: emps.reduce((s,e) => s + e.edit.length, 0),
            del: emps.reduce((s,e) => s + e.del.length, 0),
            del_follow: emps.reduce((s,e) => s + e.del_follow.length, 0),
            transfer_fail: emps.reduce((s,e) => s + e.transfer_fail.length, 0),
            employees_count: emps.length,
        },
        _meta: {
            visibility: "boss-only",
            policy: "today=events, history=API (老板 2026-07-15 11:12 确立)",
            default_date: "yesterday (per 2026-07-09 09:35 偏好)",
        },
    };
}

// API 路径: 历史 (complete, 走 wecom getUserClientStat)
async function dailyReportFromApi(targetDate, w, a, todayCST) {
    if (!w) {
        return { date: targetDate, source: "api", error: "API path 需要 wecom SDK" };
    }
    const [y, m, d] = targetDate.split("-").map(Number);
    const startTs = Math.floor(new Date(y, m-1, d, 0, 0, 0).getTime() / 1000);
    const endTs = startTs + 86400;
    const todayTs = Math.floor(new Date(todayCST + "T00:00:00+08:00").getTime() / 1000);
    const daysDiff = Math.floor((todayTs - startTs) / 86400);
    if (daysDiff < 1) {
        return { date: targetDate, source: "api", error: "今天/未来日期 → 请用 events 路径 (source=events)" };
    }
    if (daysDiff > 180) {
        return { date: targetDate, source: "api", error: "API 不支持 > 180 天前的数据 (per 2026-07-15 01:30)" };
    }
    let employeeIds = [];
    try {
        // v1.5.2 P1-D+ fix: 用 getDepartmentUsersDetail (/user/list GET, 24 人)
        const depts = await w.addressbook.getDepartmentUsersDetail(1, true);
        const users = depts?.userlist || depts || [];
        employeeIds = users.map(u => u.userid).filter(Boolean);
    } catch (e) {
        return { date: targetDate, source: "api", error: "拿通讯录失败: " + e.message.substring(0, 100) };
    }
    if (employeeIds.length === 0) {
        return { date: targetDate, source: "api", error: "通讯录为空" };
    }
    const employees = [];
    let apiErrors = 0;
    for (const userId of employeeIds) {
        try {
            const r = await w.contactstats.getUserClientStat(userId, startTs, endTs);
            const data = r?.data || r;
            const items = data?.behavior_data || [];
            const stat = items.reduce((acc, it) => {
                acc.new_contact_cnt += (it.new_contact_cnt || 0);  // [P0-fix] 企微官方字段是 new_contact_cnt, 不是 new_external_count (per fact 17:00 老板要求对照官方文档核实)
                acc.chat_count += (it.chat_count || 0);
                acc.message_count += (it.message_count || 0);
                return acc;
            }, { new_contact_cnt: 0, chat_count: 0, message_count: 0 });
            if (items.length > 0) {
                employees.push({ user: userId, days: items.length, ...stat });
            }
        } catch (e) { apiErrors++; }
    }
    const nameMap = await resolveUserNames(employees.map(e => e.user), w);
    const emps = employees
        .map(e => ({ ...e, name: nameMap[e.user] || null }))
        .sort((a, b) => (b.new_contact_cnt + b.chat_count) - (a.new_contact_cnt + a.chat_count));

    return {
        date: targetDate,
        since: startTs, until: endTs,
        source: "api",
        days_diff: daysDiff,
        events_total: employees.length,
        api_errors: apiErrors,
        employees: emps,
        summary: {
            employees_count: employees.length,
            total_new: employees.reduce((s, e) => s + e.new_contact_cnt, 0),
            total_chat: employees.reduce((s, e) => s + e.chat_count, 0),
            total_message: employees.reduce((s, e) => s + e.message_count, 0),
        },
        _meta: {
            visibility: "boss-only",
            policy: "history=API (老板 2026-07-15 11:12 规则)",
            api_window: "昨天~前180天 (per 2026-07-15 01:30)",
        },
    };
}

// ============================================================
// 7 域命令分发表（集中修复 12 个签名 bug）
// ============================================================
const COMMANDS = {
    // ========== 客户域（25 个 action, 含客户统计 + 获客 + 群统计 + lost_stat）==========
    customers: {
        get_customer_list: (w, a) => w.contact.getCustomerList(a.userId, a.cursor || ''),
        get_customer_detail: (w, a) => w.contact.getCustomerDetail(a.userId, a.externalUserId),
        get_external_user_info: (w, a) => w.contact.getExternalUserInfo(a.userId),
        batch_get_customers: (w, a) => w.contact.batchGetCustomers(a.userId, a.externalUserIds),
        update_customer_remark: (w, a) => w.contact.updateCustomerRemark(a.userId, a.externalUserId, {
            // FIX: 旧 switch 只传 3 个字段，实际支持 6 个 — 全部透传
            remark: a.remark,
            description: a.description,
            addRemark: a.addRemark,
            mobile: a.mobile,
            corporateName: a.corporateName,
            position: a.position,
        }),
        get_corp_tags: (w) => w.contact.getCorpTags(),
        add_corp_tag: (w, a) => w.contact.addCorpTag(a.groupId, a.tagName, a.groupName || ''),
        update_corp_tag: (w, a) => w.contact.updateCorpTag(a.tagId, a.tagName),
        delete_corp_tag: (w, a) => w.contact.deleteCorpTag(a.tagId),
        update_customer_tags: (w, a) => w.contact.updateCustomerTags(a.userId, a.externalUserId, {
            addTag: a.addTag || [],
            removeTag: a.removeTag || [],
        }),
        get_groupchat_list: (w, a) => {
            // FIX: 旧 switch 传的 4 个参数 (statusFilter, creatorUserid, limit, cursor) 顺序错位
            // 实际签名: getGroupChatList(cursor='', size=100, statusFilter=0) — 无 creatorUserid
            return w.contact.getGroupChatList(a.cursor || '', a.size || 100, a.statusFilter || 0);
        },
        get_groupchat: (w, a) => w.contact.getGroupChat(a.chatId),
        get_all_customers: (w, a) => w.customer.getCustomerList(a.userid),
        get_all_customer_detail: (w, a) => w.customer.getCustomerDetail(a.externalUserId),
        batch_get_customers_by_user: (w, a) => w.customer.batchGetByUser(a.userids),
        mark_customer_tag: (w, a) => w.customer.markTag(a.externalUserId, a.tagIds, a.userid, a.operation || 'add'),
        // v1.0.2 修复:
        //   Bug 1: contact_stats → contactstats (SDK 实例属性名无下划线)
        //   Bug 2: startDate (YYYY-MM-DD 字符串) → 转 Unix 秒级时间戳 (API 要 uint32)
        get_user_client_stat: (w, a) => w.contactstats.getUserClientStat(a.userId, ymdToUnix(a.startDate), ymdToUnix(a.endDate), a.cache),
        get_all_user_client_stat: (w, a) => w.contactstats.getAllUserClientStat(ymdToUnix(a.startDate), ymdToUnix(a.endDate), a.cache),
        get_user_client_detail: (w, a) => w.contactstats.getUserClientDetail(a.userId, ymdToUnix(a.startDate), ymdToUnix(a.endDate)),
        get_group_chat_stat: (w, a) => w.contactstats.getGroupChatStat(ymdToUnix(a.startDate), ymdToUnix(a.endDate), a.userId, a.departmentId),
        get_user_lost_stat: (w, a) => w.contactstats.getUserLostStat(ymdToUnix(a.startDate), ymdToUnix(a.endDate), a.userId),

        // v1.5.2 P1-D+ (老板 11:14+11:21): 当日客户聚合日报 (老板专用)
        //   数据源 (per 2026-07-15 11:12 规则):
        //     今天 → events 表 (real-time, 老板 11:21 query "查询当日的使用时间")
        //     历史 → wecom API (complete, 老板 11:21 query "非当日的使用API")
        //   默认日期 (per 2026-07-09 09:35 explicit preference): 昨日
        //   日期计算 (per 2026-07-08 12:37 explicit preference): getFullYear/getMonth/getDate
        //   支持: a.date="YYYY-MM-DD" 指定日期; a.source=auto|events|api; a.resolve=false 关闭客户名解析
        daily_report: async (w, a) => {
            const eventsDbPath = a.events_db || "/opt/openclaw/state/wecom-events.db";
            const store = createEventsStore(eventsDbPath);

            // 动态日期 (per 2026-07-08 12:37 偏好: 不用 toISOString, 用 getFullYear/getMonth/getDate)
            const now = new Date();
            const todayDate = new Date(now);
            const yesterdayDate = new Date(now);
            yesterdayDate.setDate(todayDate.getDate() - 1);
            const fmtDate = (d) =>
                `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
            const todayCST = fmtDate(todayDate);
            const yesterdayCST = fmtDate(yesterdayDate);

            // 默认 yesterday (per 2026-07-09 09:35 explicit)
            const targetDate = a.date || yesterdayCST;
            const isToday = (targetDate === todayCST);
            const source = a.source || (isToday ? "events" : "api");

            if (source === "events") {
                return dailyReportFromEvents(targetDate, store, a, w, todayCST);
            } else {
                return dailyReportFromApi(targetDate, w, a, todayCST);
            }
        },

        // v1.5.2 P2-A (老板 11:47): 员工每日通讯录变更审计 (events 表, 高 ROI)
        //   数据源: events 表 change_contact 事件 (per 11:12 规则)
        //   3 类 ChangeType: create_user / update_user / delete_user (官方 90970, 修 v1.5.2 P2-A bug)
        //   默认 yesterday (per 2026-07-09 09:35 explicit)
        //   仅老板可见
        daily_user_changes: async (w, a) => {
            const eventsDbPath = a.events_db || "/opt/openclaw/state/wecom-events.db";
            const store = createEventsStore(eventsDbPath);
            const now = new Date();
            const todayDate = new Date(now);
            const yesterdayDate = new Date(now);
            yesterdayDate.setDate(todayDate.getDate() - 1);
            const fmtDate = (d) =>
                `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
            const targetDate = a.date || fmtDate(yesterdayDate);

            const [y, m, d] = targetDate.split("-").map(Number);
            const sinceTs = Math.floor(new Date(y, m-1, d, 0, 0, 0).getTime() / 1000);
            const untilTs = sinceTs + 86400;

            const all = store.list({ since: sinceTs, limit: 5000 });
            const cc = all
                .filter(e => e.event === "change_contact")
                .filter(e => e.received_at < untilTs);

            const employees = {};
            const CREATE_USER = "create_user", UPDATE_USER = "update_user";
            const DELETE_USER = "delete_user";
            for (const e of cc) {
                const userMatch = e.raw_xml?.match(/<UserID><!\[CDATA\[([^\]]+)\]\]><\/UserID>/);
                const user = userMatch?.[1] || "?";
                if (!employees[user]) employees[user] = {
                    user, create: [], update: [], delete: []
                };
                const t = new Date(e.received_at * 1000);
                const time = `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}:${String(t.getSeconds()).padStart(2,"0")}`;
                const item = { time };
                if (e.change_type === CREATE_USER) employees[user].create.push(item);
                else if (e.change_type === UPDATE_USER) employees[user].update.push(item);
                else if (e.change_type === DELETE_USER) employees[user].delete.push(item);
            }

            const nameMap = await resolveUserNames(Object.keys(employees), w);
            const emps = Object.values(employees)
                .sort((a, b) => (b.create.length + b.update.length + b.del.length + b.undelete.length)
                    - (a.create.length + a.update.length + a.del.length + a.undelete.length))
                .map(e => ({ ...e, name: nameMap[e.user] || null }));

            const anomalies = emps.filter(e => e.user.includes("@") || /^\d{11}/.test(e.user));

            return {
                date: targetDate,
                since: sinceTs, until: untilTs,
                source: "events",
                events_total: cc.length,
                anomalies_count: anomalies.length,
                anomalies_users: anomalies.map(a => a.user),
                employees: emps,
                summary: {
                    create: emps.reduce((s, e) => s + e.create.length, 0),
                    update: emps.reduce((s, e) => s + e.update.length, 0),
                    delete: emps.reduce((s, e) => s + e.delete.length, 0),
                    employees_count: emps.length,
                },
                _meta: {
                    visibility: "boss-only",
                    policy: "通讯录变更走 events (per 11:12 规则, API 不记录变更历史)",
                    change_types: [CREATE_USER, UPDATE_USER, DELETE_USER],
                    default_date: "yesterday (per 2026-07-09 09:35 偏好)",
                },
            };
        },

        // v1.5.2 P2-B (老板 11:47): 审批效率分析 (走 API 实时)
        //   数据源: wecom API oa/getapprovalinfo (实时, 无 180 天限制)
        //   按时间范围 / 审批类型 / 申请人 / 状态聚合
        approval_stats: async (w, a) => {
            if (!w) return { error: "API path 需要 wecom SDK" };
            const now = new Date();
            const fmtDate = (d) =>
                `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
            const yesterdayDate = new Date(now);
            yesterdayDate.setDate(now.getDate() - 1);
            const targetDate = a.date || fmtDate(yesterdayDate);
            const startTime = `${targetDate} 00:00:00`;
            const endTime = `${targetDate} 23:59:59`;

            // 拿时间范围内的审批申请 ID (offset 循环拉, 上限 10000)
            const spNos = [];
            let offset = 0;
            const limit = 100;
            while (offset < 10000) {
                try {
                    const r = await w.approval.getApprovalIds(
                        Math.floor(new Date(targetDate + "T00:00:00+08:00").getTime() / 1000),
                        Math.floor(new Date(targetDate + "T23:59:59+08:00").getTime() / 1000),
                        offset, limit
                    );
                    const data = r?.data || r;
                    const items = data?.sp_no_list || [];
                    spNos.push(...items);
                    if (items.length < limit) break;
                    offset += limit;
                } catch (e) {
                    return { date: targetDate, error: "拉审批列表失败: " + e.message.substring(0, 200) };
                }
            }

            // 按 sp_no 拉详情
            const approvals = [];
            let apiErrors = 0;
            for (const spNo of spNos.slice(0, a.max_detail || 100)) {
                try {
                    const r = await w.approval.getApprovalDetail(spNo);
                    const data = r?.data || r;
                    const info = data?.info || data;
                    approvals.push({
                        sp_no: spNo,
                        name: info?.sp_name || info?.name || "?",
                        applicant: info?.applyer?.userid || null,
                        applicant_name: info?.applyer?.party?.name || null,
                        department: info?.applyer?.party?.department_name || null,
                        status: info?.sp_status ?? null,
                        create_time: info?.apply_time ?? null,
                    });
                } catch (e) { apiErrors++; }
            }

            // 按申请人 + 状态聚合
            const byApplicant = {};
            const byStatus = { 1: 0, 2: 0, 3: 0 };  // 1=审批中 2=已通过 3=已驳回
            const byType = {};
            for (const a of approvals) {
                if (a.applicant) {
                    if (!byApplicant[a.applicant]) byApplicant[a.applicant] = { count: 0, approved: 0, rejected: 0, pending: 0 };
                    byApplicant[a.applicant].count++;
                    if (a.status === 2) byApplicant[a.applicant].approved++;
                    else if (a.status === 3) byApplicant[a.applicant].rejected++;
                    else if (a.status === 1) byApplicant[a.applicant].pending++;
                }
                if (a.status in byStatus) byStatus[a.status]++;
                const t = a.name;
                if (t) byType[t] = (byType[t] || 0) + 1;
            }

            const applicantMap = await resolveUserNames(Object.keys(byApplicant), w);

            const applicants = Object.entries(byApplicant)
                .map(([user, s]) => ({ user, name: applicantMap[user] || null, ...s }))
                .sort((a, b) => b.count - a.count);

            return {
                date: targetDate,
                start_time: startTime,
                end_time: endTime,
                source: "api",
                sp_nos_total: spNos.length,
                details_fetched: approvals.length,
                api_errors: apiErrors,
                by_status: byStatus,
                by_type: byType,
                by_applicant: applicants,
                approvals: a.detail ? approvals : undefined,
                summary: {
                    total: approvals.length,
                    approved: byStatus[2] || 0,
                    rejected: byStatus[3] || 0,
                    pending: byStatus[1] || 0,
                    applicants_count: applicants.length,
                },
                _meta: {
                    visibility: "boss-only",
                    policy: "审批实时 API (无 180 天窗口限制)",
                    default_date: "yesterday (per 2026-07-09 09:35 偏好)",
                },
            };
        },

        // v1.5.2 P2-C (老板 11:47): 员工周行为汇总 (API, 限昨天~180 天)
        //   数据源: wecom API contactstats.getUserClientStat (按 11:12 规则: 历史=API)
        //   默认查询周 (周一~周日), 限昨天~前 180 天 (per 2026-07-15 01:30)
        weekly_behavior: async (w, a) => {
            if (!w) return { error: "API path 需要 wecom SDK" };
            const now = new Date();
            const fmtDate = (d) =>
                `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
            // 默认上周 (周一~周日)
            const todayDow = now.getDay() === 0 ? 7 : now.getDay();  // 1=Mon..7=Sun
            const thisMonday = new Date(now);
            thisMonday.setDate(now.getDate() - (todayDow - 1));
            const lastMonday = new Date(thisMonday);
            lastMonday.setDate(thisMonday.getDate() - 7);
            const lastSunday = new Date(thisMonday);
            lastSunday.setDate(thisMonday.getDate() - 1);
            const weekStart = a.start_date || fmtDate(lastMonday);
            const weekEnd = a.end_date || fmtDate(lastSunday);

            const [sy, sm, sd] = weekStart.split("-").map(Number);
            const [ey, em, ed] = weekEnd.split("-").map(Number);
            const startTs = Math.floor(new Date(sy, sm-1, sd, 0, 0, 0).getTime() / 1000);
            const endTs = Math.floor(new Date(ey, em-1, ed, 23, 59, 59).getTime() / 1000);

            // 边界检查 (per 2026-07-15 01:30: API 仅昨天~前 180 天)
            const todayCST = fmtDate(now);
            const todayTs = Math.floor(new Date(todayCST + "T00:00:00+08:00").getTime() / 1000);
            const daysDiff = Math.floor((todayTs - startTs) / 86400);
            if (daysDiff < 1) {
                return { week_start: weekStart, week_end: weekEnd, source: "api", error: "本周/未来日期 → 行为数据 API 不支持, 请查上周" };
            }
            if (daysDiff > 180) {
                return { week_start: weekStart, week_end: weekEnd, source: "api", error: "API 不支持 > 180 天前的数据 (per 2026-07-15 01:30)" };
            }

            // 拿员工列表
            let employeeIds = [];
            try {
                const depts = await w.addressbook.getDepartmentUsersDetail(1, true);
                const users = depts?.userlist || depts || [];
                employeeIds = users.map(u => u.userid).filter(Boolean);
            } catch (e) {
                return { error: "拿通讯录失败: " + e.message.substring(0, 200) };
            }

            // 每个员工调 getUserClientStat
            const employees = [];
            let apiErrors = 0;
            for (const userId of employeeIds) {
                try {
                    const r = await w.contactstats.getUserClientStat(userId, startTs, endTs);
                    const data = r?.data || r;
                    const items = data?.behavior_data || [];
                    const stat = items.reduce((acc, it) => {
                        acc.new_contact_cnt += (it.new_contact_cnt || 0);  // [P0-fix] 企微官方字段是 new_contact_cnt, 不是 new_external_count (per fact 17:00 老板要求对照官方文档核实)
                        acc.chat_count += (it.chat_count || 0);
                        acc.message_count += (it.message_count || 0);
                        acc.reply_percentage = Math.max(acc.reply_percentage, it.reply_percentage || 0);
                        return acc;
                    }, { new_contact_cnt: 0, chat_count: 0, message_count: 0, reply_percentage: 0 });
                    if (items.length > 0) {
                        employees.push({ user: userId, days: items.length, ...stat });
                    }
                } catch (e) { apiErrors++; }
            }

            const nameMap = await resolveUserNames(employees.map(e => e.user), w);
            const emps = employees
                .map(e => ({ ...e, name: nameMap[e.user] || null }))
                .sort((a, b) => (b.new_contact_cnt + b.chat_count) - (a.new_contact_cnt + a.chat_count));

            return {
                week_start: weekStart,
                week_end: weekEnd,
                start_ts: startTs, end_ts: endTs,
                source: "api",
                days_diff: daysDiff,
                api_errors: apiErrors,
                employees: emps,
                summary: {
                    employees_count: employees.length,
                    total_new_external: employees.reduce((s, e) => s + e.new_contact_cnt, 0),  // [P0-fix] 旧名也保留
                    total_chat: employees.reduce((s, e) => s + e.chat_count, 0),
                    total_message: employees.reduce((s, e) => s + e.message_count, 0),
                    avg_reply_percentage: employees.length > 0
                        ? (employees.reduce((s, e) => s + e.reply_percentage, 0) / employees.length).toFixed(1)
                        : 0,
                },
                _meta: {
                    visibility: "boss-only",
                    policy: "历史行为走 API (per 11:12 规则)",
                    api_window: "昨天~前180天 (per 2026-07-15 01:30)",
                    default_week: "上周 (周一~周日, per 2026-07-09 09:35 偏好)",
                },
            };
        },
    },

    // ========== 通讯录域（9 个 action）==========

    // ========== 通讯录域（9 个 action）==========
    contacts: {
        get_user_list: (w, a) => w.addressbook.getDepartmentUsers(a.departmentId || 1, a.fetchChild || false),
        get_department_users_detail: (w, a) => w.addressbook.getDepartmentUsersDetail(a.departmentId || 1, a.fetchChild || false),
        get_department_list: (w, a) => w.addressbook.getDepartmentList(a.departmentId),
        get_user: (w, a) => w.addressbook.getUser(a.userId),
        get_user_by_mobile: (w, a) => w.addressbook.getUserIdByMobile(a.mobile),
        get_user_by_email: (w, a) => w.addressbook.getUserIdByEmail(a.email),
        create_user: (w, a) => w.addressbook.createUser(a.userData),
        update_user: (w, a) => w.addressbook.updateUser(a.userData),
        delete_user: (w, a) => w.addressbook.deleteUser(a.userId),
    },

    // ========== 审批域（11 个 action, 含 OA 调 + journal 下载）==========
    approval: {
        // v1.0.1 修复：cursor 不再强制转 ''，让 SDK 的 `cursor = 0` 默认生效（API 要 uint32，不是 string）
        get_approval_list: (w, a) => w.approval.getApprovalIds(a.startTime, a.endTime, a.cursor, a.size || 100, a.filters || null),
        // v1.5.2 bug fix: 企业微信要求 sp_no 为 number, CLI 之前原样传 string
        get_approval_detail: (w, a) => {
            const sp = a.sp_no ?? a.spNo;
            return w.approval.getApprovalDetail(typeof sp === 'string' ? Number(sp) : sp);
        },
        find_bottlenecks: (w, a) => w.approval.findBottlenecks({ startTime: a.startTime, endTime: a.endTime, spStatus: a.spStatus, filters: a.filters }),
        get_template_detail: (w, a) => w.approval.getTemplateDetail(a.templateId),
        // v1.5.2: event router P0-2 - 读 daemon 写入的 pending 列表
        get_pending: async (w, a) => {
            const fs = require('fs');
            const f = path.join(os.homedir(), '.openclaw/state/wecom-approval-pending.json');
            if (!fs.existsSync(f)) return { count: 0, pending: [] };
            const raw = JSON.parse(fs.readFileSync(f, 'utf-8') || '[]');
            return { count: raw.length, pending: raw };
        },
        clear_pending: async (w, a) => {
            const fs = require('fs');
            const f = path.join(os.homedir(), '.openclaw/state/wecom-approval-pending.json');
            const before = fs.existsSync(f) ? fs.readFileSync(f, 'utf-8').length : 0;
            fs.writeFileSync(f, '[]');
            return { cleared: true, before };
        },
        submit_approval: (w, a) => {
            // FIX: 旧 switch 传 callerUserid，module 实际解构 creator
            const { templateId, callerUserid, ...rest } = a;
            return w.approval.submitApproval({
                templateId,
                creator: callerUserid,
                ...rest,
            });
        },
        // v2026-07-26 (老板 query 11:24): 请假一站式 (自动补 Vacation value)
        submit_leave_request: (w, a) => w.approval.submitLeaveRequest({
            templateId: a?.templateId,
            creator: a?.creator || a?.callerUserid,
            leaveTypeId: a?.leaveTypeId,
            leaveTypeName: a?.leaveTypeName,
            startTime: a?.startTime,
            endTime: a?.endTime,
            reasonText: a?.reasonText,
            useTemplateApprover: a?.useTemplateApprover !== false
        }),
        // v2026-07-26 13:17 老板 query B: 通用提交 (按模板名 + 中文标题 data)
        submit: (w, a) => w.approval.submit({
            template: a?.template,
            caller: a?.caller || a?.callerUserid,
            data: a?.data || {},
            useTemplateApprover: a?.useTemplateApprover !== false,
        }),
        get_leave_config: (w) => w.approval.getLeaveConfig(),
        get_leave_balance: (w, a) => w.approval.getLeaveBalance(a.userId),
        create_template: (w, a) => w.approval.createTemplate(a.templateData),
        update_template: (w, a) => w.approval.updateTemplate(a.templateId, a.templateData),
        // v2026-07-26 (老板 query 10:57): 补全 templates 三件套
        list_templates: (w, a) => {
            const group = a?.group;
            if (group) {
                const byGroup = w.approval.listTemplatesByGroup();
                return { count: (byGroup[group] || []).length, group, templates: byGroup[group] || [] };
            }
            const flat = w.approval.listTemplates();
            return { count: flat.length, templates: flat };
        },
        search_templates: (w, a) => {
            const name = (a?.name || '').toString().trim();
            if (!name) return { error: 'search_templates 需要 name 参数 (如 {"name":"请假"})' };
            const all = w.approval.listTemplates();
            // 模糊查询: substring match (支持中文 + 部分匹配)
            const matches = all.filter(t =>
                t.name.includes(name) ||
                t.group.includes(name)
            );
            return { query: name, count: matches.length, matches };
        },
        sync_templates: (w, a) => w.approval.syncApprovalTemplates({
            templateIds: a?.templateIds || null,
            concurrency: a?.concurrency || 5,
            controlsOnly: a?.controlsOnly !== false,
            writeBack: a?.writeBack === true
        }),
        diff_templates: async (w, a) => {
            const result = await w.approval.diffApprovalTemplates({
                templateIds: a?.templateIds || null,
                formatOutput: false
            });
            return result;
        },
    },

    // ========== 会议域（5 个 action — 2 个死代码复活）==========
    meeting: {
        create_meeting: (w, a) => {
            const { userId, ...rest } = a;
            return w.meeting.createMeeting({
                organizers: [userId],
                ...rest,
            });
        },
        // FIX: 旧 switch 调不存在的 getMeetingList()，改调真实存在的 getUserMeetingIds
        get_meeting_list: (w, a) => w.meeting.getUserMeetingIds(a.userId, a.startTime, a.endTime),
        get_meeting_detail: (w, a) => w.meeting.getMeetingDetail(a.meetingId),
        // FIX: 旧 switch 传 (meetingId, userId) 吞掉 userId，真实签名只接 meetingId
        cancel_meeting: (w, a) => w.meeting.cancelMeeting(a.meetingId),
        // FIX: 旧 switch 调不存在的 inviteMeeting()，改调真实存在的 updateMeetingAttendees
        invite_meeting: (w, a) => w.meeting.updateMeetingAttendees(a.meetingId, {
            attendees: a.userIds,
            updateScope: a.updateScope || 1,
        }),
    },

    // ========== 打卡域（2 个 action — 都是死代码复活）==========
    checkin: {
        // FIX: 旧 switch 调不存在的 getCheckinRecords()，改调 getRecords
        get_checkin_records: (w, a) => w.checkin.getRecords(a.startTime, a.endTime, a.userIds, a.opencheckindatatype || 3),
        // FIX: 旧 switch 调不存在的 getCheckinRules()，改调 getCorpRules 或 getUserRules
        get_checkin_rules: (w, a) => {
            if (a.userId) return w.checkin.getUserRules(a.userId, a.dateTime);
            return w.checkin.getCorpRules();
        },
    },

    // ========== 打卡规则域（v1.5.2 W3-3: snake_case + 别名兼容）==========
    checkinrules: {
        // snake_case 主名称（与 SDK 模块方法名一致）
        get_checkin_rules: (w, a) => w.checkinrules.getCheckInRules(a.offset ?? 0, a.size ?? 100),
        get_checkin_rule_detail: (w, a) => w.checkinrules.getCheckInRuleDetail(a.userIds, a.datetime),
        create_checkin_rule: (w, a) => w.checkinrules.createCheckInRule(a.rule),
        update_checkin_rule: (w, a) => w.checkinrules.updateCheckInRule(a.groupId, a.rule),
        delete_checkin_rule: (w, a) => w.checkinrules.deleteCheckInRule(a.groupId),
        copy_checkin_rule: (w, a) => w.checkinrules.copyCheckInRule(a.sourceGroupId, a.newGroupName),
        get_checkin_rule_users: (w, a) => w.checkinrules.getCheckInRuleUsers(a.groupId),
        add_checkin_rule_users: (w, a) => w.checkinrules.addCheckInRuleUsers(a.groupId, a.userIds || [], a.departmentIds || []),
        remove_checkin_rule_users: (w, a) => w.checkinrules.removeCheckInRuleUsers(a.groupId, a.userIds || [], a.departmentIds || []),
        get_checkin_locations: (w, a) => w.checkinrules.getCheckInLocations(a.groupId),
        add_checkin_location: (w, a) => w.checkinrules.addCheckInLocation(a.groupId, a.location),
        delete_checkin_location: (w, a) => w.checkinrules.deleteCheckInLocation(a.groupId, a.locationId),
        get_device_checkin_data: (w, a) => w.checkinrules.getDeviceCheckInData(a.deviceId, a.startTime, a.endTime),
        get_device_list: (w, a) => w.checkinrules.getDeviceList(a.offset ?? 0, a.size ?? 100),
        set_checkin_reminder: (w, a) => w.checkinrules.setCheckInReminder(a.groupId, a.remindTime, a.remidLocation || ''),
        // 别名映射（兼容旧 camelCase 调用）
        getCheckInRules: 'get_checkin_rules',
        getCheckInRuleDetail: 'get_checkin_rule_detail',
        createCheckInRule: 'create_checkin_rule',
        updateCheckInRule: 'update_checkin_rule',
        deleteCheckInRule: 'delete_checkin_rule',
        copyCheckInRule: 'copy_checkin_rule',
        getCheckInRuleUsers: 'get_checkin_rule_users',
        addCheckInRuleUsers: 'add_checkin_rule_users',
        removeCheckInRuleUsers: 'remove_checkin_rule_users',
        getCheckInLocations: 'get_checkin_locations',
        addCheckInLocation: 'add_checkin_location',
        deleteCheckInLocation: 'delete_checkin_location',
        getDeviceCheckInData: 'get_device_checkin_data',
        getDeviceList: 'get_device_list',
        setCheckInReminder: 'set_checkin_reminder',
    },

    // ========== 日程域（6 个 action）==========
    // ========== 汇报域（4 个 action）— v1.5.0 M1 新增 ==========
    journal: {
        get_record_list: (w, a) => w.journal.getRecordList(
            ymdToUnix(a.startTime), ymdToUnix(a.endTime), a.filters || [], a.cursor || 0, a.limit || 100
        ),
        get_record_detail: (w, a) => w.journal.getRecordDetail(a.journaluuid),
        get_stat_list: (w, a) => w.journal.getStatList(
            a.templateId, ymdToUnix(a.startTime), ymdToUnix(a.endTime)
        ),
        download_wedrive_file: (w, a) => w.journal.downloadWedriveFile(a.journaluuid, a.fileId),
    },

    schedule: {
        create_calendar: (w, a) => w.schedule.createCalendar(a),
        get_calendar: (w, a) => w.schedule.getCalendar(a.calendarId),
        create_event: (w, a) => {
            // FIX: 旧 switch 传 calendarId，module 实际解构 organizer
            const { calendarId, organizer, ...rest } = a;
            return w.schedule.createEvent({
                organizer: organizer || calendarId,  // 兼容旧参数名
                ...rest,
            });
        },
        update_event: (w, a) => w.schedule.updateEvent(a.scheduleId, a),
        delete_event: (w, a) => w.schedule.deleteEvent(a.scheduleId),
        add_event_attendees: (w, a) => w.schedule.addEventAttendees(a.scheduleId, a.attendees),
    },

    // ========== 文档域（57 个 action, v1.1.0 + v1.5.2 coverage-enhance 追加）==========
    document: {
        // --- 二、管理文档 (5) ---
        create_doc: (w, a) => w.document.createDoc({
            spaceid: a.spaceid, fatherid: a.fatherid,
            docType: a.docType, docName: a.docName,
            adminUsers: a.adminUsers,
        }),
        rename_doc: (w, a) => w.document.renameDoc({ docid: a.docid, formid: a.formid, newName: a.newName }),
        delete_doc: (w, a) => w.document.deleteDoc({ docid: a.docid, formid: a.formid }),
        get_doc_base_info: (w, a) => w.document.getDocBaseInfo(a.docid),
        share_doc: (w, a) => w.document.shareDoc({ docid: a.docid, formid: a.formid }),

        // --- 三、管理文档内容 (2) ---
        update_document: (w, a) => w.document.updateDocument(a.docid, a.requests, a.version),
        get_document: (w, a) => w.document.getDocument(a.docid),

        // --- 四、管理普通表格内容 (3) ---
        update_spreadsheet: (w, a) => w.document.updateSpreadsheet(a.docid, a.requests),
        get_spreadsheet_properties: (w, a) => w.document.getSpreadsheetProperties(a.docid),
        get_spreadsheet_range: (w, a) => w.document.getSpreadsheetRange(a.docid, a.sheetId, a.range),

        // --- 五、智能表格 - 子表 (4) ---
        add_smart_sheet: (w, a) => w.document.addSmartSheet(a.docid, a.properties),
        delete_smart_sheet: (w, a) => w.document.deleteSmartSheet(a.docid, a.sheetId),
        update_smart_sheet: (w, a) => w.document.updateSmartSheet(a.docid, a.properties),
        get_smart_sheet: (w, a) => w.document.getSmartSheet(a.docid, a.sheetId, a.needAllTypeSheet),

        // --- 五、智能表格 - 视图 (4) ---
        add_view: (w, a) => w.document.addView({
            docid: a.docid, sheetId: a.sheetId,
            viewTitle: a.viewTitle, viewType: a.viewType,
            propertyGantt: a.propertyGantt, propertyCalendar: a.propertyCalendar,
        }),
        delete_views: (w, a) => w.document.deleteViews(a.docid, a.sheetId, a.viewIds),
        update_view: (w, a) => w.document.updateView({
            docid: a.docid, sheetId: a.sheetId,
            viewId: a.viewId, viewTitle: a.viewTitle, property: a.property,
        }),
        get_views: (w, a) => w.document.getViews({
            docid: a.docid, sheetId: a.sheetId,
            viewIds: a.viewIds, offset: a.offset, limit: a.limit,
        }),

        // --- 五、智能表格 - 字段 (4) ---
        add_fields: (w, a) => w.document.addFields(a.docid, a.sheetId, a.fields),
        delete_fields: (w, a) => w.document.deleteFields(a.docid, a.sheetId, a.fieldIds),
        update_fields: (w, a) => w.document.updateFields(a.docid, a.sheetId, a.fields),
        get_fields: (w, a) => w.document.getFields({
            docid: a.docid, sheetId: a.sheetId,
            viewId: a.viewId, fieldIds: a.fieldIds,
            fieldTitles: a.fieldTitles, offset: a.offset, limit: a.limit,
        }),

        // --- 六、设置文档权限 (4) ---
        mod_doc_join_rule: (w, a) => w.document.modDocJoinRule(a),
        mod_doc_member: (w, a) => w.document.modDocMember(a),
        mod_doc_safety_setting: (w, a) => w.document.modDocSafetySetting(a),
        get_doc_auth: (w, a) => w.document.getDocAuth(a),

        // --- 七、管理收集表 (5) ---
        create_collect: (w, a) => w.document.createCollect(a),
        modify_form: (w, a) => w.document.modifyForm(a),
        get_form_info: (w, a) => w.document.getFormInfo(a.formid),
        get_form_statistic: (w, a) => w.document.getFormStatistic({
            repeatedId: a.repeatedId, reqType: a.reqType,
            startTime: a.startTime, endTime: a.endTime,
            limit: a.limit, cursor: a.cursor,
        }),
        get_form_answer: (w, a) => w.document.getFormAnswer({
            repeatedId: a.repeatedId, answerIds: a.answerIds,
        }),

        // --- 十、高级功能账号管理 (3) ---
        vip_batch_add: (w, a) => w.document.vipBatchAdd(a.useridList),
        vip_batch_del: (w, a) => w.document.vipBatchDel(a.useridList),
        vip_list: (w, a) => w.document.vipList({ cursor: a.cursor, limit: a.limit }),

        // --- 十一、素材管理 (1) ---
        upload_image: (w, a) => w.document.uploadImage(a.docid, a.base64Content),

        // --- 十二、智能表格 - 记录读 (1) — v1.2.1 新增 ---
        get_records: (w, a) => w.document.getRecords({
            docid: a.docid, sheetId: a.sheetId,
            viewId: a.viewId, recordIds: a.recordIds, keyType: a.keyType,
            fieldIds: a.fieldIds, fieldTitles: a.fieldTitles,
            offset: a.offset, limit: a.limit, ver: a.ver,
            filter: a.filter, sort: a.sort,
        }),

        // --- 十三、智能表格 - 记录 CUD (2) — v1.2.2 新增（access_token 通道）---
        // v1.3.1 补 add_records（与 document_webhook 同名但走 access_token 通道）
        add_records: (w, a) => w.document.addRecords(a.docid, a.sheetId, a.records, a.keyType),
        update_records: (w, a) => w.document.updateRecords(a.docid, a.sheetId, a.records),
        delete_records: (w, a) => w.document.deleteRecords(a.docid, a.sheetId, a.recordIds),

        // --- 十四、智能文档 smartdoc (13) — v1.5.2 新增 ---
        smartdoc_add_block:    (w, a) => w.document.addSmartBlock(a.docid, a.pageId, a.blocks),
        smartdoc_add_grid:     (w, a) => w.document.addSmartGrid(a.docid, a.info),
        smartdoc_add_page:     (w, a) => w.document.addSmartPage(a.docid, a.info),
        smartdoc_get_sources:  (w, a) => w.document.getSmartSources(a.docid),
        smartdoc_get_page_struct: (w, a) => w.document.getSmartPageStructure(a.docid),
        smartdoc_update_block: (w, a) => w.document.updateSmartBlock(a.docid, a.pageId, a.blocks),
        smartdoc_update_grid:  (w, a) => w.document.updateSmartGrid(a.docid, a.info),
        smartdoc_update_page:  (w, a) => w.document.updateSmartPage(a.docid, a.info),
        smartdoc_delete_block: (w, a) => w.document.deleteSmartBlock(a.docid, a.pageId, a.ids),
        smartdoc_delete_grid:  (w, a) => w.document.deleteSmartGrid(a.docid, a.blockId),
        smartdoc_delete_page:  (w, a) => w.document.deleteSmartPage(a.docid, a.pageId),
        smartdoc_publish:      (w, a) => w.document.publishSmartDoc(a.docid, a.publishRange, a.authList),
        smartdoc_cancel_publish: (w, a) => w.document.cancelSmartDoc(a.docid),
        smartdoc_export:       (w, a) => w.document.exportSmartBlock(a.docid, a),

        // --- 十五、智能表格 + 群聊 (3) — v1.5.2 新增 ---
        smart_groupchat_list:    (w, a) => w.document.getSmartGroupChatList(a.docid, a),
        smart_groupchat_get:     (w, a) => w.document.getSmartGroupChat(a.docid, a.chatId),
        smart_groupchat_update:  (w, a) => w.document.updateSmartGroupChat(a.docid, a),

        // --- 十六、智能表格内容权限 (1) — v1.5.2 新增 ---
        smart_content_rule:      (w, a) => w.document.manageSmartContentRule(a.docid, a.type, a.ruleIdList),

        // --- 十七、智能表格 SSOT (4) — v2026-07-26 老板 query 11:04 ---
        list_smart_sheet: (w, a) => {
            const reg = w.document.loadSmartSheetRegistry();
            return { count: reg.count(), sheets: reg.list() };
        },
        search_smart_sheet: (w, a) => {
            const results = w.document.searchSheets({
                name: a?.name,
                tag: a?.tag,
                purpose: a?.purpose,
                docid: a?.docid
            });
            return { count: results.length, matches: results };
        },
        register_smart_sheet: (w, a) => w.document.registerSmartSheet({
            docid: a?.docid,
            sheetId: a?.sheetId,
            name: a?.name,
            purpose: a?.purpose,
            owner: a?.owner,
            tags: Array.isArray(a?.tags) ? a.tags : (typeof a?.tags === 'string' ? a.tags.split(',').map(s => s.trim()) : []),
            notes: a?.notes
        }),
        get_smart_sheet_registry: (w, a) => {
            const reg = w.document.loadSmartSheetRegistry();
            return { _meta: reg._meta, count: reg.count() };
        },
    },

    // ========== 文档 webhook 域（3 个 action）— v1.1.0 第九章独立客户端 ==========
    // 走 webhook URL + key 鉴权，不依赖 access_token
    document_webhook: {
        add_records: async (w, a) => {
            const client = new DocumentWebhook(a.webhookUrl);
            return await client.addRecords(a.records);
        },
        update_records: async (w, a) => {
            const client = new DocumentWebhook(a.webhookUrl);
            return await client.updateRecords(a.records);
        },
        send_raw: async (w, a) => {
            const client = new DocumentWebhook(a.webhookUrl);
            return await client.sendRaw(a.payload);
        },
    },

    // ========== 工具域（业务 5 + meta 5）==========
    utils: {
        // ---- 业务 action ----
        get_token: async (w) => {
            // FIX: 旧 switch 调不存在的 w.auth.getAccessToken()，改调 SDK 基类
            return await w.approval.getAccessToken();
        },
        get_callback_ip: async (w) => {
            // v1.5.2 修复：调 SDK security.getCallbackIpList（路径已修为 /getcallbackip）
            return w.security.getCallbackIpList();
        },
        get_agent_list: (w) => w.app.getAgentList(),
        get_agent: (w, a) => w.app.getAgent(a.agentId),
        // FIX: 旧 switch 调 setAgent(agentData) 漏 agentId，真实签名是 (agentId, {name,...})
        set_agent: (w, a) => w.app.setAgent(a.agentId, {
            name: a.name,
            description: a.description,
            squareLogoUrl: a.squareLogoUrl,
            redirectDomain: a.redirectDomain,
            reportLocationFlag: a.reportLocationFlag,
            isreportenter: a.isreportenter,
            homeUrl: a.homeUrl,
        }),

        // ---- meta action（不走 SDK，CLI 自管）----
        status: () => {
            const cfg = loadConfig();
            const cb = cfg.callback;
            return {
                configured: !!(cfg.corpId && cfg.corpSecret),
                corpId: cfg.corpId || null,
                agentId: cfg.agentId || null,
                callback: cb ? {
                    configured: !!(cb.token && cb.encodingAESKey),
                    port: cb.port || 18790,
                    path: cb.path || '/plugins/wecom-skill/callback',
                    dbPath: cfg.dbPath || '~/.openclaw/state/wecom-events.db',
                } : { configured: false, note: '未配置 — 跑 wecom-cli setup 启用' },
                configPath: CONFIG_PATH,
                skillRoot: SKILL_ROOT,
            };
        },
        test_connection: async () => {
            const w = getWecom();
            return await w.testConnection();
        },
        show_config: () => {
            const cfg = loadConfig();
            return {
                ...cfg,
                configPath: CONFIG_PATH,
                skillRoot: SKILL_ROOT,
            };
        },
        // v1.0.1 添加: setup 也作为 utils.setup 暴露 (SKILL.md 是这么写的)
        // 内部复用顶层 setup() 函数
        setup: () => {
            // 返回特殊标记让 main() 走 setup 流程
            return { __invoke_setup__: true };
        },
    },

    // ========== events 域（v1.2.0 新增）— 读 wecom-events.db 历史 ==========
    events: {
        list: (w, a) => {
            const store = getEventsStore();
            return {
                ok: !store.__db_error,
                db_error: store.__db_error || null,
                events: store.list({
                    changeType: a.changeType,
                    docId: a.docId,
                    since: a.since,
                    limit: a.limit || 50,
                }),
            };
        },
        get: (w, a) => {
            const store = getEventsStore();
            return store.get(a.id);
        },
        stats: (w, a) => {
            const store = getEventsStore();
            return {
                ok: !store.__db_error,
                db_error: store.__db_error || null,
                by_change_type: store.stats({ since: a.since }),
            };
        },
        // tail: poll 模式（v1.2.0 不实现，留 v1.2.1）
    },

    // ========== daemon 域（v1.2.0 新增）— systemd --user 包装 ==========
    daemon: {
        status: () => {
            const r = { active: false, listening_18790: false, db_path: EVENTS_DB_PATH, db_exists: false, last_event_at: null };
            try {
                r.active = execSync('systemctl --user is-active wecom-skill-daemon', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() === 'active';
            } catch (e) { r.active = false; r.systemctl_error = e.message; }
            try {
                r.listening_18790 = execSync('ss -tlnp 2>/dev/null | grep -E ":18790\\s" || true', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().length > 0;
            } catch (e) { /* ignore */ }
            try {
                r.db_exists = require('fs').existsSync(EVENTS_DB_PATH);
            } catch (e) { /* ignore */ }
            if (r.db_exists) {
                const store = getEventsStore();
                const stats = store.stats({ since: 0 });
                if (stats.length > 0) r.last_event_at = stats[0].last_seen;
            }
            return r;
        },
        start: () => execSync('systemctl --user start wecom-skill-daemon').toString(),
        stop: () => execSync('systemctl --user stop wecom-skill-daemon').toString(),
        restart: () => execSync('systemctl --user restart wecom-skill-daemon').toString(),
        logs: (w, a) => {
            const n = a.n || 50;
            return execSync(`journalctl --user -u wecom-skill-daemon -n ${n} --no-pager`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        },
    },
};

// ============================================================
// 主流程
// ============================================================
async function main() {
    if (!domain) {
        return printHelp();
    }
    if (domain === 'help' || domain === '--help' || domain === '-h') {
        return printHelp();
    }
    if (domain === 'setup') {
        return runSetup();
    }

    const domainCmds = COMMANDS[domain];
    if (!domainCmds) {
        throw new Error(`未知 domain: ${domain}\n可用 domain: ${Object.keys(COMMANDS).join(', ')}`);
    }
    if (!action) {
        return {
            domain,
            available_actions: Object.keys(domainCmds),
            usage: `wecom-cli ${domain} <action> --args '<json>'`,
        };
    }
    let fn = domainCmds[action];
    // 支持别名映射（字符串指向主名称，如 getCheckInRules → get_checkin_rules）
    if (typeof fn === 'string') fn = domainCmds[fn];
    if (!fn) {
        throw new Error(`未知 action: ${domain} ${action}\n可用 action: ${Object.keys(domainCmds).join(', ')}`);
    }

    // meta action（status / test_connection / show_config）不需要 corpId
    const isMeta = ['status', 'show_config'].includes(action);

    if (!isMeta) {
        try {
            const cfg = loadConfig();
            if (!cfg.corpId || !cfg.corpSecret) {
                throw new Error(`未配置 corpId/corpSecret。请运行: wecom-cli setup\n或加 --config config-1000040.json 指定其他应用`);
            }
        } catch (loadErr) {
            if (isJsonMode) {
                // P3 升级 (2026-07-26): 错误 JSON 走 stdout, 绕开 logger 抑制
                process.stdout.write(JSON.stringify({ ok: false, error: loadErr.message }, null, 2) + '\n');
                return;
            }
            throw loadErr;
        }
    }

    const w = isMeta ? null : getWecom();
    let result = await fn(w, userArgs);

    // v1.0.1: utils.setup 走 setup 流程
    if (result && result.__invoke_setup__) {
        return runSetup();
    }

    if (isJsonMode) {
        // P3 升级 (2026-07-26): JSON 输出走 stdout, 绕开 logger.setEnabled(false)
        process.stdout.write(JSON.stringify({ ok: true, domain, action, data: result }, null, 2) + '\n');
    } else {
        log.info(JSON.stringify(result, null, 2));
    }
}

function printHelp() {
    const help = {
        name: 'wecom-cli',
        version: '1.0.0',
        description: '企业微信 OpenClaw Skill CLI',
        usage: 'wecom-cli <domain> <action> --args \'<json>\' [--json]',
        domains: Object.fromEntries(
            Object.entries(COMMANDS).map(([d, cmds]) => [
                d,
                Object.keys(cmds).map(a => {
                    const isMeta = ['status', 'show_config'].includes(a);
                    return isMeta ? `${a} (meta)` : a;
                }),
            ])
        ),
        meta_commands: ['setup (交互式配置)', 'status (查看配置)', 'test_connection (测试连接)', 'show_config (完整配置)'],
        examples: [
            'wecom-cli utils status --json',
            'wecom-cli utils test_connection --json',
            'wecom-cli customers get_customer_list --args \'{"userId":"ZhangSan"}\' --json',
            'wecom-cli contacts get_department_list --json',
            'wecom-cli approval get_approval_list --args \'{"startTime":1717200000,"endTime":1717286400}\' --json',
            'wecom-cli meeting create_meeting --args \'{"userId":"ZhangSan","topic":"周会","startTime":1718000000,"endTime":1718003600}\' --json',
        ],
    };
    log.info(JSON.stringify(help, null, 2));
}

// ============================================================
// 交互式配置（参考 phoneerp 的 setup 流程）
// v1.2.0 改造：必填段（corpId/secret/agentId）+ 可选 callback 段（y/n）
// ============================================================
function runSetup() {
    if (!isJsonMode) {
        log.info('📝 企业微信配置向导 v1.2.0');
        log.info('说明：依次输入必填项（corpId/secret/agentId），再问是否启用事件回调接收。');
        log.info('获取方式：企业微信后台 → 我的企业/应用管理');
        log.info('');
    }

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const current = loadConfig();

    const prompts = [
        { key: 'corpId', label: '企业ID (corpId)', required: true },
        { key: 'corpSecret', label: '应用 Secret (corpSecret)', required: true, secret: true },
        { key: 'agentId', label: '应用 AgentID', required: true },
    ];

    const newConfig = { ...current };
    let i = 0;

    function askNext() {
        if (i < prompts.length) {
            const p = prompts[i++];
            const defaultVal = current[p.key] || '';
            const hint = defaultVal ? ` [当前: ${p.secret ? '***' : defaultVal}]` : '';
            rl.question(`${p.label}${hint}: `, (answer) => {
                const trimmed = answer.trim();
                if (!trimmed && p.required) {
                    log.info(`❌ ${p.label} 不能为空，请重新输入`);
                    i--;
                    return askNext();
                }
                if (trimmed) newConfig[p.key] = trimmed;
                else if (defaultVal) newConfig[p.key] = defaultVal;
                askNext();
            });
            return;
        }
        // ========== v1.2.0 新增：可选 callback 段 ==========
        const cbDefault = current.callback ? 'y' : 'N';
        rl.question(`\n启用企业微信事件回调接收？[y/N] (默认 ${cbDefault}): `, (answer) => {
            const yn = (answer.trim() || cbDefault).toLowerCase();
            if (yn === 'y' || yn === 'yes') {
                askCallback(rl, newConfig, current);
            } else {
                delete newConfig.callback;  // 用户明确不要 callback
                finishSetup(rl, newConfig);
            }
        });
    }

    function askCallback(rl, newConfig, current) {
        const cb = newConfig.callback = { ...(current.callback || {}) };
        // token
        const tokenDefault = cb.token || '';
        rl.question(`回调 Token (43字符内的随机串)${tokenDefault ? ' [当前: ***]' : ''}: `, (a) => {
            cb.token = a.trim() || tokenDefault;
            if (!cb.token || cb.token.length > 64) {
                log.info('❌ Token 必填且 ≤64 字符');
                return askCallback(rl, newConfig, current);
            }
            // encodingAESKey
            const aesDefault = cb.encodingAESKey || '';
            rl.question(`回调 EncodingAESKey (43字符 base64)${aesDefault ? ' [当前: ***]' : ''}: `, (a) => {
                cb.encodingAESKey = a.trim() || aesDefault;
                if (!cb.encodingAESKey) {
                    log.info('❌ EncodingAESKey 必填');
                    return askCallback(rl, newConfig, current);
                }
                if (cb.encodingAESKey.length !== 43) {
                    log.info(`⚠️  EncodingAESKey 长度 = ${cb.encodingAESKey.length}（期望 43）`);
                }
                // port
                const portDefault = cb.port || 18790;
                rl.question(`daemon 端口 [默认 ${portDefault}]: `, (a) => {
                    const p = parseInt(a.trim() || portDefault, 10);
                    if (isNaN(p) || p < 1024 || p > 65535) {
                        log.info('❌ 端口必须是 1024-65535 数字');
                        return askCallback(rl, newConfig, current);
                    }
                    cb.port = p;
                    // path
                    const pathDefault = cb.path || '/plugins/wecom-skill/callback';
                    rl.question(`回调 URL 路径 [默认 ${pathDefault}]: `, (a) => {
                        cb.path = (a.trim() || pathDefault);
                        finishSetup(rl, newConfig);
                    });
                });
            });
        });
    }

    askNext();
}

function finishSetup(rl, newConfig) {
    rl.close();
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf8');
        try { fs.chmodSync(CONFIG_PATH, 0o600); } catch (e) { log.warn('[wecom-skill] 无法设置 config.json 权限 0o600:', e.message); }
        const msg = {
            ok: true,
            message: '✅ 配置已保存',
            configPath: CONFIG_PATH,
            configured: !!(newConfig.corpId && newConfig.corpSecret),
            callback_configured: !!(newConfig.callback && newConfig.callback.token && newConfig.callback.encodingAESKey),
        };
        log.info(JSON.stringify(msg, null, 2));
    } catch (e) {
        log.error('❌ 配置保存失败:', e.message);
        process.exit(1);
    }
}

// ============================================================
// 入口
// ============================================================
main().catch((err) => {
    if (isJsonMode) {
        // P3 升级 (2026-07-26): JSON 错误输出走 stdout, 绕开 logger 抑制
        process.stdout.write(JSON.stringify({ ok: false, error: err.message, stack: err.stack }, null, 2) + '\n');
    } else {
        log.error('❌', err.message);
        if (process.env.WECOM_DEBUG) log.error(err.stack);
    }
    process.exit(1);
});
