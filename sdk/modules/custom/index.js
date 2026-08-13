/**
 * 微信客服模块
 * API 章节：十四
 */

const WeComSDK = require('../../sdk');

class Custom extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 客服账号管理 ==========

  /**
   * 添加客服账号
   * @param {string} name 客服名称
   * @param {string} mediaId 客服头像 media_id
   */
  async addCustomAccount(name, mediaId) {
    return this.post('/customservice/add_kf_account', {
      name,
      media_id: mediaId
    });
  }

  /**
   * 删除客服账号
   * @param {string} account 客服账号 (格式: openid@corpid)
   */
  async deleteCustomAccount(account) {
    return this.post('/customservice/del_kf_account', { kf_account: account });
  }

  /**
   * 修改客服账号
   * @param {string} account 客服账号
   * @param {string} name 客服名称
   * @param {string} mediaId 客服头像 media_id
   */
  async updateCustomAccount(account, name, mediaId) {
    return this.post('/customservice/update_kf_account', {
      kf_account: account,
      name,
      media_id: mediaId
    });
  }

  /**
   * 获取客服账号列表
   */
  async getCustomAccountList() {
    return this.post('/customservice/get_kf_list', {});
  }

  /**
   * 获取客服账号链接
   * @param {string} account 客服账号
   * @param {string} openId 客户 openid
   */
  async getCustomAccountLink(account, openId) {
    return this.post('/customservice/get_kf_link', {
      kf_account: account,
      openid: openId
    });
  }

  // ========== 接待人员管理 ==========

  /**
   * 添加接待人员
   * @param {string} userId 成员 userid
   */
  async addServicer(userId) {
    return this.post('/customservice/add_servicer', { userid: userId });
  }

  /**
   * 删除接待人员
   * @param {string} userId 成员 userid
   */
  async removeServicer(userId) {
    return this.post('/customservice/del_servicer', { userid: userId });
  }

  /**
   * 获取接待人员列表
   */
  async getServicerList() {
    return this.post('/customservice/get_servicer_list', {});
  }

  // ========== 会话分配 ==========

  /**
   * 分配客服会话
   * @param {string} openId 客户 openid
   * @param {string} account 客服账号
   * @param {string} acceptAccount 接起会话的客服账号
   */
  async assignSession(openId, account, acceptAccount) {
    return this.post('/customservice/transfer_customer', {
      openid: openId,
      kf_account: account,
      accept_kf_account: acceptAccount
    });
  }

  // ========== 消息收发 ==========

  /**
   * 发送消息给客户
   * @param {string} openId 客户 openid
   * @param {object} msg 消息内容
   */
  async sendMessage(openId, msg) {
    return this.post('/customservice/send_msg', {
      touser: openId,
      msgtype: msg.msgType,
      content: msg.content
    });
  }

  /**
   * 发送欢迎语
   * @param {string} openId 客户 openid
   * @param {string} welcomeCode 欢迎语 code
   * @param {object} msg 消息内容
   */
  async sendWelcome(openId, welcomeCode, msg) {
    return this.post('/customservice/send_welcome_msg', {
      openid: openId,
      welcome_code: welcomeCode,
      msgtype: msg.msgType,
      content: msg.content
    });
  }
}

module.exports = Custom;
