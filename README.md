# wecomtool

企业微信 API 工具 OpenClaw 插件 | 继承 OpenClaw 端口，零额外配置

## 什么是 wecomtool？

wecomtool 是一个企业微信 API 工具，专为 OpenClaw 设计，直接继承 OpenClaw 的 HTTP 端口（80/443），无需额外部署回调服务。

## 核心功能

- **32+ API 模块**：消息、会议、审批、打卡、客户联系等
- **智能回调处理**：自动识别加密/明文消息
- **事件记录**：自动记录所有回调事件
- **两种模式**：独立加密模式 / 共用明文模式
- **权限控制**：支持 admin/manager/staff 三级角色

## 快速开始

```bash
# 1. 安装
git clone https://github.com/jiexiaoyin/wecomtool.git /root/.openclaw/extensions/wecomtool

# 2. 配置
cp config.example.json config.json
vim config.json

# 3. 重启
openclaw gateway restart
```

## 配置说明

```json
{
  "corpId": "你的企业ID",
  "corpSecret": "你的应用Secret",
  "agentId": "你的应用AgentID",
  "token": "回调Token",
  "encodingAESKey": "EncodingAESKey",
  "callbackMode": "independent"
}
```

| 参数 | 说明 |
|------|------|
| corpId | 企业ID（必填） |
| corpSecret | 应用Secret（必填） |
| agentId | 应用AgentID（必填） |
| token | 回调Token（独立模式必填） |
| encodingAESKey | 回调加密Key（独立模式必填） |
| callbackMode | 回调模式：`independent`（独立）或 `shared`（共用） |

## 回调模式

### 模式一：独立模式（默认）

适用于单独使用 wecomtool。

```
企业微信 → 加密消息 → wecomtool → 验证签名 → 解密 → 处理
```

配置：`callbackMode: "independent"`，`token` 和 `encodingAESKey` 必填。

### 模式二：共用模式

适用于与 YanHaidao/wecom 共用回调地址。

```
企业微信 → 加密消息 → YanHaidao/wecom → 验证签名 → 解密 → 处理
                              ↓ Nginx mirror
                        wecomtool → 跳过验证 → 解密 → 处理
```

配置：`callbackMode: "shared"`，`token` 和 `encodingAESKey` 可留空。

**重要**：共用模式下，wecomtool 跳过签名验证（由 YanHaidao/wecom 统一验证），但仍会解密消息。

## Nginx Mirror 配置（共用模式）

```nginx
# 主插件回调地址
location /plugins/wecom/callback {
    mirror /plugins/wecomtool/callback;
    mirror_request_body on;
    proxy_pass http://127.0.0.1:18789;
}

# wecomtool 回调地址（mirror 目标）
location = /plugins/wecomtool/callback {
    internal;
    proxy_pass http://127.0.0.1:18789;
}
```

## 使用命令

```bash
# 测试连接
/skill wecomtool test_connection

# 查看配置
/skill wecomtool status

# 发送消息
/skill wecomtool send_message --userId 用户ID --content "你好"
```

## 支持的 API 模块

| 模块 | 说明 |
|------|------|
| message | 消息收发 |
| meeting | 会议管理 |
| schedule | 日程管理 |
| approval | 审批管理 |
| contact | 客户联系 |
| contact_stats | 客户统计（含智能判断） |
| addressbook | 通讯录 |
| checkin | 打卡考勤 |
| custom | 微信客服 |
| media | 素材管理 |
| ... | 更多 |

## ⚠️ 客户统计 API 重要限制

### 数据时效限制

| 数据类型 | 查询方式 | 说明 |
|----------|----------|------|
| **历史数据** | API 查询 | 可查询昨天及之前的数据 |
| **当日数据** | 事件回调 | 只能通过事件回调获取实时数据 |

**原因**：企业微信统计 API 无法查询当天数据。

### 多用户查询限制

| 查询方式 | 返回结果 |
|----------|----------|
| 传入多个 userid | 返回**总体数据**，不是每人一条 |
| 逐个传入 userid | 可获取**个人数据** |

**建议**：如需查看每个员工的统计数据，需循环调用 API。

### 智能统计方法

wecomtool 提供 `getUserClientStatSmart()` 方法，自动判断日期范围：

