---
name: wecom-skill
description: "企业微信 API（v1.5.2）。覆盖 12 域：客户/标签/客户群/客户统计、通讯录、审批/假期、会议、打卡、汇报、日程、文档/表格/智能表格/收集表、智能表格 webhook、凭证/应用、daemon 回调事件、wedoc 事件历史。触发词：「查客户」「加标签」「查部门」「查审批」「创建会议」「查打卡」「建日程」「新建文档」「编辑表格」「推数据到智能表格」「daemon 状态/日志」。⚠️ 写操作（创建/删除/修改）需用户明确确认后再执行。"
---

# wecom-skill — 企业微信 API（pure skill，v1.5.2）

## 🧭 TL;DR + 目录导航 (v2026-07-26 添加)

**核心入口**：Node.js SDK `new Wecom(config)` 后 `w.<domain>.<action>()` 可调 37 个模块、600+ 方法。

**CLI 入口**（agent 推荐）：`node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js <domain> <action> --args '<json>' --json`

**核心 SOP**（重要铁律）：
- ✅ 走 `wecom-cli.js` 而非 inline script（per 7-15 老板确立）
- ✅ schema 字段以企微官方文档为准，严谨臆造
- ✅ 所有审批/客户推送需走 `phoneerp.lookupEmployee()` 校验身份（per 跨系统身份识别协议）
- ✅ daemon 主动 `logger.info()` 报告配置（避免沉默失败）
- ✅ 单测用真实 SDK fixture，不用 mock（per SOP-6）
- ✅ 枚举映射必须 100% 覆盖 SDK 文档所有值 + safe fallback（per SOP-7）

**快速导航**（按 agent 阅读频次排序）：

| 章节 | 内容 | agent 频次 |
|---|---|---|
| 📌 agent 调用规范 | CLI 入门 / 错误字段名警告 | ⭐⭐⭐⭐⭐ |
| 🔐 跨系统员工身份识别协议 | phoneerp.lookupEmployee() 必查 | ⭐⭐⭐⭐⭐ |
| ### approval（审批） | 23 methods + 模板管理 SSOT | ⭐⭐⭐⭐⭐ |
| 📘 开发 SOP | 调试/单测/SDK 上传/错误恢复 | ⭐⭐⭐⭐ |
| 🗺️ 枚举 mapping SSOT | 4 个 module + safe fallback | ⭐⭐⭐⭐ |
| ### customers / contacts | 客户 / 通讯录 | ⭐⭐⭐⭐ |
| ### meeting / checkin / journal | 会议 / 打卡 / 汇报 | ⭐⭐⭐ |
| ### schedule / document | 日程 / 文档 | ⭐⭐ |
| ### utils / daemon / events | 工具 / 进程 / 事件 | ⭐⭐ |
| 其他 36 模块 | `sdk/modules/<name>/index.js` | 按需 |

**报庆 / 调试查询**：
- daemon 不在跑？ → `systemctl --user status wecom-skill-daemon`
- 代理 407 错误？ → `npm test` 看 case 17 （debug-log）
- 调试快照位置？ → `/opt/openclaw/state/wecom-approval-debug/`
- 跨会话依赖联调？ → `docs/approval-templates.json` (33 模板 SSOT)

### 📋 33 个本地已知审批模板索引 (v2026-07-26 添加)

> **作用**：agent 调用 `search_templates --args '{"name":"请假"}'` 或查 docs/approval-templates.json 之前，先看本地是否已落盘。如果你在下面表格里看到，直接用 template_id 调 submit_approval。

| group | templates |
|---|---|
| 零售管理 (3) | 赠品申请 / 陈列巡检 / 二手机回收登记 |
| 财务 (12) | 垫支清单 / 采购付款 / 商务打款 / 发票 / 报销申请 / 客户退款申请 / 备用金申请 / 备用金核销 / 紧急付款流程 / 订货申请 / 借款 / 借款归还 |
| **人事 (10)** | 入职申请 / 转正申请 / 调动申请 / 离职申请 / 外出 / **请假** / 加班 / 打卡补卡 / 审批打卡 / 调班 |
| 行政 (4) | 用章 / 用车 / 物品领用 / 物品维修 |
| 其他 (4) | 门店水电费付款申请 / 退款给客户 / 高级功能申请 / 申请创建长连接方式机器人 |

**常见搜索示例**：
- `请假` → 人事组 → 请假 (template_id 见 docs/approval-templates.json)
- `报销` → 财务组 → 报销申请
- `退款` → 财务组 → 客户退款申请 / 退款给客户 (2 个)
- `加班` → 人事组 → 加班

**增补流程**：老板后台新增/删除模板后，改 `docs/approval-templates.json` + 跑 `npm test` (validator 自动校验) + commit。

**写操作原则**：⚠️ 所有带 ⚠️ 的 action 需老板明确确认后再执行（按 SKILL.md 顶部 description）。

---


## 📌 agent 调用规范 (2026-07-15 老板确立)

⚠️ **gewe / inline agent 必读** — 避免 BUG 复发 (按 MemOS fact 2026-06-22 13:14 / 2026-06-22 15:01)：

- ✅ **必须走 `wecom-cli.js <domain> <action> --args '<json>'`** 而不是 inline python3
- ✅ **schema 字段以企微官方文档为准**，**严禁臆造字段名**（如 `new_external_count` 应为 `new_contact_cnt`）
- ❌ **禁止 inline python + sqlite3 直查 events 表**（绕过后丢失字段映射完整性）
- ✅ 直查 events 表仅允许在以下场景：debug 且 schema 已知

### ⚠️ 严禁使用 inline script 二次解析 wecom-cli 输出 (2026-07-26 负责人立)

2026-07-26 gewe channel 实测事故：**gewe agent 用 `wecom-cli ... | jq | python3 -c ...` 管道链**，inline script 失败触发 OpenClaw 工具错误警告 `⚠️ 🛠️ Exec failed: wecom-cli ... -> run python3 inline script (+2 steps)` 发到老板微信。

**绝对禁止**：
- ❌ `wecom-cli customers get_user_client_stat --args '{"userid":"X"}' | jq '.data'` — 用 jq 二次过滤
- ❌ `wecom-cli ... | node -e 'console.log(...)'` — inline node 解析
- ❌ `wecom-cli ... | python3 -c 'import json; ...'` — inline python 解析（这条 7-15 已立，仍旧强化）
- ❌ `wecom-cli ... | grep | sed | awk | head` — 任何 shell 二次处理
- ❌ `> /tmp/x.json && cat /tmp/x.json | ...` — 临时文件中转 + 二次处理

**正确做法**（二选一）：
- ✅ **直接传递 stdout JSON**：调用 wecom-cli 后，**直接把 stdout 当 JSON 解析**（read tool / output 字段），不要再走管道
- ✅ **加 wecom-cli 自身参数**：扩展 `wecom-cli` 的 `<domain>/<action>` 或参数，而不是二次解析

**配合 `messages.suppressToolErrors: true`** (2026-07-26 openclaw.json 配置)：即使触发工具错误也不会发到 gewe channel，但根本解决方案是不用 inline script。

**wecom-cli 输出已是结构化 JSON**（`{ok, domain, action, data, meta}`），无需二次解析。

## 📌 错误字段名警告 (wecom-cli.js v1.5.2 修复记录)

⚠️ **`weekly_behavior` action 字段映射踩过的坑**（必读, 防止 agent 用错）：

| 错误字段名（v1.5.2 之前）| 正确字段名（企微官方）| 修复 commit |
|---|---|---|
| ❌ `new_external_count` | ✅ `new_contact_cnt` | `281ce8a` |
| ⚠️ `chat_count`（聚合名）| 响应中叫 `chat_cnt`，聚合名 OK | — |
| ⚠️ `message_count`（聚合名）| 响应中叫 `message_cnt`，聚合名 OK | — |

## 📌 客户数据获取分层规则（强制规则，2026-07-16 确立）

| 时间范围 | 数据源 | 强制规则 |
|---|---|---|
| **当天（今天）** | events 表（`daily_user_changes` / 直查 events 表） | ✅ 必须走 events |
| **昨天 ~ 180 天前** | wecom API（`weekly_behavior` / `get_user_client_stat`） | ✅ 必须走 API |
| > 180 天前 | ❌ 不可查 | 企业微信硬性限制 |
| 业务数据（零售/库存） | phoneerp 本地库 | 已同步 2025-06-01 ~ 2026-06-30 |

**强制要求**：历史数据查询严禁走 events 表，必须走 API。当日数据严禁走 API（数据未更新），必须走 events 表。违者视为 BUG。

【查询前自检 SOP】
1. 判断时间范围 → 锁定数据源（events 或 API）
2. 查今天员工行为 → events 表
3. 查昨天及更早 → wecom API
4. 查历史经营数据 → phoneerp

> **调用格式**：`node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js <domain> <action> --args '<json>' [--json]`
>
> **消息发送**：发消息走 `message` 工具（channel=wecom），不走本 skill。

---

## 🔐 跨系统员工身份识别协议（2026-07-16 负责人立 — 必读）

本 skill 在以下场景 **必须先查员工身份**，不走推断 / 记忆 / 临时映射：

1. **回调事件入库**（`change_external_contact` / `sys_approval_change` 推送）— 需查实际申请人 userid 对应中文名、部门
2. **查客户列表**（`get_customer_list` 等需要 `creator` / `follower_userid`）— 需查谁负责
3. **查通讯录**（`get_department_user` / `get_user`）— 需查名字反查 userid
4. **审批推送场景** — `apply_user = pending` 的员工严禁进入推送队列

