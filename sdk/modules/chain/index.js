/**
 * 上下游管理模块
 * API 章节：六 - 上下游
 * 包含：基础接口、上下游通讯录管理、上下游规则、回调事件
 */

const WeComSDK = require('../../sdk');

class Chain extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 基础接口 ==========

  /**
   * 获取应用共享信息
   * @param {string} agentId 应用 ID
   */
  async getCorpSharedInfo(agentId) {
    return this.post('/thirdparty/get_corp_shared_info', { agentid: agentId });
  }

  /**
   * 获取下级/下游企业的 access_token
   * @param {string} corpId 下级企业 ID
   */
  async getSubCorpToken(corpId) {
    return this.post('/thirdparty/get_sub_corp_token', { corpid: corpId });
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
   * 获取上下游关联客户信息（已添加客户）
   * @param {string} userId 成员 ID
   * @param {string} externalUserId 外部客户 ID
   */
  async getChainCustomerInfo(userId, externalUserId) {
    return this.post('/externalchain/get_customer_info', {
      userid: userId,
      external_userid: externalUserId
    });
  }

  /**
   * 获取上下游关联客户信息（未添加客户）
   * @param {string} chainId 上下游 ID
   * @param {string} userId 成员 ID
   */
  async getChainPendingCustomerInfo(chainId, userId) {
    return this.post('/externalchain/get_pending_customer_info', {
      chain_id: chainId,
      userid: userId
    });
  }

  // ========== 上下游通讯录管理 ==========

  /**
   * 获取上下游信息
   * @param {string} chainId 上下游 ID
   */
  async getChainInfo(chainId) {
    return this.post('/externalchain/get_chain_info', { chain_id: chainId });
  }

  /**
   * 批量导入上下游联系人
   * @param {string} chainId 上下游 ID
   * @param {number} importType 导入类型: 1-成员 2-客户
   * @param {string} mediaId 文件 ID
   */
  async importChainContacts(chainId, importType, mediaId) {
    return this.post('/externalchain/import_contacts', {
      chain_id: chainId,
      import_type: importType,
      media_id: mediaId
    });
  }

  /**
   * 获取异步任务结果
   * @param {string} jobId 任务 ID
   */
  async getChainJobResult(jobId) {
    return this.post('/externalchain/get_job_result', { jobid: jobId });
  }

  /**
   * 移除企业
   * @param {string} chainId 上下游 ID
   * @param {string} corpId 企业 ID
   */
  async removeChainCorp(chainId, corpId) {
    return this.post('/externalchain/remove_corp', {
      chain_id: chainId,
      corpid: corpId
    });
  }

  /**
   * 查询成员自定义 ID
   * @param {string} customId 成员自定义 ID
   */
  async getMemberCustomIdInfo(customId) {
    return this.post('/externalchain/get_member_custom_id', { custom_id: customId });
  }

  /**
   * 获取下级企业加入的上下游
   * @param {string} corpId 下级企业 ID
   */
  async getSubCorpChains(corpId) {
    return this.post('/externalchain/get_sub_corp_chains', { corpid: corpId });
  }

  // ========== 上下游规则管理 ==========

  /**
   * 获取对接规则 ID 列表
   * @param {string} chainId 上下游 ID
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getChainRuleIds(chainId, offset = 0, size = 100) {
    return this.post('/externalchain/get_rule_id_list', {
      chain_id: chainId,
      offset,
      limit: size
    });
  }

  /**
   * 删除对接规则
   * @param {string} chainId 上下游 ID
   * @param {string} ruleId 规则 ID
   */
  async deleteChainRule(chainId, ruleId) {
    return this.post('/externalchain/delete_rule', {
      chain_id: chainId,
      rule_id: ruleId
    });
  }

  /**
   * 获取对接规则详情
   * @param {string} chainId 上下游 ID
   * @param {string} ruleId 规则 ID
   */
  async getChainRuleDetail(chainId, ruleId) {
    return this.post('/externalchain/get_rule_detail', {
      chain_id: chainId,
      rule_id: ruleId
    });
  }

  /**
   * 新增对接规则
   * @param {object} rule 规则配置
   */
  async createChainRule(rule) {
    return this.post('/externalchain/add_rule', rule);
  }

  /**
   * 更新对接规则
   * @param {string} chainId 上下游 ID
   * @param {string} ruleId 规则 ID
   * @param {object} rule 规则配置
   */
  async updateChainRule(chainId, ruleId, rule) {
    return this.post('/externalchain/update_rule', {
      chain_id: chainId,
      rule_id: ruleId,
      ...rule
    });
  }
}

module.exports = Chain;
