# wecom-skill（pure skill 形态，v1.5.2）

企业微信 API OpenClaw **纯 skill**。**单一 skill 入口**：`~/.openclaw/skills/wecom-skill/`，覆盖 **SDK 37 模块 / 620 方法**，13 个集成测试，**全局 doc API 覆盖率 78.0%**（核心业务域 100%）。

> ⚠️ **v1.0 breaking change**：从 v0.0.x 的「plugin + 伪 skill」迁移到「pure skill」。**完全不再安装到 `~/.openclaw/extensions/`**。
> ⚠️ **v1.0.2 架构变更**：v1.0.0/v1.0.1 曾拆成 8 个 wecom-* skill 目录（1 个主 + 7 个子），现已合并回单 skill 入口（`SKILL.md` 全部包含在内）。
> ✅ **v1.5.2 架构优化**：addressbook 5 个 read 方法加 24h cache + 事件驱动 flushCache；回调工具从 `sdk/callback-helper` 合并到 `sdk/utils/callback-helper`；addressbook_cache 死模块移至 `_deprecated/`。

## 安装

```bash
# 1. 克隆主 skill（包含 SDK 代码 + CLI + SKILL.md）
git clone https://github.com/jiexiaoyin/wecom-skill.git \
  ~/.openclaw/skills/wecom-skill

# 2. 装依赖
cd ~/.openclaw/skills/wecom-skill && npm install --production

# 3. 配置（交互式）
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js setup

# 4. 测试
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js utils test_connection --json

# 5. 重启 OpenClaw 让 skill loader 重新发现
systemctl --user restart openclaw-gateway
```

> 旧版 v1.0.0/v1.0.1 用户需要：删 `~/.openclaw/skills/wecom-{customers,contacts,approval,meeting,checkin,schedule,utils}/` 7 个子目录（已废弃）。

## 12 域总览（v1.5.0）

| 域 | actions | 用途 |
|---|---|---|
| **customers** | 21 | 客户/标签/客户群/朋友圈/客户统计 |
| **contacts** | 9 | 部门/成员 CRUD |
| **approval** | 8 | 审批单/模板/假期 |
| **meeting** | 5 | 会议创建/查询/取消/邀请 |
| **checkin** | 2 | 打卡记录 + 规则 |
| **journal** | 4 | **v1.5.0 新增** — 汇报记录/详情/统计/微盘文件 |
| **schedule** | 6 | 日历/日程事件 CRUD |
| **document** | 39 | 在线文档/表格/智能表格/收集表/权限/素材 |
| **document_webhook** | 3 | 智能表格「接收外部数据」webhook 推数据 |
| **utils** | 9 | 凭证/应用/setup/status/test_connection |
| **events** | 3 | 读 wecom-skill daemon 写入的 sqlite 事件历史 |
| **daemon** | 5 | 管 wecom-skill 自管 daemon 进程（systemd --user）|

完整 action 清单：
```bash
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js help
```

## v1.5.0 新增能力（最近更新）

### 🆕 journal 模块（M1 计划通讯录+审批+汇报 第三块）

```bash
# 批量获取汇报记录单号
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js journal get_record_list \
  --args '{"startTime":"2026-07-01","endTime":"2026-07-15"}' --json

# 获取汇报记录详情
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js journal get_record_detail \
  --args '{"recordIds":["sp_xxx","sp_yyy"]}' --json

# 获取汇报统计
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js journal get_stat_list \
  --args '{"startTime":"2026-07-01","endTime":"2026-07-15","dimension":"record_type","recordType":1}' --json

# 下载汇报微盘文件
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js journal download_wedrive_file \
  --args '{"fileId":"file_xxx"}' --json
```

### 🔧 端点路径系统性修复（v1.3.0 → v1.5.0）

- **v1.4.0 externalcontact 模块覆盖率 5% → 100%**：73 个端点全部对齐官方文档
- **v1.5.0 meeting 模块覆盖率 44% → 92%**：22 个路径偏差修复
- **v1.5.0 checkin 模块覆盖率 26% → 100%**：8 修 + 13 throw
- **SDK 全局覆盖率**：47.2% → 56.8%

### 🛡️ throw error 保护机制

60 个 SDK 方法调用时会立即抛 `Error: xxx 已废弃：官方端点名为 yyy`，**不会静默 404**，调用方可以立即识别：

```js
// 例如
await w.meeting.getCheckDevices();  // throws: 官方文档无此端点（v1.5.0）
```

## 实战使用示例

### 1. SDK 直调（不是 CLI）

```js
const WeComPlugin = require('wecom-skill/sdk');

const w = new WeComPlugin({
  corpid: 'ww1234567890abcdef',
  corpSecret: 'secret_abc',
  agentId: 1000001,
});

// 查客户列表
const customers = await w.customer.getCustomerList('UserA');
// → { errcode: 0, errmsg: 'ok', external_userid: ['ext_xxx', 'ext_yyy'] }

// 添加客户到指定员工
await w.contact.addContactWay({ scene: 1, style: 1 });

// 提交审批
const sp = await w.approval.submitApproval({
  templateId: 'tpl_leave',
  creator: 'JieXiaoYin',
  approver: [{ type: 1, userid: 'Manager1' }],
  content: [{ control: 'Text', id: 'reason', value: { text: '请假一天' } }],
});
// → { errcode: 0, errmsg: 'ok', sp_no: '202607150001' }
```

