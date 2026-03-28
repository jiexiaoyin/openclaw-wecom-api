---
name: wecom-api
description: |
  企业微信 API 工具库。激活当用户提到企业微信 API、wecom-api，或需要调用企业微信 API 时。
  同时支持交互式配置：说"配置企业微信"或"设置wecom-api"来启动配置向导。
---

# WeCom Tool

企业微信 API 封装，提供 30+ 个模块的接口调用能力。

## 交互式配置

当用户说"配置企业微信"、"设置wecom"或"wecom配置"时，触发配置向导：

```
配置企业微信
```

配置向导会引导用户输入：
1. 企业ID (corpId)
2. 应用Secret (corpSecret)
3. 应用AgentID (agentId)
4. 回调Token（可选）
5. 回调EncodingAESKey（可选）

配置完成后会自动保存到 config.json。

## 使用示例

```
# 测试连接
/skill wecom-api test_connection

# 发送消息
/skill wecom-api send_message --userId user001 --content "Hello"

# 获取客户列表
/skill wecom-api get_customer_list --userId user001
```
