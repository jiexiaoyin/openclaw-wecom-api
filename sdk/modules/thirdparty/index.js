/**
 * 企业互联模块
 * API 章节：五 - 企业互联
 * 包含：获取下级企业 token、小程序 session 等
 */

const WeComSDK = require('../../sdk');

class ThirdParty extends WeComSDK {
  constructor(config) {
    super(config);
    this.providerSecret = config.providerSecret || '';
  }

  // ========== 企业互联基础 ==========

  /**
   * 获取下级/下游企业的 access_token
   * @param {string} corpId 下级企业 ID
   * @param {string} permanentCode 永久授权码
   */
  async getSubCorpToken(corpId, permanentCode) {
    return this.post('/thirdparty/get_sub_corp_token', {
      corpid: corpId,
      permanent_code: permanentCode
    });
  }

  /**
   * 获取下级企业授权码
   * @param {string} authCode 授权 code
   */
  async getPermanentCode(authCode) {
    return this.post('/thirdparty/get_permanent_code', { auth_code: authCode });
  }

  /**
   * 获取下级企业授权信息
   * @param {string} corpId 下级企业 ID
   */
  async getCorpInfo(corpId) {
    return this.post('/thirdparty/get_corp_info', { corpid: corpId });
  }

  /**
   * 获取下级企业列表
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getCorpList(offset = 0, size = 100) {
    return this.post('/thirdparty/get_corp_list', { offset, limit: size });
  }

  /**
   * 获取下级/下游企业小程序 session
   * @param {string} userId 用户 ID
   * @param {string} sessionKey 小程序 session key
   * @param {number} type 类型
   */
  async getSubCorpMiniProgramSession(userId, sessionKey, type = 1) {
    return this.post('/thirdparty/get_sub_corp_mini_program_session', {
      userid: userId,
      session_key: sessionKey,
      type
    });
  }

  /**
   * 获取应用共享信息
   * @param {string} agentId 应用 ID
   */
  async getCorpSharedInfo(agentId) {
    return this.post('/thirdparty/get_corp_shared_info', { agentid: agentId });
  }

  // ========== 通讯录同步 ==========

  /**
   * 激活下级企业
   * @param {string} corpId 下级企业 ID
   * @param {number} activateState 激活状态
   */
  async activateCorp(corpId, activateState = 1) {
    return this.post('/thirdparty/activate_corp', {
      corpid: corpId,
      activate_state: activateState
    });
  }

  /**
   * 设置下级企业同步范围
   * @param {string} corpId 下级企业 ID
   * @param {number[]} departmentIds 部门 ID 列表
   */
  async setSyncScope(corpId, departmentIds) {
    return this.post('/thirdparty/set_sync_scope', {
      corpid: corpId,
      department_ids: departmentIds
    });
  }

  // ========== 应用管理 ==========

  /**
   * 获取下级企业应用列表
   * @param {string} corpId 下级企业 ID
   */
  async getSubCorpAgentList(corpId) {
    return this.post('/thirdparty/agent/list', { corpid: corpId });
  }

  /**
   * 设置下级企业应用
   * @param {string} corpId 下级企业 ID
   * @param {number} agentId 应用 ID
   * @param {object} params 应用参数
   */
  async setSubCorpAgent(corpId, agentId, params) {
    return this.post('/thirdparty/agent/set', {
      corpid: corpId,
      agentid: agentId,
      ...params
    });
  }

  // ========== 消息推送 ==========

  /**
   * 给下级企业发送消息
   * @param {string} corpId 下级企业 ID
   * @param {string} toUser 接收成员
   * @param {object} content 消息内容
   * @param {string} msgType 消息类型
   */
  async sendToSubCorp(corpId, toUser, content, msgType = 'text') {
    return this.post('/thirdparty/message/send', {
      corpid: corpId,
      touser: toUser,
      msgtype: msgType,
      [msgType]: content
    });
  }
}

module.exports = ThirdParty;
