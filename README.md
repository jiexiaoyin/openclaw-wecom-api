# wecomtool

企业微信 API 工具 OpenClaw 插件 | 继承 OpenClaw 端口，零额外配置

## 什么是 wecomtool？

wecomtool 是一个企业微信 API 工具，专为 OpenClaw 设计，直接继承 OpenClaw 的 HTTP 端口（80/443），无需额外部署回调服务。

## 核心功能

- **32+ API 模块**：消息、会议、审批、打卡、客户联系等
- **智能回调处理**：自动识别加密/明文消息
- **事件记录**：自动记录所有回调事件
- **两种模式**：独立加密模式 / 共用明文模式

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
| token | 回调Token |
| encodingAESKey | 回调加密Key |
| callbackMode | 回调模式：`independent` 或 `shared` |

## 回调模式

### 模式一：独立模式（默认）

适用于单独使用 wecomtool。

```
企业微信 → 加密消息 → wecomtool → 自动解密 → 处理
```

配置：`callbackMode: "independent"`，`token` 和 `encodingAESKey` 必填。

### 模式二：共用模式

适用于与 YanHaidao/wecom 共用回调地址。

```
企业微信 → 加密消息 → YanHaidao/wecom → 解密 → 处理
                              ↓ Nginx mirror
                        wecomtool → 跳过解密 → 处理明文
```

配置：`callbackMode: "shared"`，`token` 和 `encodingAESKey` 可留空。

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
| addressbook | 通讯录 |
| checkin | 打卡考勤 |
| custom | 微信客服 |
| media | 素材管理 |
| ... | 更多 |

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