### 1. 唯一身份源（SSOT）

**只读** `/opt/openclaw/credentials/phoneerp-access-roles.json`。

**严禁**:
- ❌ 本地新建任何 wxid→name / userid→name 映射表
- ❌ 从 events 表 raw_xml 的 `FromUserName='sys'` 推"谁是申请人"——那是系统账号，不是申请人
- ❌ 从中文名/微信昵称反推 userid

### 2. lookup API 调用样板

```js
import { execFileSync } from 'node:child_process';
const out = JSON.parse(execFileSync('node', [
  '/opt/openclaw/skills/phoneerp/scripts/lookup_employee.js',
  '--wecomUserid', applyUserId, '--json'
]).toString());

if (!out.ok || !out.match) {
  // 跳过本事件并推送 "unmapped user" 警告
}
if (out.match.record.wecom_userid === 'pending') {
  // 跳过本事件
}
// out.match.record 即完整条目, 含 name/store/role/employeeId
```

### 3. 处理档位（与 phoneerp 一致）

| 命中 | 行为 |
|---|---|
| `exact` + `confirmed` | ✅ 放行 |
| `exact` + `wecom_userid='pending'` | ⚠️ 跳过推送 + 记 warning（老板查实后手动补字段）|
| `fuzzy` | ⏸️ 返回"模糊匹配 N 个,请人工确认" |
| `none` | 🚫 返回 "unmapped user: <id>" + 不调任何 wecom API |

### 4. 协议执法点（本 skill 强约束）

- **所有审批 / 客户事件回调处理器**：接收 userid 后，先 lookup，再决定要不要入库 / 推送
- **所有"查人"API 调用**：入参 userid 必须先 lookup 校验存在
- **所有推送场景**（apply_user 通知 / 客户归属变更提醒）：lookup 出 pending → **不发**，记 warning
- **通讯录刷新**：`addressbook.getUser()` 24h cache 已覆盖常见路径，但**对未命中 userid** 仍要走 lookup 校验是否在 SSOT 登记

### 5. 当前已落地场景（2026-07-16 修复后）

- ✅ `bin/event-router.js#resolveApplyUser`（commit `c74fc18`）— 审批推送改取 `ApprovalInfo.Applyer.UserId` 而非 `payload.FromUserName='sys'`
- ✅ `addressbook` 24h cache — 通讯录 name/department 查询
- ⚠️ **未走 lookup** 的场景：所有需要 `creator` / `follower_userid` 中文化的 list 接口——后续按需加固

### 6. 详细协议（单一信任源版）

完整协议 + 变更流程见 [phoneerp SKILL.md § 跨系统员工身份识别协议](../phoneerp/SKILL.md)（同源一致）。

---

## 架构概览

```
企业微信服务器
    ↓ HTTPS POST /plugins/wecom-skill/callback（加密 XML）
1Panel Nginx 反代 → 127.0.0.1:18790
    ↓
wecom-skill daemon（systemd: wecom-skill-daemon.service）
    ↓ 验签 + 解密 + 入库 events 表（SQLite）
    ↓ 同时触发 event-router handlers
    ├─ sys_approval_change → 实时推老板企业微信（JieXiaoYin）
    ├─ change_type（create_user / update_user / delete_user）→ flushCache（通讯录缓存失效）
    └─ add_external_contact → sendWelcomeMessage（新人欢迎语）
```

- **Daemon 进程**：PID 独立，systemd 管理，`systemctl --user restart wecom-skill-daemon` 重启
- **数据库**：`~/.openclaw/state/wecom-events.db`（SQLite）
- **待推送文件**：`~/.openclaw/state/wecom-approval-pending.json`（实时推送失败时的 fallback）
- **日志**：`journalctl --user -u wecom-skill-daemon -f`

## 域与常用 actions

> ⚠️ 标记 action 需要用户明确确认后再执行。

### customers（客户）

| action | 必需参数 | 说明 |
|---|---|---|
| `get_customer_list` | `userId` | 读取跟进客户列表 |
| `get_customer_detail` | `userId`, `externalUserId` | 客户详情 |
| `get_all_customers` | `userid` | 全部客户（含跟进信息）|
| `update_customer_remark` ⚠️ | `userId`, `externalUserId`, `remark?` | 修改客户备注 |
| `get_corp_tags` | — | 客户标签列表 |
| `add_corp_tag` ⚠️ | `groupId`, `tagName` | 新增客户标签 |
| `mark_customer_tag` ⚠️ | `externalUserId`, `tagIds[]`, `userid` | 打标签/移除标签 |
| `get_groupchat_list` | `cursor?`, `size?=100` | 客户群列表 |
| `daily_report` | `date?`, `resolve?=true` | **今日客户日报**（老板专用, 仅老板可见）|
| `daily_user_changes` | `date?` | **员工每日通讯录变更审计**（events, 老板专用）|
| `approval_stats` | `date?`, `max_detail?=100`, `detail?=false` | **审批效率分析**（API 实时, 老板专用）|
| `weekly_behavior` | `start_date?` (下划线!), `end_date?` | **员工周行为汇总**（API, 老板专用; 默认上周周一~周日）|

| `get_groupchat` | `chatId` | 客户群详情 |

### contacts（通讯录 / 部门 / 成员）

| action | 必需参数 | 说明 |
|---|---|---|
| `get_department_list` | `departmentId?` | 部门列表 |
| `get_user_list` | `departmentId?=1`, `fetchChild?=false` | 部门成员 ID 列表 |
| `get_department_users_detail` | `departmentId?=1`, `fetchChild?=false` | 部门成员详情（含缓存）|
| `get_user` | `userId` | 成员详情 |
| `get_user_by_mobile` | `mobile` | 手机号查成员 |
| `flush_cache` | — | **手动刷新通讯录缓存**（P0-1）|
| `create_user` ⚠️ | `userData{userId,name,mobile,email,department}` | 新建成员 |
| `update_user` ⚠️ | `userData` | 更新成员 |
| `delete_user` ⚠️ | `userId` | 删除成员 |

> `flush_cache` 会清空内存缓存（`_userCache` / `_deptCache` / `_userDetailCache`），下次调用自动重新拉取。

### approval（审批）

#### 基础 actions（CLI 外接）

| action | 必需参数 | 说明 |
|---|---|---|
| `get_approval_list` | `startTime`, `endTime` | 审批列表 |
| `get_approval_detail` | `sp_no`（number）| 审批详情 |
| `get_template_detail` | `templateId` | 审批模板 |
| `submit_approval` ⚠️ | `templateId`, `callerUserid`, `content{...}` | 提交审批 |
| `find_bottlenecks` | `startTime`, `endTime` | 审批卡点分析 |
| `list_templates` | `group?` | 列出本地 33 个模板 (按 group 过滤可选) |
| `search_templates` | `name` | **模糊查模板** (如 {"name":"请假"}) |
| `sync_templates` | `templateIds?`, `concurrency?`, `writeBack?` | SDK 拉企微后台 (默认并发 5) |
| `diff_templates` | `templateIds?` | 对比本地 docs vs 企微后台 |

#### 完整 SDK API（v1.5.2 + v2026-07-26 添加）— `w.approval.xxx()`

**v1.5.2 已有（19 methods）**：

| 方法 | 必需参数 | 说明 |
|---|---|---|
| `getApprovalIds(startTime, endTime, cursor, size, filters)` | `startTime, endTime` | 拉审批 ID 列表，支持服务端过滤 (sp_status/record_type/template_id/creator/department) |
| `getApprovalDetail(spNo)` | `spNo` | 拉审批详情（含控件值） |
| `getApprovalInfo(spNoList)` | `spNoList` (array) | 批量拉详情 |
| `getApprovalCallbackList(startTime, endTime)` | `startTime, endTime` | 回调拉取（v1.5.1+） |
| `getCorpApprovalData(startTime, endTime)` | `startTime, endTime` | 企业级审批数据 |
| `getOpenApprovalData(startTime, endTime)` | `startTime, endTime` | 上下游审批数据 |
| `getApprovalProcess(templateId)` | `templateId` | 拉审批流的申请人/审批人/抄送人 |
| `setApprovalProcess(templateId, process)` | `templateId, process` | 设置审批流 |
| `getLeaveConfig()` | - | 请假配置 |
| `getLeaveBalance(userId, leaveType)` | `userId, leaveType` | 请假余额 |
| `updateLeaveBalance(userId, leaveType, balance)` | 3 个 | 更新余额 |
| `createTemplate(params)` | `params` | 创建模板 (按 97437, `POST /oa/approval/create_template`) |
| `updateTemplate(templateId, params)` | `templateId, params` | 更新模板 (按 97438, `POST /oa/approval/update_template`) |
| `getApprovalDetail(spNo)` | `spNo` | 拿审批详情 (按 91983, `POST /oa/getapprovaldetail`, 8:18 集成在推送里) |
| `getTemplateDetail(templateId)` | `templateId` | 拉模板详情 |
| `findBottlenecks({startTime, endTime, spStatus})` | 范围 | 审批卡点（v1.5.1+） |
| `submitApproval(params)` | `params` | 提交审批应用（v1.3.1 高层/原生双格式） |
| `buildVacationValue({leaveTypeId, startTime, endTime, leaveTypeName?})` | 时间戳 | 构建 Vacation 控件 value (v2026-07-26 12:21 重构, 真实 SDK 结构) |
| `buildMoneyValue({new_money})` | `new_money` | Money 控件 value 构造器 (v2026-07-26 13:17, new_money 转字符串) |
| `buildSelectorValue({type, options})` | `options[]` | Selector 控件 value 构造器 (v2026-07-26 13:17, options 简/详补全) |
| `buildNumberValue({number})` | `number` | Number 控件 value 构造器 (v2026-07-26 13:17) |
| `submitLeaveRequest({templateId, creator, leaveTypeId, startTime, endTime, reasonText?})` | 5 必填 | 请假一站式 (自动 get_template_detail + buildVacationValue + submitApproval) |
| `submit({template, caller, data})` | `template`+中文标题 data | 通用提交 helper (v2026-07-26 13:17, 按模板名或 templateId + 中文标题映射) |
| `batchWithDetails({...})` | 通用批量 | 继承自 sdk/sdk.js |
| `downloadJournal(params)` | `params` | 拉汇报记录 |

