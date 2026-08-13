/**
 * 紧急通知模块
 * API 章节：二十七 - 紧急通知应用
 * 包含：发起语音电话、获取接听状态
 *
 * v1.3.0 修复：
 *   - 全部路径去掉前导空格（原代码写成 '/ instantservice/...' 100% 404）
 *   - 真实端点位于 /pstncc/* 而非 /instantservice/*
 *   - 删除 sendCorpReminder / sendWorkNoticeReminder（官方文档无对应端点）
 */

const WeComSDK = require('../../sdk');

class Notify extends WeComSDK {
  constructor(config) {
    super(config);
  }

  /**
   * 发起语音电话
   * v1.3.0 修复：
   *   - 去掉前导空格（原 '/ instantservice/voicenotify' → '/instantservice/voicenotify'）
   *   - 真实端点为 /pstncc/call（v1.3.0 文档验证）
   * @param {string} calleeUserId 成员 ID（v1.3.0 字段名调整：原 userid → callee_userid）
   * @param {string[]} calleeUserIds 被通知成员列表
   */
  async sendVoiceCall(calleeUserId, calleeUserIds) {
    // v1.3.0 文档原样：{ callee_userid: [...] }
    return this.post('/pstncc/call', {
      callee_userid: calleeUserIds || [calleeUserId]
    });
  }

  /**
   * 批量发起语音电话
   * v1.3.0 简化：与 sendVoiceCall 同语义，文档无独立端点
   * @param {string|string[]} users 单个 userId 或用户列表
   */
  async batchSendVoiceCall(users) {
    const userIds = Array.isArray(users) ? users : [users];
    return this.sendVoiceCall(null, userIds);
  }

  /**
   * 获取语音电话接听状态
   * v1.3.0 修复：
   *   - 去掉前导空格
   *   - 真实端点为 /pstncc/getstates（v1.3.0 文档验证）
   * @param {string} calleeUserId 成员 userid
   * @param {string} callId 发起语音电话时返回的 callid
   * @returns {Promise<{states: Array<{userid, callid, state}>}>}
   */
  async getVoiceNotifyStatus(calleeUserId, callId) {
    return this.post('/pstncc/getstates', {
      callee_userid: calleeUserId,
      callid: callId
    });
  }

  // ========== 以下方法 v1.3.0 已移除 ==========

  /**
   * 发送企业提醒
   * ⚠️ v1.3.0 暂禁：官方文档无 /instantservice/corp_reminder 端点
   * 若需企业提醒，请走 externalcontact 模块（/cgi-bin/externalcontact/message/send）
   */
  async sendCorpReminder(userId, content, toUsers) {
    throw new Error('sendCorpReminder 已废弃：官方文档无此端点（v1.3.0），请走 externalcontact 模块');
    // return this.post('/instantservice/corp_reminder', {
    //   userid: userId,
    //   content,
    //   to_users: toUsers
    // });
  }

  /**
   * 发送工作通知提醒
   * ⚠️ v1.3.0 暂禁：官方文档无 /instantservice/worknotice_reminder 端点
   * 若需发工作通知，请走 message 模块（/cgi-bin/message/send 的 textcard 类型）
   */
  async sendWorkNoticeReminder(userId, content, toUsers, agentId) {
    throw new Error('sendWorkNoticeReminder 已废弃：官方文档无此端点（v1.3.0），请走 message 模块');
    // return this.post('/instantservice/worknotice_reminder', {
    //   userid: userId,
    //   content,
    //   to_users: toUsers,
    //   agentid: agentId
    // });
  }
}

module.exports = Notify;