### 2. 地址本 cache + flush 事件驱动

```js
// 涪5号店长店有变动
eventRouter.on('change_type', addressbookCacheFlush());
// daemon 收到企微回调 →  router 调 w.addressbook.flushCache()
// 下次 getUser/getDepartment* 自动重新拉 API
```

### 3. 回调事件接收（daemon 部署后）

```js
// bin/wecom-daemon.js 监听 127.0.0.1:18790
// 企微后台设「接收事件服务器」URL → http://your-host:18790/callback
// daemon 用 sdk/utils/callback-helper.js 自动解密 XML + 路由到 EventRouter
// handler 可写到 OpenClaw memory / 推 webchat / 写 mysql
```

### 4. 业务场景示例

```js
// 示例：查「门店A」当前所有可用员工的客户数
const storeEmployees = await w.addressbook.getDepartmentUsersDetail(5, false);
// → userlist: [{ userid: 'UserA', name: '用户A', department: [5] }, ...]

const stats = await Promise.all(
  storeEmployees.userlist.map(u =>
    w.contactStats.getUserBehaviorData({ userId: u.userid, startTime: todayStart, endTime: now })
  )
);
// → 每日客户添加数、聊天数、客户群数、消息数 用于面部跟踪

// 示例：实时推送日报评论意见进企业微信群
await w.appChat.sendText('chat_id_storeA', '【9:05 晨会要点】今日目标营收 ¥5万，门店A主推新品');
```

### 5. CLI vs SDK 选择指南

| 场景 | 推荐 | 原因 |
|---|---|---|
| LLM 一次性调用 | CLI (`wecom-cli.js <domain> <action> --json`) | JSON 透传，脚本友好 |
| Node.js 代码集成 | SDK (`require('wecom-skill/sdk')`) | 内存缓存、事件驱动、可复用 |
| daemon 启动/状态 | CLI (`daemon {start,stop,status,restart}`) | systemd --user 集成 |
| 批量处理多记录 | SDK + for loop | cache 批处理、高性能 |
```bash
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js <domain> <action> --args '<json>' [--json]
```

例：
```bash
# 查客户列表
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js customers get_customer_list \
  --args '{"userId":"JieXiaoYin"}' --json

# 查审批列表（秒级时间戳）
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js approval get_approval_list \
  --args '{"startTime":1717200000,"endTime":1717286400}' --json

# 创建会议
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js meeting create_meeting \
  --args '{"userId":"JieXiaoYin","topic":"周会","startTime":1718000000,"endTime":1718003600}' --json

# 查汇报记录
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js journal get_record_list \
  --args '{"startTime":"2026-07-01","endTime":"2026-07-15"}' --json

# 看配置
~/.openclaw/skills/wecom-skill/bin/wecom-cli.js utils status
```

`--json` 模式：抑制 console.warn/error，输出纯 JSON（给 LLM 程序化消费）。

## 架构

```
wecom-skill/
├── bin/
│   ├── wecom-cli.js           # CLI 入口 — SDK 37 模块 620 方法
│   ├── wecom-daemon.js        # 自管 daemon（127.0.0.1:18790，听 callback）
│   └── event-router.js        # 事件路由 (change_type → flushCache / 审批推送)
├── sdk/                       # 业务 SDK
│   ├── index.js               # WeComPlugin 主类（实例化所有 modules）
│   ├── sdk.js                 # WeComSDK 基类（HTTP + token cache）
│   ├── core/permission.js     # 权限矩阵
│   ├── crypto.js              # 企微消息加/解密
│   ├── callback-helper.js → 合并到 utils/
│   ├── utils/                 # callback-helper + logger + events-store
│   ├── modules/               # 37 个模块实现
│   └── _deprecated/           # 历史模块 (addressbook_cache_v1.4.0)
├── test/                      # 13 个集成测试 (npm test)
│   ├── integration-customer.test.js
│   ├── integration-meeting.test.js
│   ├── integration-document.test.js
│   ├── integration-contact-stats.test.js
│   ├── integration-b1-warn.test.js
│   ├── integration-b2-logger.test.js
│   ├── integration-daemon-placeholder.test.js
│   ├── integration-security.test.js      # v1.5.2 P1
│   ├── integration-addressbook.test.js  # v1.5.2 P1 (cache 验证)
│   ├── integration-approval.test.js     # v1.5.2 P1
│   ├── integration-media.test.js        # v1.5.2 P2
│   ├── integration-messenger.test.js    # v1.5.2 P2
│   └── integration-school.test.js       # v1.5.2 P2
├── SKILL.md                   # OpenClaw skill 描述（trigger / actions 详细）
├── docs/                      # 验证报告 / nginx-mirror / 模板示例
├── install/                   # systemd --user unit
├── config.example.json
├── package.json               # version: 1.5.2
└── README.md                  # 本文件
```