**v2026-07-26 新增（4 个，按老板 query 完成）**：

| 方法 | 必需参数 | 说明 |
|---|---|---|
| `listTemplates()` | - | 平铺列出本地 33 个模板 `[{group, name, template_id}]` |
| `listTemplatesByGroup()` | - | 按组结构列出 (用于 UI/文案) |
| `syncApprovalTemplates({templateIds, concurrency, controlsOnly, writeBack})` | options | SDK 拉企微后台详情：默认读本地 33 IDs + 并发 5 + 串行结果（含控件 + names） |
| `diffApprovalTemplates({templateIds, formatOutput})` | options | 对比本地 docs/approval-templates.json vs 企微后台（返回人类可读文本 或 object） |

**调用模式**：

```js
const W = require('wecom-skill');
const w = new W(config);

// 1. 列出本地已知模板
const flat = w.approval.listTemplates();  // 33 条

// 2. 同步企微后台最新结构 (默认并发 5, 33 个约 2 秒)
const results = await w.approval.syncApprovalTemplates({ controlsOnly: true });

// 3. 需写回本地时
await w.approval.syncApprovalTemplates({ concurrency: 10, writeBack: true });

// 4. diff 本地 vs 企微后台
const text = await w.approval.diffApprovalTemplates({
  templateIds: ['ZvmCpXs4hn77FPJQvWgGxE8cJ7kewaye6SUJH5']  // 客户退款
});
```

#### 通用 submit helper (v2026-07-26 13:17 老板 query B)

**场景**：不需记 template_id + 不需手填 每个控件 id — 只需选起名字 + 中文标题。

```js
const W = require('wecom-skill');
const w = new W(config);

// 例 1: 请事假 (按模板名 + 中文标题 data)
const r = await w.approval.submit({
  template: '请假',
  caller: 'JieXiaoYin',
  data: {
    '请假类型': { leaveTypeId: 2, leaveTypeName: '事假', startTime: 1753574400, endTime: 1753833600 },
    '请假事由': '外出学习',
    '申请人': 'JieXiaoYin',
  },
});

// 例 2: 退款给客户 (选填金额自动转字符串)
await w.approval.submit({
  template: '退款给客户',
  caller: 'JieXiaoYin',
  data: { '退款给': '客户张某某', '退款金额': 1.00, '退款备注': '...' },
});

// 例 3: 用 templateId (避免名字重名)
await w.approval.submit({
  template: { templateId: '3WLJ7G9TU6FbSJRVSSnkkZEr67rJN4eM959MXZbL' },
  caller: 'JieXiaoYin',
  data: { '退款给': '...', '退款金额': 0.01 },
});
```

**v2026-07-26 13:17 覆盖的 6 控件**：
- Text / Textarea → `{ text: "..." }`
- Money → `{ new_money: "1.00" }` (字符串化)
- Number → `{ new_number: "3" }`
- Selector → 简选 (传字符串) 或详选 (传 { key, value:[...] })
- Vacation → 需传 `{ leaveTypeId, leaveTypeName, startTime, endTime }`

**其余 12 控件** (`File/Date/Table/Attendance/Onboarding/Regularization/Resignation/Transfer/RelatedApproval/Location/PunchCorrection/SwitchSchedule`) → 透传 raw value，调用方自己构造 value 结构。

CLI：

```bash
node bin/wecom-cli.js approval submit --args '{
    "template":"请假",
    "callerUserid":"JieXiaoYin",
    "data": {
        "请假类型": { "leaveTypeId":2, "leaveTypeName":"事假", "startTime":1753574400, "endTime":1753833600 },
        "请假事由": "外出学习",
        "申请人": "JieXiaoYin"
    }
}' --json
```

#### 请假一站式调用 (v2026-07-26 12:21 重建)

**SDK helper 自动搞定：**
- get_template_detail 拿 Vacation / Textarea 控件 ID
- buildVacationValue 依腍 WxJava 真实 SDK 结构构造 (避免 301025 / 301057)
- submitApproval 提交（SDK 11:40 auto-fill control 字段）

```js
const W = require('wecom-skill');
const w = new W(config);

// 请事假 7-27 到 7-29 (3 天)
const r = await w.approval.submitLeaveRequest({
  templateId: 'C4Ramzh8A3FGmQvzq1HDv9nqnwu5rqSRRNULTxReQ',  // 请假模板
  creator: 'JieXiaoYin',
  leaveTypeId: 2,  // 事假
  // ⚠️ startTime/endTime 必项是 UTC 中譾表 CST 0:00 对齐的秒数
  // CST 7-27 0:00 = Math.floor(Date.UTC(2026, 6, 26, 16, 0, 0) / 1000) = 1753574400
  startTime: 1753574400,
  // CST 7-30 0:00 = Math.floor(Date.UTC(2026, 6, 29, 16, 0, 0) / 1000) = 1753833600
  endTime: 1753833600,
  reasonText: '外出学习',
  leaveTypeName: '事假',  // 默认 '事假'
});
// → sp_no=202607260010 ✅ (老板 12:16 验证)
```

CLI 例子：

```bash
node bin/wecom-cli.js approval submit_leave_request --args '{
    "templateId":"C4Ramzh8A3FGmQvzq1HDv9nqnwu5rqSRRNULTxReQ",
    "callerUserid":"JieXiaoYin",
    "leaveTypeId":2,
    "leaveTypeName":"事假",
    "startTime":1753574400,
    "endTime":1753833600,
    "reasonText":"外出学习"
}' --json
```

#### 审批模板管理 SSOT (v2026-07-26)

**架构**：本地 JSON 是 SSOT（因为企微 API 不提供 list 接口）。

```
docs/approval-templates.json          ← 真实数据 (33 模板, 5 组)
docs/approval-templates.schema.json   ← JSON Schema (Draft-07)
sdk/utils/templates-loader.js         ← loadApprovalTemplates() 默认 validate=true
sdk/utils/templates-validator.js      ← zero-deps schema 校验
sdk/utils/templates-diff.js           ← diff 工具
```

**schema 校验规则**（5 条）：
1. 顶层必须是 object
2. 每个非 `_` 开头 key 必须是 array
3. 每个 item 必须有 `name` + `template_id`
4. `template_id` 必须匹配 `^[a-zA-Z0-9_-]{8,64}$`
5. **同 JSON 内 template_id 必须唯一**

**变更流程**（老板后台增删模板后）：
1. 老板从企微 admin 后台 HTML 解析出新模板 ID + 名称
2. 按 5 组分组，手工添加或修改 `docs/approval-templates.json`
3. 跑 `npm test` → validator 自动校验（如果格式错就会报错）
4. 如需更新控件结构：跑 `w.approval.syncApprovalTemplates({writeBack: true})`，会自动添加 `controls` 字段到每条 item
5. 老板 commit + push（推 dev→deploy）

**⚠️ 老板后台变更同步策略**：
- 本地 docs 是手维护或 `writeBack` 自动同步
- 如发现后台改过但本地未同步：跑 `w.approval.diffApprovalTemplates()` 看变更

#### 审批推送调试 SOP

**调试快照路径**：`/opt/openclaw/state/wecom-approval-debug/`
- 文件名格式 `SP_NO-hrtime.bigint().json`
- 含 raw request + error info
- FFO 保留最近 **20 个** (老板 query 2026-07-26 08:33 fix)

| `w.security` | `w.security.encrypt()` | 安全 |
| `w.auth` | `w.auth.getAccessToken()` | 凭证 |
| `w.callback` | `w.callback.handle(req, res)` | 回调 |
| `w.checkin_rules` | `w.checkin_rules.getRule()` | 打卡规则 |
| `w.contact_stats` | `w.contact_stats.getUserStat()` | 通讯录统计 |
| `w.messenger` | `w.messenger.sendWelcome()` | 欢迎语 |
| `w.msgaudit` | `w.msgaudit.getAuditList()` | 消息存档 |
| `w.notify` | `w.notify.setBot()` | 通知 |
| ... (其他 11 个模块) | | 详见 `sdk/index.js` |

**入参格式**：所有 SDK 方法都是 `Promise`。老板偏好 **Node.js 一致**，不混 python 或 inline script（per SOUL.md "Use first-class tool exists"）。

**通用原则**（per MemOS 6-07 14:14 [Implicit] "分步、可逆且可控"）：
1. **只读优先**：先 `getXxx()` 看数据，再 `submitXxx()` 改
2. **错误 fallback**：企微接口经常有 rate limit、权限、参数错误
3. **避免批量误操作**：`batchWithDetails` 加 concurrency 上限 (per 6-09 19:19 零改动)




