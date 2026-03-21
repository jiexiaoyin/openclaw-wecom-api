# wecomtool

企业微信 API 工具 OpenClaw 插件 | 继承 OpenClaw 端口，零额外配置

## 什么是 wecomtool？

wecomtool 是一个企业微信 API 工具，专为 OpenClaw 设计，直接继承 OpenClaw 的 HTTP 端口（80/443），无需额外部署回调服务。

## 核心功能

### 1. 消息收发
- 发送文本消息
- 发送图片、文件、语音、视频
- 发送卡片消息
- 发送 Markdown
- 群聊消息

### 2. 通讯录管理
- 获取部门列表
- 获取部门成员
- 成员详情查询
- 外部联系人管理

### 3. 客户联系
- 获取客户列表
- 客户详情查询
- 客户标签管理
- 客户群管理

### 4. 审批管理
- 获取审批模板
- 提交审批
- 审批回调通知

### 5. 会议管理
- 创建会议
- 查询会议详情
- 会议签到

### 6. 打卡考勤
- 打卡记录查询
- 打卡规则配置
- 打卡统计数据

### 7. 日程管理
- 创建日程
- 查询日程
- 日程提醒

### 8. 微信客服
- 客服消息发送
- 客户会话管理
- 客服接待状态

### 9. 回调处理
支持以下事件回调：
- 通讯录变更（成员/部门/标签）
- 外部联系人添加/删除
- 客户群创建/变更/解散
- 审批提交/通过
- 打卡记录
- 会议开始/结束
- 用户点击菜单
- 消息事件

### 10. 事件记录
- 自动记录所有回调事件
- 查询历史事件
- 导出事件数据

## 快速开始

```bash
# 1. 安装
git clone https://github.com/jiexiaoyin/wecomtool.git /root/.openclaw/extensions/wecomtool

# 2. 配置（两种方式）

# 方式一：交互式配置（推荐）
/skill wecomtool config
# 按提示填写企业ID、Secret、AgentID等

# 方式二：手动编辑
cp config.example.json config.json
vim config.json

# 3. 重启
openclaw gateway restart
```

## 配置回调地址

企业微信后台 → 应用管理 → 自建应用 → 设置API接收：

```
URL: https://你的域名/plugins/wecomtool/callback
Token: 你的Token（必填）
EncodingAESKey: 你的EncodingAESKey（可选）
```

## 使用命令

```bash
# 交互式配置（推荐）
/skill wecomtool config

# 测试连接
/skill wecomtool test_connection

# 查看配置
/skill weecomtool status

# === 消息 ===

# 发送文本
/skill wecomtool send_message --userId 用户ID --content "你好"

/* 发送图片 */
/skill wecomtool send_image --userId 用户ID --mediaId MEDIA_ID

/* 发送文件 */
/skill wecomtool send_file --userId 用户ID --mediaId MEDIA_ID


# === 通讯录 ===

# 获取部门列表
/skill wecomtool get_department_list

# 获取部门成员
/skill wecomtool get_user_list --departmentId 1

# 获取成员详情
/skill wecomtool get_user --userId 用户ID


# === 客户联系 ===

# 获取客户列表
/skill wecomtool get_customer_list --userId 用户ID


# === 审批 ===

# 获取审批列表
/skill wecomtool get_approval_list --startTime 1704067200 --endTime 1704153600


# === 会议 ===

# 创建会议
/skill wecomtool create_meeting --topic "周会" --startTime "2024-01-01 10:00" --endTime "2024-01-01 11:00"


# === 打卡 ===

# 获取打卡记录
/skill wecomtool get_checkin_records --startTime 1704067200 --endTime 1704153600 --userId 用户ID


# === 客户群 ===

# 获取客户群列表
/skill wecomtool get_groupchat_list --offset 0 --limit 100


# === 日程 ===

# 创建日程
/skill wecomtool create_schedule --content "会议" --startTime "2024-01-01 10:00" --endTime "2024-01-01 11:00"
```

## 支持的 API 模块（32+）

| 模块 | 说明 |
|------|------|
| message | 消息收发 |
| meeting | 会议管理 |
| schedule | 日程管理 |
| approval | 审批管理 |
| contact | 客户联系 |
| addressbook | 通讯录 |
| checkin | 打卡考勤 |
| custom | 微信客服 |
| media | 素材管理 |
| disk | 微盘管理 |
| document | 文档管理 |
| hr | 人事助手 |
| room | 会议室 |
| app | 应用管理 |
| security | 安全管控 |
| notification | 企业通知 |
| messenger | 企业 messenger |
| moments | 企业朋友圈 |
| phone | 企业电话 |
| live | 直播 |
| disk | 网盘 |
| school | 企业学校 |
| sensitive | 敏感词管理 |
| thirdparty | 第三方应用 |

## 文件说明

```
wecomtool/
├── config.json              # 配置文件（也可通过 /skill wecomtool config 交互式配置）
├── plugin.ts               # OpenClaw 插件入口
├── openclaw.plugin.json    # 插件清单
├── package.json
│
├── src/
│   ├── index.js            # 主入口
│   ├── config.js           # 配置加载
│   ├── config.cjs          # 备用配置
│   │
│   ├── callback/          # 回调处理
│   │   └── index.js
│   │
│   └── modules/            # 32+ API 模块
│       ├── message/
│       ├── approval/
│       ├── contact/
│       ├── meeting/
│       ├── schedule/
│       ├── checkin/
│       ├── addressbook/
│       ├── custom/
│       ├── media/
│       └── ...
│
└── skills/
    └── wecomtool/          # OpenClaw Skill
        ├── index.js
        └── SKILL.md
```

## 常见问题

**回调验证失败？**
- 确认 Token 与企业微信后台一致
- 确认域名已解析到服务器
- 重启 OpenClaw：`openclaw gateway restart`

**如何更新？**
```bash
cd /root/.openclaw/extensions/wecomtool
git pull
openclaw gateway restart
```

**独立运行可以吗？**
- 不支持，本插件仅支持 OpenClaw 插件模式

## 获取参数

| 参数 | 位置 |
|------|------|
| corpId | 企业微信 → 我的企业 → 企业信息 → 企业ID |
| corpSecret | 企业微信 → 应用管理 → 自建应用 → 查看详情 |
| agentId | 企业微信 → 应用管理 → 自建应用 → 查看详情 |
| token | 企业微信 → 应用管理 → 自建应用 → 设置API接收 |
| encodingAESKey | 企业微信 → 应用管理 → 自建应用 → 设置API接收 |

---

**⚠️ 免责声明**

本插件基于 OpenClaw 平台开发，旨在提供便捷的企业微信 API 调用能力。由于是个人开发者通过 AI 辅助开发，代码可能存在不完善之处或潜在的 BUG。

在使用过程中遇到任何问题，欢迎提交 Issues：
https://github.com/jiexiaoyin/wecomtool/issues

## License

MIT