```javascript
const wecom = new WeComTool(config);
const contactStats = wecom.contact_stats;

// 查询最近7天（自动处理今天和历史数据）
const stats = await contactStats.getUserClientStatSmart(
  startTime,  // 7天前时间戳
  endTime,    // 当前时间戳
  'user1,user2'
);

// 返回结构
// {
//   isTodayIncluded: true,
//   historical: { ... },  // 历史数据（API返回）
//   today: {             // 当日实时数据
//     newCustomers: 5,
//     lostCustomers: 1,
//     messagesSent: 23,
//     chatsCount: 12,
//     applications: 3
//   }
// }
```

### 事件回调统计

当收到以下事件时，可调用 `updateTodayStats()` 更新当日统计：

| 事件类型 | 统计指标 |
|----------|----------|
| `add_external_contact` | 新增客户数 |
| `del_external_contact` | 删除/拉黑客户数 |
| `change_external_contact` | 客户变更 |
| 消息发送事件 | 发送消息数、聊天数 |

```javascript
// 在事件回调中调用
contactStats.updateTodayStats('add_external_contact', { userId, externalUserId });
```

## 支持的回调事件

### 客户联系事件
| 事件 | 说明 |
|------|------|
| `add_external_contact` | 添加客户 |
| `del_external_contact` | 删除客户 |
| `edit_external_contact` | 编辑客户 |
| `change_external_contact` | 客户变更 |
| `add_half_external_contact` | 添加半程客户 |
| `del_follow_user` | 删除跟进成员 |
| `transfer_fail` | 分配失败 |

### 客户联系增强事件
| 事件 | 说明 |
|------|------|
| `add_contact_way` | 添加联系我 |
| `del_contact_way` | 删除联系我 |
| `add_join_way` | 添加入群方式 |
| `del_join_way` | 删除入群方式 |
| `kf_msg_push` | 客服消息推送 |
| `kf_msg_send` | 客服消息发送 |

### 客户群事件
| 事件 | 说明 |
|------|------|
| `create_chat` | 创建群聊 |
| `update_chat` | 群聊变更 |
| `dismiss_chat` | 群聊解散 |

### 通讯录变更事件
| 事件 | 说明 |
|------|------|
| `change_member` | 成员变更 |
| `change_department` | 部门变更 |
| `change_tag` | 标签变更 |

### 会议事件
| 事件 | 说明 |
|------|------|
| `meeting_start` | 会议开始 |
| `meeting_end` | 会议结束 |
| `meeting_created` | 会议创建 |
| `meeting_cancelled` | 会议取消 |
| `meetingParticipantJoin` | 成员加入会议 |
| `meetingParticipantLeave` | 成员离开会议 |

### 消息事件
| 事件 | 说明 |
|------|------|
| `message` | 消息接收 |
| `enter_agent` | 进入应用 |
| `user_click` | 菜单点击 |
| `view` | 链接访问 |

### 审批事件
| 事件 | 说明 |
|------|------|
| `submit_approval` | 提交审批 |
| `Approval` | 审批通过 |

### 打卡事件
| 事件 | 说明 |
|------|------|
| `checkin` | 打卡事件 |
| `report_checkin` | 打卡数据 |

### 直播事件
| 事件 | 说明 |
|------|------|
| `living_status` | 直播状态变更 |

## 文件结构

```
wecomtool/
├── config.json              # 配置文件
├── config.example.json      # 配置示例
├── plugin.cjs             # OpenClaw 插件入口
├── openclaw.plugin.json    # 插件清单
├── package.json
│
└── src/
    ├── index.js           # 主入口（WeComPlugin 类）
    ├── config.js          # 配置加载
    ├── callback-helper.js  # 回调处理工具
    ├── crypto.js          # 加密工具
    ├── sdk/               # SDK 相关
    └── modules/           # 32+ API 模块
        ├── message/
        ├── approval/
        ├── contact/
        └── ...
```

## 更新

```bash
cd /root/.openclaw/extensions/wecomtool
git pull
openclaw gateway restart
```

## 常见问题

**审批 API 查询失败？**
- 企业微信审批 API 必须通过 `template_id` 查询审批单
- `template_id` 获取方式：企业微信后台 → 应用管理 → 审批 → 查看模板ID
- 模板配置文件：`config/approval-templates.json`（本地私有，不同步 GitHub）

**回调验证失败？**
- 确认 Token 与企业微信后台一致
- 确认域名已解析到服务器
- 重启 OpenClaw

**共用模式收不到消息？**
- 确认 `callbackMode` 为 `"shared"`
- 确认 Nginx mirror 配置正确

---

**⚠️ 免责声明**

本插件基于 OpenClaw 平台开发，代码可能存在 BUG，欢迎提交 Issues：
https://github.com/jiexiaoyin/wecomtool/issues

## License

MIT