## 📚 37 个 SDK 模块完整文档 (v2026-07-26)

本章节列出全部 37 个 SDK 模块的关键方法签名。每个方法签名 + JSDoc 描述都从 `sdk/modules/<name>/index.js` 自动提取 (per 老板 query 10:49 完整审阅)。

完整 JSDoc @param @returns 详情见各模块源文件注释。

### addressbook

**SDK 调用**: `w.addressbook.<method>()`. **方法数**: 44.

| 方法 | 说明 |
|---|---|
| `flushCache` | v1.5.2 P0：清空所有地址本缓存 |
| `getDepartmentUsers` | v1.5.2 P0：缓存版本 getDepartmentUsers |
| `getDepartmentList` | v1.5.2 P0：缓存版本 getDepartmentList |
| `createUser` | 成员参数 |
| `getUser` | 成员 userid |
| `updateUser` | 成员参数 |
| ... (其余 38 个) | ... |

### advanced

**SDK 调用**: `w.advanced.<method>()`. **方法数**: 12.

| 方法 | 说明 |
|---|---|
| `getMemberApplicationList` | 开始时间戳 |
| `getMemberApplicationDetail` | 申请 ID |
| `setApprovalInfo` | 设置审批单审批信息 |
| `getApprovalIdList` | 批量获取审批单 ID |
| `getApprovalDetail` | 获取审批单详细信息 |
| `createCorpTagGroup` | 组名称 |
| ... (其余 6 个) | ... |

### app

**SDK 调用**: `w.app.<method>()`. **方法数**: 8.

| 方法 | 说明 |
|---|---|
| `getAgent` | 应用 id |
| `setAgent` | 应用 id |
| `getAgentList` | 获取应用列表 |
| `createMenu` | 应用 id |
| `getMenu` | 应用 id |
| `deleteMenu` | 应用 id |
| ... (其余 2 个) | ... |

### approval

**SDK 调用**: `w.approval.<method>()`. **方法数**: 23.

| 方法 | 说明 |
|---|---|
| `getTemplateDetail` | 模板 ID |
| `listTemplates` | 列出本地已知审批模板 (v2026-07-26 老板 query D) |
| `listTemplatesByGroup` | 按 group 名称分组列出本地已知模板 |
| `syncApprovalTemplates` | * @param {string[]} [options.templateIds] - 指定拉哪些 (默认: 本地全部) |
| `_writeBackTemplateDetails` | writeBack 内部辅助: 把 syncApprovalTemplates 结果写回本地 JSON |
| `diffApprovalTemplates` | * @param {string[]} [options.templateIds] - 只 diff 这些 (默认: 全部) |
| ... (其余 17 个) | ... |

### auth

**SDK 调用**: `w.auth.<method>()`. **方法数**: 10.

| 方法 | 说明 |
|---|---|
| `getWebAuthUrl` | 授权回调地址 |
| `getUserInfo` | 授权 code |
| `getUserDetail` | 授权 code |
| `getWebLoginUserInfo` | 获取用户登录身份（Web 登录） |
| `getSecondVerifyInfo` | 获取用户二次验证信息 |
| `secondVerify` | 登录二次验证 |
| ... (其余 4 个) | ... |

### callback

**SDK 调用**: `w.callback.<method>()`. **方法数**: 52.

| 方法 | 说明 |
|---|---|
| `verifyURL` | 签名 |
| `verifyMessage` | 签名 |
| `encrypt` | 消息内容 |
| `parseXML` | XML 内容 |
| `parseMessage` | XML 内容 |
| `handle` | 请求参数 |
| ... (其余 46 个) | ... |

### chain

**SDK 调用**: `w.chain.<method>()`. **方法数**: 16.

| 方法 | 说明 |
|---|---|
| `getCorpSharedInfo` | 应用 ID |
| `getSubCorpToken` | 下级企业 ID |
| `getSubCorpMiniProgramSession` | 用户 ID |
| `getChainCustomerInfo` | 成员 ID |
| `getChainPendingCustomerInfo` | 上下游 ID |
| `getChainInfo` | 上下游 ID |
| ... (其余 10 个) | ... |

### checkin

**SDK 调用**: `w.checkin.<method>()`. **方法数**: 10.

| 方法 | 说明 |
|---|---|
| `getCorpRules` | 获取企业所有打卡规则 |
| `getUserRules` | 成员 userid |
| `getRecords` | 开始时间戳（跨距不超过 30 天） |
| `getDailyReport` | 开始时间戳 |
| `getMonthlyReport` | 开始时间戳 |
| `getSchedule` | 开始时间戳 |
| ... (其余 4 个) | ... |

### checkin_rules

**SDK 调用**: `w.checkin_rules.<method>()`. **方法数**: 19.

| 方法 | 说明 |
|---|---|
| `getCheckInRules` | 偏移量 |
| `getCheckInRuleDetail` | 打卡组 ID |
| `createCheckInRule` | 打卡规则配置 |
| `updateCheckInRule` | 打卡组 ID |
| `deleteCheckInRule` | 打卡组 ID |
| `copyCheckInRule` | 源打卡组 ID |
| ... (其余 13 个) | ... |

### contact

**SDK 调用**: `w.contact.<method>()`. **方法数**: 41.

| 方法 | 说明 |
|---|---|
| `getExternalUserInfo` | 获取成员对外信息 |
| `setExternalUserInfo` | 设置成员对外信息 |
| `getCustomerContactUsers` | 获取配置了客户联系功能的成员列表 |
| `getCustomerList` | 成员 userid |
| `getCustomerDetail` | 成员 userid |
| `batchGetCustomers` | 批量获取客户详情 |
| ... (其余 35 个) | ... |

### contact_stats

**SDK 调用**: `w.contact_stats.<method>()`. **方法数**: 10.

| 方法 | 说明 |
|---|---|
| `updateTodayStats` | 事件类型 |
| `getTodayStats` | 获取当日统计数据 |
| `getUserClientStat` | 成员ID |
| `getUserClientStatByList` | 成员ID列表 |
| `getAllUserClientStat` | 开始日期（YYYYMMDD格式） |
| `getUserClientStatSmart` | 开始日期（YYYYMMDD格式） |
| ... (其余 4 个) | ... |

### custom

**SDK 调用**: `w.custom.<method>()`. **方法数**: 11.

| 方法 | 说明 |
|---|---|
| `addCustomAccount` | 客服名称 |
| `deleteCustomAccount` | 客服账号 (格式: openid@corpid) |
| `updateCustomAccount` | 客服账号 |
| `getCustomAccountList` | 获取客服账号列表 |
| `getCustomAccountLink` | 客服账号 |
| `addServicer` | 成员 userid |
| ... (其余 5 个) | ... |

### customer

**SDK 调用**: `w.customer.<method>()`. **方法数**: 0.

| 方法 | 说明 |
|---|---|

### disk

**SDK 调用**: `w.disk.<method>()`. **方法数**: 18.

| 方法 | 说明 |
|---|---|
| `createSpace` | 空间名称 |
| `renameSpace` | 空间 id |
| `deleteSpace` | 空间 id |
| `getSpaceInfo` | 空间 id |
| `addSpaceMember` | 空间 id |
| `removeSpaceMember` | 空间 id |
| ... (其余 12 个) | ... |

### document

**SDK 调用**: `w.document.<method>()`. **方法数**: 58.

| 方法 | 说明 |
|---|---|
| `createDoc` | *   - spaceid {string} 空间 ID（可选，同时要传 fatherid） |
| `getDocImage` | 文档 ID |
| `configSmartSheetWebhook` | { docid, sheet_id, url, secret, enable } |
| `renameDoc` | 重命名文档/收集表（docid / formid 二选一） |
| `deleteDoc` | 删除文档/收集表（docid / formid 二选一） |
| `getDocBaseInfo` | 获取文档/表格/智能表格/收集表基础信息 |
| ... (其余 52 个) | ... |

### hr

**SDK 调用**: `w.hr.<method>()`. **方法数**: 7.

| 方法 | 说明 |
|---|---|
| `getUserFields` | 字段类型: 1-系统字段 2-自定义字段 |
| `getUserProfile` | 员工 userid |
| `batchGetUserProfiles` | 员工 userid 列表 |
| `updateUserProfile` | 员工 userid |
| `getRegisterId` | 登记表模板组 ID |
| `getRegisterInfo` | 登记表 ID |
| ... (其余 1 个) | ... |

### intelligence

**SDK 调用**: `w.intelligence.<method>()`. **方法数**: 30.

| 方法 | 说明 |
|---|---|
| `setPublicKey` | 公钥 |
| `getAllowedMembers` | 获取授权存档的成员列表 |
| `setCallbackUrl` | 回调 URL |
| `setSecret` | 是否开启: 0-关闭 1-开启 |
| `setLogLevel` | 日志级别: 1-调试 2-提示 3-警告 4-错误 |
| `uploadTempFile` | 文件路径 |
| ... (其余 24 个) | ... |

### journal

**SDK 调用**: `w.journal.<method>()`. **方法数**: 4.

| 方法 | 说明 |
|---|---|
| `getRecordList` | 开始时间戳（秒） |
| `getRecordDetail` | 汇报记录单号列表（最多 100 个） |
| `getStatList` | 开始时间戳（秒） |
| `downloadWedriveFile` | 汇报记录详情中获取到的 fileid |

