# WeCom API Skill

企业微信 API 调用技能，支持客户管理、审批、会议、打卡、通讯录、素材等操作。

> 💡 注意：消息发送统一由 @sunnoy/wecom 通道处理，本技能不暴露发送消息相关动作。

## 触发方式

当用户提到企业微信相关操作时自动触发，如"查询客户"、"创建会议"、"查打卡记录"等。

## 参数说明

所有参数通过自然语言传递，支持以下字段：

| 参数 | 类型 | 说明 |
|------|------|------|
| userId / toUser | string | 用户ID或手机号/邮箱 |
| externalUserId | string | 外部联系人ID |
| agentId | string | 应用AgentID |
| content / text | string | 消息内容 |
| startTime / endTime | number | 时间戳（毫秒） |
| startDate / endDate | string | 日期（YYYY-MM-DD） |
| departmentId | number | 部门ID，默认1 |
| filePath | string | 文件路径 |
| chatId | string | 群ID |

## 支持的动作

### 👥 客户联系

| 动作 | 说明 |
|------|------|
| `get_customer_list` | 获取客户列表 |
| `get_customer_detail` | 获取客户详情 |
| `get_external_user_info` | 获取外部联系人信息 |
| `batch_get_customers` | 批量获取客户详情 |
| `update_customer_remark` | 更新客户备注 |
| `get_corp_tags` | 获取企业标签 |
| `add_corp_tag` | 添加企业标签 |
| `update_corp_tag` | 更新标签 |
| `get_groupchat_list` | 获取客户群列表 |
| `get_groupchat` | 获取客户群详情 |

### 📊 客户统计

| 动作 | 说明 |
|------|------|
| `get_user_client_stat` | 员工客户统计数据 |
| `get_all_user_client_stat` | 全量员工客户统计 |
| `get_user_client_detail` | 员工客户明细 |
| `get_group_chat_stat` | 客户群统计 |
| `get_user_lost_stat` | 客户流失统计 |

### 📋 审批

| 动作 | 说明 |
|------|------|
| `get_approval_list` | 获取审批列表 |
| `get_approval_detail` | 获取审批详情 |
| `get_template_detail` | 获取审批模板详情 |
| `submit_approval` | 提交审批 |
| `get_leave_config` | 获取假期配置 |
| `get_leave_balance` | 获取假期余额 |
| `create_template` | 创建审批模板 |
| `update_template` | 更新审批模板 |

### 📅 会议

| 动作 | 说明 |
|------|------|
| `create_meeting` | 创建会议 |
| `get_meeting_list` | 获取会议列表 |
| `get_meeting_detail` | 获取会议详情 |
| `cancel_meeting` | 取消会议 |
| `invite_meeting` | 邀请成员参会 |

### 🏢 通讯录

| 动作 | 说明 |
|------|------|
| `get_user_list` | 获取部门成员 |
| `get_department_users_detail` | 获取部门成员详情 |
| `get_department_list` | 获取部门列表 |
| `get_user` | 获取用户详情 |
| `get_user_by_mobile` | 手机号查用户 |
| `get_user_by_email` | 邮箱查用户 |
| `create_user` | 创建成员 |
| `update_user` | 更新成员信息 |
| `delete_user` | 删除成员 |

### ⏰ 打卡

| 动作 | 说明 |
|------|------|
| `get_checkin_records` | 获取打卡记录 |
| `get_checkin_rules` | 获取打卡规则 |

### 📆 日程

| 动作 | 说明 |
|------|------|
| `create_calendar` | 创建日历 |
| `get_calendar` | 获取日历详情 |
| `create_event` | 创建日程事件 |
| `update_event` | 更新日程事件 |
| `delete_event` | 删除日程 |
| `add_event_attendees` | 添加参与者 |

### 📁 素材

| 动作 | 说明 |
|------|------|
| `upload_image` | 上传图片 |
| `upload_media` | 上传媒体文件 |
| `get_media` | 下载媒体文件 |
| `get_high_definition_voice` | 获取高清语音 |

### 📱 应用

| 动作 | 说明 |
|------|------|
| `get_agent_list` | 获取应用列表 |
| `get_agent` | 获取应用详情 |
| `set_agent` | 设置应用 |

### 🔧 工具

| 动作 | 说明 |
|------|------|
| `get_token` | 获取 AccessToken |
| `get_callback_ip` | 获取回调IP |

### ⚙️ 配置

| 动作 | 说明 |
|------|------|
| `status` / `show_config` | 查看当前配置 |
| `test_connection` | 测试连接 |

## 使用示例

```
查一下张三的客户列表
查询昨天的打卡记录
创建一个会议，主题是周会，时间是明天下午2点
查一下客户统计，从3月1日到3月7日
上传图片到素材库
获取审批列表，3月1日到3月7日
给李四添加客户备注
查一下客户群列表
获取假期余额
查一下客户流失统计
```