```
wecom-skill/
├── bin/
│   ├── wecom-cli.js           # CLI 入口 — 12 域 114 个 actions
│   ├── wecom-daemon.js        # 自管 daemon（127.0.0.1:18790）
│   └── sidecar-notifier.js    # wedoc 事件侧推
├── sdk/                       # 业务 SDK（37 个 modules + 1 journal）
│   ├── index.js               # WeComPlugin 主类（实例化所有 modules）
│   ├── sdk.js                 # WeComSDK 基类（HTTP 客户端 + token 缓存）
│   ├── core/permission.js     # 权限
│   ├── crypto.js              # 加密
│   └── modules/               # 模块实现（addressbook/approval/checkin/journal/...）
├── SKILL.md                   # OpenClaw skill 描述（trigger / actions 详细）
├── docs/
│   ├── v1.0.0-verify.md       # v1.0 验证报告
│   ├── nginx-mirror.md        # nginx mirror 配置
│   └── approval-templates.schema.json
├── install/
│   ├── wecom-skill-daemon.service
│   └── wecom-skill-sidecar.service
├── config.example.json
├── package.json               # version: 1.5.0
└── README.md                  # 本文件
```

## v1.5.2 新增能力（最近更新）

### 🆕 addressbook cache + flushCache（v1.5.2 P0-cache-extend）

5 个高频读方法加 24h TTL 缓存 + 企业微信 `change_type` 事件驱动 flush：

```js
const w = new WeComPlugin(config);

// 首次调用走 API，后续 24h 内走 cache
await w.addressbook.getUser('UserA');         // cache miss → POST /user/get
await w.addressbook.getUser('UserA');         // cache hit  → 0 网络

// 接到企微 change_type 事件 → daemon flushCache()
w.addressbook.flushCache();
// → { flushed: true, before: {users: 5, departments: 2, userDetails: 3} }
```

调试：在环境变量加 `WECOM_DEBUG_CACHE=1` 会在每条 cache hit/miss 打 info 日志。

### 🆕 6 个核心业务集成测试（v1.5.2 P1 + P2）

| 测试 | 行数 | 覆盖 | 实际 API |
|---|---|---|---|
| `integration-security.test.js` | 80 | 20 方法 / 10 URL | `/device/list`、`/security/get_admin_operation_log` |
| `integration-addressbook.test.js` | 115 | 42 方法 / cache hit/miss/flush | 验证本轮 P0-cache-extend 真生效 |
| `integration-approval.test.js` | 90 | 18 方法 / 8 URL + 高层转字段 | `/corp/getapprovaldata`、`/oa/journal/download` |
| `integration-media.test.js` | 103 | 7 方法 / 4 MIME | `/media/uploadimg`、`audio/amr` |
| `integration-messenger.test.js` | 85 | 12 方法 / 10 URL | `/externalcontact/add_msg_template` |
| `integration-school.test.js` | 110 | 21 方法 / 21 URL | 全部 v1.5.2 batch4 新加 9 个 |

跑全部测试：`npm test`（实际代码不接 wecom API，全部 stub request + URL 锁定）。

### 🆕 SDK dead-code 清理（v1.5.2 cleanup）

- `sdk/modules/addressbook_cache/`（9.4 KB）→ 移至 `sdk/_deprecated/addressbook_cache_v1.4.0/`
- `sdk/core/permission.js` 中 addressbook_cache 死权限块删除
- `sdk/callback-helper.js` 与 `sdk/utils/callback-helper.js` 合并 → 仅保留 utils 版（daemon 引用已更新）

## 累计修复 bug 数（v1.0.0 → v1.5.2）

- v1.0.0：12 个 switch↔module 签名 bug
- v1.0.1：6 个 SDK path/param 错
- v1.0.2：3 个 contactstats bug
- v1.1.0：2 个 document path
- v1.2.0：2 个 1Panel conf + systemd unit
- v1.3.0：8 个 approval/document/checkin/notify 端点
- v1.3.1：13 个 approval/meeting 端点 + submitApproval 双格式
- v1.4.0：73 个 externalcontact 端点（覆盖率 5% → 100%）
- v1.5.0：**64 个** journal 新增 + 高优先级模块修复 + meeting/checkin 大规模修复
- v1.5.2：**30 个新端点** (coverage-enhance batch1-5: addressbook/meeting/auth/approval/kf/security/oa/miniapppay/school/externalpay) + 20+ URL/MIME 错误修正（由集成测试揭露）+ 地址本缓存 + 死代码清理

**累计：~213 个 bug 修复，60 个 throw error 保护，13 个集成测试，doc API 覆盖率 78.0%（核心业务域 100%）**

## 已知限制

- **v1.0+ 不发消息**：发消息走 `~/.openclaw/extensions/` 下的 sunnoy/wecom 插件（`message` tool），不走本 skill
- **v1.0+ 不接收 HTTP 回调**：自建应用事件回调走 wecom-skill daemon（systemd --user）
- **CLI 同步阻塞**：长 API 调用会阻塞终端

## License

MIT