### kf

**SDK 调用**: `w.kf.<method>()`. **方法数**: 1.

| 方法 | 说明 |
|---|---|
| `batchGetCustomers` | 客服账号 open_kfid 列表 (最多 100) |

### live

**SDK 调用**: `w.live.<method>()`. **方法数**: 8.

| 方法 | 说明 |
|---|---|
| `createLive` | 直播参数 |
| `updateLive` | 直播ID |
| `cancelLive` | 直播ID |
| `getUserLiveIds` | 成员 userid |
| `getLiveDetail` | 直播ID |
| `getWatchers` | 直播ID |
| ... (其余 2 个) | ... |

### media

**SDK 调用**: `w.media.<method>()`. **方法数**: 7.

| 方法 | 说明 |
|---|---|
| `uploadMedia` | 文件路径 |
| `getMedia` | 媒体 id |
| `uploadImage` | 图片路径 |
| `getHighDefinitionVoice` | 媒体 id |
| `getMediaJssdk` | 临时素材 media_id (来自 JSSDK 上传) |
| `asyncUploadMedia` | 文件路径 |
| ... (其余 1 个) | ... |

### meeting

**SDK 调用**: `w.meeting.<method>()`. **方法数**: 62.

| 方法 | 说明 |
|---|---|
| `createMeeting` | 会议参数 |
| `updateMeeting` | 会议 id |
| `cancelMeeting` | 会议 id |
| `checkMeeting` | 会议 ID |
| `approveMeetingEnroll` | 会议 ID |
| `importMeetingEnroll` | 会议 ID |
| ... (其余 56 个) | ... |

### message

**SDK 调用**: `w.message.<method>()`. **方法数**: 29.

| 方法 | 说明 |
|---|---|
| `sendMessage` | 接收成员 |
| `sendText` | 接收成员 (| 分隔) |
| `sendImage` | 接收成员 |
| `sendVoice` | 接收成员 |
| `sendVideo` | 接收成员 |
| `sendFile` | 接收成员 |
| ... (其余 23 个) | ... |

### messenger

**SDK 调用**: `w.messenger.<method>()`. **方法数**: 12.

| 方法 | 说明 |
|---|---|
| `createMassMessage` | 成员 ID |
| `getMassMessageList` | 开始时间戳 |
| `getMassMessageResult` | 消息 ID |
| `cancelMassMessage` | 消息 ID |
| `remindMassMessage` | 成员 ID |
| `sendWelcomeMessage` | 企业接收到的事件中带的 welcome_code |
| ... (其余 6 个) | ... |

### misc

**SDK 调用**: `w.misc.<method>()`. **方法数**: 22.

| 方法 | 说明 |
|---|---|
| `getCardInvoiceInfo` | 发票卡券 ID 列表 |
| `batchGetCardInvoiceInfo` | 发票卡券 ID 列表 |
| `updateCardInvoiceStatus` | 发票卡券 ID |
| `batchUpdateCardInvoiceStatus` | 发票卡券 ID 列表 |
| `getCorpIdByUnionId` | unionid 列表 |
| `getCorpGroupToken` | 互联企业 corpid 列表 |
| ... (其余 16 个) | ... |

### moments

**SDK 调用**: `w.moments.<method>()`. **方法数**: 12.

| 方法 | 说明 |
|---|---|
| `createMoment` | 成员 ID |
| `getMomentList` | 成员 ID |
| `getMomentTaskResult` | 朋友圈 ID |
| `getMomentComments` | 朋友圈 ID |
| `deleteMoment` | 朋友圈 ID |
| `getMomentRuleList` | 获取朋友圈规则组列表 |
| ... (其余 6 个) | ... |

### msgaudit

**SDK 调用**: `w.msgaudit.<method>()`. **方法数**: 0.

| 方法 | 说明 |
|---|---|

### notify

**SDK 调用**: `w.notify.<method>()`. **方法数**: 5.

| 方法 | 说明 |
|---|---|
| `sendVoiceCall` | 成员 ID（v1.3.0 字段名调整：原 userid → callee_userid） |
| `batchSendVoiceCall` | 单个 userId 或用户列表 |
| `getVoiceNotifyStatus` | 成员 userid |
| `sendCorpReminder` | 发送企业提醒 |
| `sendWorkNoticeReminder` | 发送工作通知提醒 |

### oceanengine

**SDK 调用**: `w.oceanengine.<method>()`. **方法数**: 13.

| 方法 | 说明 |
|---|---|
| `createAcquisitionLink` | 链接名称 |
| `getAcquisitionLinkList` | 偏移量 |
| `getAcquisitionLinkDetail` | 链接 ID |
| `updateAcquisitionLink` | 链接 ID |
| `deleteAcquisitionLink` | 链接 ID |
| `getLinkCustomerCnt` | 成员 ID |
| ... (其余 7 个) | ... |

### openchat

**SDK 调用**: `w.openchat.<method>()`. **方法数**: 15.

| 方法 | 说明 |
|---|---|
| `getChatList` | 分页游标 |
| `getChatDetail` | 群聊 ID |
| `updateChat` | 群聊 ID |
| `dismissChat` | 群聊 ID |
| `getMemberList` | 群聊 ID |
| `addMembers` | 群聊 ID |
| ... (其余 9 个) | ... |

### phone

**SDK 调用**: `w.phone.<method>()`. **方法数**: 2.

| 方法 | 说明 |
|---|---|
| `getDialRecord` | 开始时间戳 |
| `getUsageStat` | 开始时间戳 |

### room

**SDK 调用**: `w.room.<method>()`. **方法数**: 14.

| 方法 | 说明 |
|---|---|
| `getMeetingRoomList` | 偏移量 |
| `getMeetingRoomDetail` | 会议室 ID |
| `addMeetingRoom` | 会议室信息 |
| `updateMeetingRoom` | 会议室 ID |
| `deleteMeetingRoom` | 会议室 ID |
| `bookMeetingRoom` | 会议室 ID |
| ... (其余 8 个) | ... |

### schedule

**SDK 调用**: `w.schedule.<method>()`. **方法数**: 14.

| 方法 | 说明 |
|---|---|
| `createCalendar` | 日历参数 |
| `updateCalendar` | 日历 id |
| `getCalendar` | 单个 id 或 id 数组 |
| `deleteCalendar` | 日历 id |
| `createEvent` | 日程参数 |
| `updateEvent` | 日程 id |
| ... (其余 8 个) | ... |

### school

**SDK 调用**: `w.school.<method>()`. **方法数**: 21.

| 方法 | 说明 |
|---|---|
| `sendSchoolNotice` | 老师 ID |
| `getSchoolNoticeResult` | 消息 ID |
| `recallSchoolNotice` | 消息 ID |
| `getClassList` | 学校 ID |
| `getStudentList` | 班级 ID |
| `getParentList` | 学生 userid |
| ... (其余 15 个) | ... |

### security

**SDK 调用**: `w.security.<method>()`. **方法数**: 20.

| 方法 | 说明 |
|---|---|
| `getDlpRules` | 偏移量 |
| `getDlpRuleDetail` | 规则 ID |
| `createDlpRule` | 规则配置 |
| `updateDlpRule` | 规则 ID |
| `deleteDlpRule` | 规则 ID |
| `submitVipAccount` | userid 列表 |
| ... (其余 14 个) | ... |

### sensitive

**SDK 调用**: `w.sensitive.<method>()`. **方法数**: 13.

| 方法 | 说明 |
|---|---|
| `getSensitiveWordList` | 偏移量 |
| `getSensitiveWordDetail` | 敏感词 ID |
| `addSensitiveWord` | 添加敏感词 |
| `updateSensitiveWord` | 编辑敏感词 |
| `deleteSensitiveWord` | 删除敏感词 |
| `getSensitiveRuleList` | 获取敏感词规则列表 |
| ... (其余 7 个) | ... |

### thirdparty

**SDK 调用**: `w.thirdparty.<method>()`. **方法数**: 11.

| 方法 | 说明 |
|---|---|
| `getSubCorpToken` | 下级企业 ID |
| `getPermanentCode` | 授权 code |
| `getCorpInfo` | 下级企业 ID |
| `getCorpList` | 偏移量 |
| `getSubCorpMiniProgramSession` | 用户 ID |
| `getCorpSharedInfo` | 应用 ID |
| ... (其余 5 个) | ... |

## 📬 审批进度推送通知格式 (2026-07-26 老板 query 完整实现)

**触发**：`sys_approval_change` / `sys_approval_revoke` 回调 → `event-router.js approvalNotify()` → 老板私聊 (JieXiaoYin) 实时推送。

**4 段结构** (企微文本硬限制 2048B, 超长自动截断保留头尾)：

```
📋 企业微信审批{actionText}                    ← NEW | 进度更新 | 结果 | 撤销

模板/名称: 客户退款申请                          ← SpName
单号: 202607250001                              ← SpNo
申请人: 孟芳芳                                  ← Applyer.UserId → 中文名 + 部门
状态: 🟡审批中                                   ← SpStatus (1=审批中 2=通过 3=驳回 4=撤销)
📝 申请内容:                                     ← v2026-07-26 08:23 fix: 拉 getApprovalDetail 字段
  退款类型: 移动5G金币
  收款人全称: 尚雨婷
  支付宝账号: 18052374957
  云胜销售截图: [附件 1 个]
审批进度:                                        ← SpRecord (主审批链路)
✅ 朱云 (已审批: ok)
🕐 朱其霞 (等待审批)
🕐 周州 (等待审批)
🕐 李笑玲 / 胡建清 (等待审批)

👀 抄送: 用户A, 周州, 李笑玲, ...               ← ProcessList.NodeList Type=2

🕐 2026-07-26 08:24:00                          ← toLocaleString('zh-CN')
```

