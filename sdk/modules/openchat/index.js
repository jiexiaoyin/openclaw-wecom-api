/**
 * 智能表格群聊模块
 * API 章节：八 - 智能表格自动化创建的群聊
 * 包含：获取群聊列表、群聊详情、修改群聊
 */

const WeComSDK = require('../../sdk');

class OpenChat extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 群聊管理 ==========

  /**
   * 获取群聊列表
   * @param {string} cursor 分页游标
   * @param {number} size 每页数量
   */
  async getChatList(cursor = '', size = 100) {
    return this.post('/openchat/list', { cursor, limit: size });
  }

  /**
   * 获取群聊详情
   * @param {string} openChatId 群聊 ID
   */
  async getChatDetail(openChatId) {
    return this.post('/openchat/get', { open_chatid: openChatId });
  }

  /**
   * 修改群聊（智能表格）
   * @param {string} openChatId 群聊 ID
   * @param {string} name 群名称
   * @param {string} owner 群主
   * @param {string} ownerType 群主类型: userid, open_userid
   */
  async updateChat(openChatId, { name, owner, ownerType }) {
    return this.post('/openchat/update', {
      open_chatid: openChatId,
      name,
      owner,
      owner_type: ownerType
    });
  }

  /**
   * 解散群聊
   * @param {string} openChatId 群聊 ID
   */
  async dismissChat(openChatId) {
    return this.post('/openchat/dismiss', { open_chatid: openChatId });
  }

  // ========== 群成员管理 ==========

  /**
   * 获取群成员列表
   * @param {string} openChatId 群聊 ID
   * @param {string} cursor 分页游标
   * @param {number} size 每页数量
   */
  async getMemberList(openChatId, cursor = '', size = 100) {
    return this.post('/openchat/member/list', {
      open_chatid: openChatId,
      cursor,
      limit: size
    });
  }

  /**
   * 添加群成员
   * @param {string} openChatId 群聊 ID
   * @param {string[]} userIds 成员 ID 列表
   */
  async addMembers(openChatId, userIds) {
    return this.post('/openchat/member/add', {
      open_chatid: openChatId,
      user_ids: userIds
    });
  }

  /**
   * 移除群成员
   * @param {string} openChatId 群聊 ID
   * @param {string[]} userIds 成员 ID 列表
   */
  async removeMembers(openChatId, userIds) {
    return this.post('/openchat/member/del', {
      open_chatid: openChatId,
      user_ids: userIds
    });
  }

  // ========== 群管理员管理 ==========

  /**
   * 设置群管理员
   * @param {string} openChatId 群聊 ID
   * @param {string} userId 成员 ID
   */
  async setAdmin(openChatId, userId) {
    return this.post('/openchat/set_admin', {
      open_chatid: openChatId,
      userid: userId
    });
  }

  /**
   * 取消群管理员
   * @param {string} openChatId 群聊 ID
   * @param {string} userId 成员 ID
   */
  async removeAdmin(openChatId, userId) {
    return this.post('/openchat/del_admin', {
      open_chatid: openChatId,
      userid: userId
    });
  }

  // ========== 群公告管理 ==========

  /**
   * 设置群公告
   * @param {string} openChatId 群聊 ID
   * @param {string} content 公告内容
   */
  async setAnnouncement(openChatId, content) {
    return this.post('/openchat/set_announcement', {
      open_chatid: openChatId,
      content
    });
  }

  /**
   * 获取群公告
   * @param {string} openChatId 群聊 ID
   */
  async getAnnouncement(openChatId) {
    return this.post('/openchat/get_announcement', { open_chatid: openChatId });
  }

  // ========== 群标签管理 ==========

  /**
   * 设置群标签
   * @param {string} openChatId 群聊 ID
   * @param {string[]} tagIds 标签 ID 列表
   */
  async setTags(openChatId, tagIds) {
    return this.post('/openchat/set_tag', {
      open_chatid: openChatId,
      tag_ids: tagIds
    });
  }

  /**
   * 移除群标签
   * @param {string} openChatId 群聊 ID
   * @param {string[]} tagIds 标签 ID 列表
   */
  async removeTags(openChatId, tagIds) {
    return this.post('/openchat/del_tag', {
      open_chatid: openChatId,
      tag_ids: tagIds
    });
  }

  // ========== 群发消息 ==========

  /**
   * 发送消息到群聊
   * @param {string} openChatId 群聊 ID
   * @param {object} content 消息内容
   * @param {string} msgType 消息类型
   */
  async sendMessage(openChatId, content, msgType = 'text') {
    return this.post('/openchat/send', {
      open_chatid: openChatId,
      msgtype: msgType,
      [msgType]: content
    });
  }

  /**
   * 发送模板卡片消息
   * @param {string} openChatId 群聊 ID
   * @param {object} cardData 卡片数据
   */
  async sendTemplateCard(openChatId, cardData) {
    return this.sendMessage(openChatId, cardData, 'template_card');
  }
}

module.exports = OpenChat;