**actionText 决策** (per 7-17 19:35)：
- `NEW`      = SpStatus=1 且所有节点 status=1 → 刚发起
- `进度更新` = SpStatus=1 但部分节点已审 (status=2) → 流转中
- `结果`     = SpStatus=2/3 (终态) → 通过或驳回
- `撤销`     = sys_approval_revoke 事件

**字段控件类型支持** (7 种 per `apply_data.contents[].control`)：

| control | 显示 | 例子 |
|---|---|---|
| `Text` / `Textarea` | 文本值 | `尚雨婷` |
| `Number` | 数值 | `18052374957` |
| `Money` | ¥ + 数值 | `¥1234.56` |
| `Date` / `DateTime` | 日期 | `2026-07-25` |
| `Selector` | 选项标签 | `移动5G金币` (多选用 ", " 拼接) |
| `Contact` | 成员名 | `朱云, 周州` |
| `Table` | 明细表 | `[明细表 N 项]` |
| `File` / `Files` | 附件 | `[附件 N 个]` |

**字段过滤**：
- `hidden: 1` 字段不显示 (申请时隐藏字段)
- 空值字段跳过
- 必填字段 (`require: 1`) 优先排序
- 单字段值 > 80 字符自动截断
- 字段数 > 30 自动截断 + 标记 `… (后续字段被截断)`

**推送失败 fallback**：`~/.openclaw/state/wecom-approval-pending.json` (带 rawXml 片段 + receivedAt, 等 OpenClaw cron 重试)。

**完整实现细节** → `/root/audit-reports/2026-07/wecom-skill/wecom-skill-approval-detail-display-2026-07-26.md`

## 🗺️ 枚举 mapping SSOT（v2026-07-26 SOP-7）

**背景**：v1.5.2 SDK 全代码下存在 **~7 处重复 mapping 表 + 多个 fallback 原始数字 bug** (老板 10:20 query "状态:6" 揭示)。已全部抽取到独立 SSOT module。

### 4 个 mapping module（v2026-07-26）

| Module | 路径 | 枚举值 | 主要使用 |
|--------|------|--------|----------|
| `sp-status.js` | `sdk/utils/sp-status.js` | 顶部 sp_status (7 值: 1/2/3/4/6/7/10) | event-router / callback |
| `sp-record-status.js` | `sdk/utils/sp-record-status.js` | 节点 sp_status (4 值: 1/2/3/4) | event-router 审批进度块 |
| `change-type.js` | `sdk/utils/change-type.js` | ChangeType (3 内部 + 2 外部联系人) | callback 5 处 × 2 用法 |
| `smartsheet-event-type.js` | `sdk/utils/smartsheet-event-type.js` | wedoc 事件 (3 值) | sidecar-notifier |

### 统一接口

```js
const spStatusText = require('./sdk/utils/sp-status').getSpStatusText;
const nodeStatusInfo = require('./sdk/utils/sp-record-status').getNodeStatusInfo;
const changeTypeText = require('./sdk/utils/change-type').getChangeTypeText;
const smartsheetType = require('./sdk/utils/smartsheet-event-type').getSmartSheetEventType;

spStatusText(6)         // '🔁通过后撤销'
spStatusText(99)        // '未知状态(99)'  ← safe fallback，避免原始数字泄漏
nodeStatusInfo(3)       // { text: '❌', label: '已驳回' }
changeTypeText(1)       // '新增'
changeTypeText(2, true) // '变更(2)'  ← 外部联系人无 2/3
smartsheetType('add_record')   // '➕ 新增记录'
smartsheetType('unknown_evt')  // '未知事件(unknown_evt)'
```

### Safe fallback 原则 (SOP-7 强制)

| 场景 | 错误 fallback | 正确 fallback |
|------|-------------|---------------|
| 顶部 sp_status 未映射 | `状态: 6` | `未知状态(6)` |
| 节点 sp_status 未映射 | `🕐 朱云 (等待审批)` | `❓ 朱云 (未知(N))` |
| ChangeType 未映射 | 原始数字 | `变更(2)` |
| wedoc 事件未映射 | 原始字符串 | `未知事件(unknown)` |

### 为何不用 enumMap type pattern

**反对**: 类似 Java enum-style 大而全 mapper（50KB+)。
**主因**: 企微 SDK 是 **不同模块用不同枚举** (sp_status 是 number, change_type 是 number 或 string, wedoc 是字符串字面量)。统一枚举池会让调用者混乱。

**原则**: **按域拆 module** (SSOT), 调用者显式 require, 避免跨域 mapping 合并。

### 单测覆盖（共 20 个 case）

| Module | Tests |
|--------|-------|
| sp-status | 5 (含 safe fallback) |
| sp-record-status | 5 (含未知值 ❓) |
| change-type | 6 (含外部联系人 isExternalContact) |
| smartsheet-event-type | 4 (含空值) |
| **总计** | **20 case，npm 58/58 PASS** |

**完整修复报告** → `/root/audit-reports/2026-07/wecom-skill/wecom-skill-sop7-sp-status-refactor-2026-07-26.md`

### meeting（会议）

| action | 必需参数 | 说明 |
|---|---|---|
| `create_meeting` ⚠️ | `userId`(organizer), `topic`, `startTime`, `endTime` | 创建会议 |
| `get_meeting_list` | `userId`, `startTime`, `endTime` | 会议列表 |
| `get_meeting_detail` | `meetingId` | 会议详情 |
| `cancel_meeting` ⚠️ | `meetingId` | 取消会议 |
| `invite_meeting` ⚠️ | `meetingId`, `userIds[]` | 邀请成员 |

### checkin / checkinrules（打卡）

| action | 必需参数 | 说明 |
|---|---|---|
| `get_checkin_records` | `startTime`, `endTime`, `userIds[]` | 打卡记录 |
| `get_checkin_rules` | `userId?` | 打卡规则（无 userId 查全公司）|
| `checkinrules getCheckInRules` | `offset?`, `size?` | 打卡规则详情（含地点/WiFi）|
| `checkinrules getCheckInRuleDetail` | `userIds[]`, `datetime?` | 规则明细 |

### journal（汇报）

| action | 必需参数 | 说明 |
|---|---|---|
| `get_record_list` | `startTime`, `endTime` | 汇报记录列表 |
| `get_record_detail` | `recordIds[]` | 汇报详情 |
| `get_stat_list` | `startTime`, `endTime`, `dimension` | 汇报统计 |
| `download_wedrive_file` | `fileId` | 下载汇报附件 |

### schedule（日程）

| action | 必需参数 | 说明 |
|---|---|---|
| `create_calendar` ⚠️ | `summary`, `color?` | 新建日历 |
| `get_calendar` | `calendarId` | 日历详情 |
| `create_event` ⚠️ | `calendarId`/`organizer`, `title`, `startTime`, `endTime` | 新建日程 |
| `update_event` ⚠️ | `scheduleId`, `title?` | 更新日程 |
| `delete_event` ⚠️ | `scheduleId` | 删除日程 |

### document（文档 / 表格 / 智能表格）

| action | 必需参数 | 说明 |
|---|---|---|
| `create_doc` ⚠️ | `docType`(3=文档/10=智能表格), `docName` | 新建文档 |
| `get_doc_base_info` | `docid` | 文档基础信息 |
| `get_document` | `docid` | 读取文档内容（Markdown）|
| `update_document` ⚠️ | `docid`, `requests[]`（≤30）| 批量写文档块 |
| `delete_doc` ⚠️ | `docid` | 删除文档 |
| `get_spreadsheet_range` | `docid`, `sheetId`, `range` | 读表格区域（A1 记法）|
| `update_spreadsheet` ⚠️ | `docid`, `requests[]`（≤5）| 批量写表格 |
| `get_smart_sheet` | `docid`, `sheetId?` | 读智能表格 |
| `get_records` | `docid`, `sheetId`, `viewId?` | 读子表记录 |
| `add_records` ⚠️ | `docid`, `sheetId`, `records[]` | 批量新增记录 |
| `update_records` ⚠️ | `docid`, `sheetId`, `records[]` | 批量更新记录 |
| `delete_records` ⚠️ | `docid`, `sheetId`, `recordIds[]` | 删除记录 |
| `add_fields` ⚠️ | `docid`, `sheetId`, `fields[]` | 新增字段 |
| `delete_fields` ⚠️ | `docid`, `sheetId`, `fieldIds[]` | 删除字段 |
| `get_fields` | `docid`, `sheetId` | 读字段列表 |
| `add_view` ⚠️ | `docid`, `sheetId`, `viewTitle`, `viewType` | 新建视图 |
| `document_webhook add_records` ⚠️ | `webhookUrl`, `records[]` | 推送记录到 webhook |
| `create_collect` ⚠️ | `formTitle`, `formQuestion[]` | 创建收集表 |
| `get_form_statistic` | `repeatedId`, `reqType` | 收集表统计 |

## 📘 开发 SOP（v2026-07-26 老板 query 完整审阅）

本章节集中 3 类调试/SOP 信息，避免散落各处。

### 🐛 A. SDK 上传 SOP（media 模块踩过的 4 个坑）

**v1.5.2 修复记录**（per 7-25-9:55 SOP-6）：

| # | 问题 | 原因 | 修复 |
|---|---|---|---|
| 1 | `form-data` 不能嵌套 formData | npm 包要求顶层 form-data 实例 | 改用嵌套数组 `formData.append('media', buffer)` |
| 2 | Axios `Content-Type` 被覆盖 | 默认 `application/json` | 手动设为 `multipart/form-data; boundary=...` |
| 3 | `uploadMedia` type 必须 URL query | 官方 API 设计 | type 走 `?type=image` |
| 4 | 缩略图提取走 ffmpeg 24kHz mono | 微信 silk 客户端期望 | 加 `-ar 24000 -ac 1` |

**上传步骤**：

```bash
# 1. 上传图片
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js media uploadMedia \
  --args '{"filePath":"/tmp/x.jpg","type":"image"}' --json

# 2. 上传语音 (silk 格式自动转换)
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js media uploadMedia \
  --args '{"filePath":"/tmp/v.mp3","type":"voice"}' --json
```

### 🧪 B. 单测 SOP（5 步 SOP-6）

**写新单测前必读**：避免凭记忆构造 fake data。

1. **先用真实 SDK 拉一份样本**（老板本地 config 可用）
   ```bash
   node -e "
   const W = require('./sdk');
   const c = JSON.parse(require('fs').readFileSync('./config.json','utf-8'));
   const w = new W(c);
   w.approval.getApprovalDetail('202607250001').then(r => {
     console.log(JSON.stringify(r.apply_data.contents[0], null, 2));
   });
   " 2>&1 | grep -v INFO
   ```
2. **验证字段名**（如 Money 用 `new_money` 不是 `new_number`）
3. **用真实字段名构造 fixture**
4. **加一条"真实 SDK 回归" test case**（仅当 config 存在时跑）
5. **跑 `npm test` 验证**

**跳云逻辑**（单测必须加）：

```js
let realSDK = null;
try {
  const W = require('../sdk');
  const config = require('../config.json');
  realSDK = new W(config);
} catch (e) { return; }  // 无 config 跳过
if (!realSDK) return;
```

### 🔍 C. 调试 SOP（4 步法）

1. **看 daemon 状态**：`systemctl --user status wecom-skill-daemon`
2. **看最近 daemon 日志**：`journalctl --user -u wecom-skill-daemon -n 100 --no-pager`
3. **看 events 表**：`node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js events list --args '{"limit":50}' --json`
4. **启用 debug log**：`LOG_LEVEL=debug npm test` 看 debug 详情

**审批调试快照**：`/opt/openclaw/state/wecom-approval-debug/` (FFO 保留 20 个)
- 文件名格式：`SP_NO-hrtime.bigint().json`
- 含 raw request + error info
- 手动清理：`find ~/.openclaw/state/wecom-approval-debug -type f -mtime +7 -delete`

### 🛠️ D. 错误恢复 SOP（常见故障模式）

| 故障 | 原因 | 恢复 |
|---|---|---|
| 401 invalid_access_token | access_token 过期 | daemon 自动重试（7200s 后），如不重试则 `systemctl restart wecom-skill-daemon` |
| 44001 媒体文件不存在 | uploadMedia form-data 嵌套错 | 检查代码用 SOP-6 真拉样本 + 看 audit-report `wecom-skill-upload-and-test-approval` |
| 60011 权限不足 | 应用未授权 | 老板手动企微后台启用权限 |
| 40004 不合法的 CorpID | config corpId 错 | 检查 `config.json` + `~/.openclaw/credentials/wecom-api-access.json` |
| events 表空 | daemon 未启动 | `systemctl start wecom-skill-daemon` |
| 调试快照找不到 | 路径不对 | `ls -la ~/.openclaw/state/wecom-approval-debug/` |
| templates diff 全错 | 后台改了未同步 | `w.approval.syncApprovalTemplates({writeBack: true})` |

### 📝 E. 代码提交流程（老板偏好 — dev→deploy 铁律）

```
/opt/wecom-skill/                    ← 开发目录
   ↓ (改完跑 npm test)
   ↓ (md5sum 一致性确认)
/opt/openclaw/skills/wecom-skill/       ← 部署目录 (OpenClaw 加载)
   ↓ (deploy.sh 或手动 cp)
启动 daemon 重启
```

**⚠️ 严禁直接在 deploy 改代码**（per AGENTS.md 开发规范 + 6-04 老板铁律）。

---

| action | 必需参数 | 说明 |
|---|---|---|
| `status` | — | 连接状态 + corpId / agentId |
| `test_connection` | — | 测试 API 连通性 |
| `get_token` | — | 获取 access_token |
| `get_agent` | `agentId` | 获取应用信息 |
| `setup` | — | 交互式重新配置 corpId / corpSecret |

### utils（工具 / 配置）

CLI `utils` 域下的工具类 actions：

| action | 必需参数 | 说明 |
|---|---|---|
| `test_connection` | — | 测试 API 连通性 |
| `get_token` | — | 获取 access_token |
| `get_agent` | `agentId` | 获取应用信息 |
| `setup` | — | 交互式重新配置 corpId / corpSecret |

### 📋 业务数据 SSOT 文档 (v2026-07-26 老板 query 11:04 + 11:06)

> **设计原则**：所有"老板业务常用 ID"都集中在 `docs/*.json`，不在 SDK 代码里硬编码。SDK 通过 `utils/*-loader.js` 读取。

| docs 文件 | 内容 | SDK 入口 |
|---|---|---|
| `docs/approval-templates.json` | 33 个审批模板 (5 组 + `_sync` 元数据) | `w.approval.listTemplates()` / `searchTemplates()` / `syncApprovalTemplates()` / `diffApprovalTemplates()` |
| `docs/approval-templates.schema.json` | JSON Schema Draft-07 (zero-deps 校验) | `sdk/utils/templates-validator.js` |
| `docs/smartsheet-registry.json` | 智能表格 docid/sheetId 登记 (name/purpose/owner/tags) | `w.document.loadSmartSheetRegistry()` / `registerSmartSheet()` / `searchSheets()` |
| `docs/smartsheet-registry.schema.json` | JSON Schema Draft-07 (zero-deps 校验) | `sdk/utils/smartsheet-registry.js` 内部 |

#### 智能表格 SSOT (`smartsheet-registry`) 用法示例

**列出所有已登记的智能表格**：

```bash
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js document list_smart_sheet --json
```

**模糊查** (按 name / tag / purpose / docid 任一维度)：

```bash
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js document search_smart_sheet \
  --args '{"name":"晨报"}' --json
# → { count: 1, matches: [{docid, sheetId, name, purpose, owner, tags, ...}] }

node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js document search_smart_sheet \
  --args '{"tag":"cron"}' --json
```

**SDK 调用**：

```js
const w = new Wecom(config);

// 1. 加载登记
const reg = w.document.loadSmartSheetRegistry();
console.log('已登记智能表格:', reg.count());

// 2. 模糊查
const morningPapers = w.document.searchSheets({ name: '晨报' });
const docid = morningPapers[0].docid;

// 3. 直接调业务 API 用查到的 docid
await w.document.addRecords(docid, sheetId, [...records]);
```

**登记新智能表格** (业务方调用, 自动写回 docs)：

```bash
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js document register_smart_sheet \
  --args '{"docid":"DCxxx...","sheetId":"ABC123","name":"新报表","purpose":"..."}' --json
```

#### 为什么 SSOT 化 (老板 query 11:04)

- ✅ 改 docid 不改代码: 改 docs/smartsheet-registry.json 就生效, 不用动 SDK
- ✅ cron payload 不再硬编码: cron JSON 引用 name 而不是 docid
- ✅ schema 校验防漂移: zero-deps validator 默认 validate=true
- ✅ 业务可观测: 列出所有登记表 = 老板一眼看清"我们有哪些表"
- ✅ 跟 approval SSOT 同模式 (10:32 已沉淀)

#### 维护流程

1. **登记新表**: 跑 `register_smart_sheet` 或手动编辑 `docs/smartsheet-registry.json`
2. **校验**: 跑 `npm test` (124 个 case 覆盖 validator + loader + 业务方法)
3. **dev→deploy 同步**: 自动 `cp -a` 或 GitHub Actions
4. **添加 schema 字段**: 同步改 `docs/smartsheet-registry.schema.json` + `validator`

**SDK 底层 utility module**：`sdk/utils/` (独立 module, 非 w.xxx 调用, 供其他模块复用)
- `logger.js` — 运行时可关闭 console (JSON 模式)
- `callback-helper.js` — 回调验签 (v1.5.2 双重实现)
- `events-store.js` — 事件 SQL 存储 (v1.5.2 sqlite/MySQL 双实现)
- `sp-status.js` — 顶部 sp_status 7 值 (SOP-7 SSOT)
- `sp-record-status.js` — 节点 sp_status 4 值 (SOP-7 SSOT)
- `change-type.js` — ChangeType 3 内部 + 2 外部联系人 (SOP-7 SSOT)
- `smartsheet-event-type.js` — wedoc 事件 3 值 (SOP-7 SSOT)
- `templates-{loader,validator,diff}.js` — 审批模板管理 (v2026-07-26)

### daemon（进程管理）

| action | 说明 |
|---|---|
| `daemon status` | 进程状态、端口、数据库路径 |
| `daemon restart` | 重启 daemon（systemd）|
| `daemon logs` | 最近 20 条 journal 日志 |
| `daemon flush` | 清空 events 表（P0-1 调试用）|

### events（回调事件历史）

| action | 必需参数 | 说明 |
|---|---|---|
| `list` | `limit?=50`, `offset?=0` | 列出最近事件 |
| `stats` | — | 各类型事件统计 |

## 常用命令示例

```bash
# 查客户列表（userId = 成员 userid）
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js customers get_customer_list \
  --args '{"userId":"ZhuYun"}' --json

# 查部门成员（含缓存，第二次调用走缓存）
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js contacts get_department_users_detail \
  --args '{"departmentId":1,"fetchChild":true}' --json

# 强制刷新通讯录缓存（create_user 后必须调）
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js contacts flush_cache --json

# 查打卡记录
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js checkin get_checkin_records \
  --args '{"startTime":1784064000,"endTime":1784150400,"userIds":["ZhuYun"]}' --json

# 读智能表格记录
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js document get_records \
  --args '{"docid":"KBaAAAA","sheetId":"sheet1"}' --json

# 新增智能表格记录
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js document add_records \
  --args '{"docid":"KBaAAAA","sheetId":"sheet1","records":[{"fields":{"姓名":"陈丽","门店":"5号店"}}]}' --json

# 查 daemon 状态
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js daemon status --json

# 看 daemon 日志（实时）
journalctl --user -u wecom-skill-daemon -f --no-pager

# 查最近回调事件（最新 10 条）
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js events list --args '{"limit":10}' --json

# ━━━━━ weekly_behavior 新字段 (v1.5.2 P0-fix 修复) ━━━━

# ⚠️ 下划线参数名 (不要驼峰!)
# weekly_behavior 本月 (7/1-7/15):
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js customers weekly_behavior \
  --args '{"start_date":"2026-07-01","end_date":"2026-07-15"}' --json

# 默认 (上周周一~周日):
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js customers weekly_behavior --json

# 单员工 (实时):
node ~/.openclaw/skills/wecom-skill/bin/wecom-cli.js customers get_user_client_stat \
  --args '{"userId":"ZhuYun","startDate":"2026-07-15","endDate":"2026-07-15"}' --json
```

## ⚠️ schema 字段映射 (关键 — agent 调用必查)

**wecom-cli.js 输出 schema**（以 2026-07-15 17:00 老板要求为准，按企微官方文档核实）：

### `customers weekly_behavior` (v1.5.2 起)

```json
{
  "data": {
    "week_start": "2026-07-06",
    "week_end": "2026-07-12",
    "start_ts": 1783267200,    // 秒
    "end_ts": 1783871999,
    "source": "api",
    "employees": [
      {
        "user": "18762075275@139.com",  // ⚠️ 真实 wxid, 不是中文名
        "name": "尤佳",                 // 中文名（来自通讯录）
        "days": 7,
        "new_contact_cnt": 18,          // ✅ 官方字段, v1.5.2 修复
        "chat_count": 0,                 // ⚠️ chat_cnt -> 聚合 chat_count
        "message_count": 0,              // ⚠️ message_cnt -> 聚合 message_count
        "reply_percentage": 100          // ⚠️ 0~100 整数
      }
    ],
    "summary": {
      "employees_count": 24,
      "total_new_external": 118,         // ⚠️ 名虽叫 _external, 实际是 new_contact_cnt 之和 (历史命名保留)
      "total_chat": 0,
      "total_message": 0,
      "avg_reply_percentage": "37.5"
    },
    "_meta": {
      "visibility": "boss-only",
      "policy": "历史行为走 API (per 11:12 规则)",
      "api_window": "昨天~前180天 (per 2026-07-15 01:30)",
      "default_week": "上周 (周一~周日, per 2026-07-09 09:35 偏好)"
    }
  }
}
```

### `customers daily_user_changes` (events 表口径)

```json
{
  "data": {
    "date": "2026-07-15",
    "since": 1784044800,
    "until": 1784131200,
    "source": "events",
    "events_total": 0,                  // events 表当下全表事件数
    "anomalies_count": 0,
    "anomalies_users": [],
    "employees": [],                    // 按员工 userid 统计
    "summary": {"create": 0, "update": 0, "delete": 0, "employees_count": 0}
  }
}
```

### `customers get_user_client_stat` (单员工实时)

```json
{
  "data": {
    "errcode": 0,
    "errmsg": "ok",
    "behavior_data": [                 // ⚠️ 是数组, 按天分项
      {
        "stat_time": 1784044800,       // 单天 0:00 (秒)
        "chat_cnt": 0,
        "message_cnt": 0,
        "negative_feedback_cnt": 0,
        "new_apply_cnt": 0,            // ⚠️ 客户申请添加员工
        "new_contact_cnt": 0           // ✅ 员工添加客户 (v1.5.2 起)
      }
    ]
  }
}
```

### 🚨 agent 调用禁忌

```bash
# ❌ 错误：inline python + sqlite3 直查 events 表
python3 -c "import sqlite3; db=sqlite3.connect('/opt/openclaw/state/wecom-events.db'); ..."

# ✅ 正确：走 wecom-cli.js, schema 已知 (按上表)
node /opt/openclaw/skills/wecom-skill/bin/wecom-cli.js customers daily_user_changes \
  --args '{"date":"2026-07-15"}' --json
```

## 配置

配置文件：`~/.openclaw/skills/wecom-skill/config.json`

| 字段 | 说明 |
|---|---|
| `corpId` | 企业 ID |
| `corpSecret` | 应用 Secret |
| `agentId` | 应用 AgentId（默认 1000040）|
| `callback.token` | 回调验证 Token |
| `callback.encodingAESKey` | 回调加密 AES Key |
| `callback.port` | daemon 监听端口（默认 18790）|
| `callback.path` | 回调路径（默认 /plugins/wecom-skill/callback）|
| `dbPath` | events 数据库路径 |
| `notifyUser` | 实时推送目标 userId（默认 JieXiaoYin）|

修改后需 `systemctl --user restart wecom-skill-daemon`。

## Callback 事件类型（daemon 自动处理）

| 事件 | 处理动作 |
|---|---|
| `sys_approval_change` | 实时推老板企业微信（失败写 pending.json）|
| `sys_approval_revoke` | 同上 |
| `change_type`（create_user / update_user / delete_user / create_party / update_party / delete_party）| flushCache |
| `add_external_contact` | 发新人欢迎语（WelcomeCode 20s 内有效）|
| `edit_external_contact` | 日志记录 |
| `del_follow_user` | 日志记录 |
| `smart_sheet_change` | 入库 events 表 |
| `change_external_chat` | 入库 events 表 |

## 🛠️ 真实事件调试 SOP（2026-07-16 audit P2-C 补）

老板遇到审批未推 / 推送中看到 'sys' / 有事件但无推送 时，按 SOP 走：

### Step 1: daemon 在不在跑
```bash
systemctl --user is-active wecom-skill-daemon
```

### Step 2: 最近 daemon 日志
```bash
journalctl --user -u wecom-skill-daemon --since "10 min ago" -n 200
# 关键词索引:
#   "approval real-time push"     —— 推送出口
#   "Applyer.UserId"              —— 修复后取这个字段 (不是 FromUserName='sys')
#   "_mapping_status"             —— phoneerp-access-roles.json lookup 跳起
#   "unmapped"                    —— lookup 不上, 推送被拒绝 (3 档处理跳起)
#   "pending"                     —— wecom_userid='pending', 不发推送
```

### Step 3: events 表查最近事件
```bash
sqlite3 /opt/openclaw/state/wecom-events.db "SELECT id, event, create_time FROM events ORDER BY create_time DESC LIMIT 5;"
```

### Step 4: raw_xml 查申请人人
```bash
sqlite3 /opt/openclaw/state/wecom-events.db "SELECT raw_xml FROM events WHERE event='sys_approval_change' ORDER BY create_time DESC LIMIT 1;" \
  | python3 -c "import sys,re; rx=sys.stdin.read(); print(re.search(r'<Applyer><UserId>.*?<!\[CDATA\[(.+?)\]\]>', rx).group(1))"
```
期望输出: wecom_userid（例如 `ZhaiLi`）而非 `sys`。

### Step 5: lookup 检验
```bash
node /opt/openclaw/skills/phoneerp/scripts/lookup_employee.js --wecomUserid ZhaiLi --json
```
期望: `match.type='exact'` + `record.name='翟利'`，warnings=[]。

### Step 6: 手动重推 (如果 daemon 错误)
```bash
node /opt/openclaw/skills/wecom-skill/bin/wecom-cli.js approval resend --args '{"sp_no":"202607160005"}'
```

### Step 7: 推送拒绝原因查询 (lookup 2 档生效后)
如果推送里出现 `wecom_userid pending` or `unmapped`,按 [phoneerp SKILL.md § 3 三档处理规则](phoneerp/SKILL.md) 走。

### 原允许快身检查 (openclaw-gateway 读 wecom WS)
```bash
journalctl --user -u openclaw-gateway --since "5 min ago" -n 100 | grep -E "WS:default.*Connected|approval real-time push"
```

---

## 版本记录

- **v1.5.2**（2026-07-15）：P0-2 重构 approval handler 为实时推送；修 checkinrules CLI 域缺失 + sp_no 类型 bug
- **v1.5.2**：P1-C add_external_contact 自动欢迎语；P0-1 cache + flushCache
- **v1.5.0**：journal 模块 + 大规模端点路径修复，12 域 114 actions
