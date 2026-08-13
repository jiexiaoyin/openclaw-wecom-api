/**
 * 数据与智能专区模块
 * API 章节：十二
 */

const WeComSDK = require('../../sdk');

class Intelligence extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 基础接口 ==========

  /**
   * 设置公钥
   * @param {string} publicKey 公钥
   */
  async setPublicKey(publicKey) {
    return this.post('/managle/setpublickey', { public_key: publicKey });
  }

  /**
   * 获取授权存档的成员列表
   */
  async getAllowedMembers() {
    return this.post('/managle/get_allow_list', {});
  }

  /**
   * 设置专区接收回调事件
   * @param {string} callbackUrl 回调 URL
   */
  async setCallbackUrl(callbackUrl) {
    return this.post('/managle/set_callback', { callback_url: callbackUrl });
  }

  /**
   * 会话组件敏感信息隐藏设置
   * @param {number} secretEnable 是否开启: 0-关闭 1-开启
   */
  async setSecret(secretEnable) {
    return this.post('/managle/set_secret', { secret: secretEnable });
  }

  /**
   * 设置日志打印级别
   * @param {number} logLevel 日志级别: 1-调试 2-提示 3-警告 4-错误
   */
  async setLogLevel(logLevel) {
    return this.post('/managle/set_log_level', { log_level: logLevel });
  }

  /**
   * 上传临时文件到专区
   * @param {string} filePath 文件路径
   */
  async uploadTempFile(filePath) {
    return this.uploadFile(filePath, 'media');
  }

  // ========== 会话记录获取 ==========

  /**
   * 获取会话记录
   * @param {string} seqId 消息序列号
   * @param {number} limit 返回数量
   */
  async getChatRecords(seqId, limit = 100) {
    return this.post('/managle/chatdata/get', {
      seq_id: seqId,
      limit
    });
  }

  /**
   * 获取会话同意情况
   */
  async getConsentList() {
    return this.post('/managle/chatdata/get_consent_list', {});
  }

  /**
   * 获取内部群信息
   * @param {string} roomId 群聊 id
   */
  async getGroupInfo(roomId) {
    return this.post('/managle/chatdata/get_room_info', { room_id: roomId });
  }

  /**
   * 会话名称搜索
   * @param {string} keyword 关键词
   * @param {number} limit 返回数量
   */
  async searchByRoomName(keyword, limit = 10) {
    return this.post('/managle/chatdata/search_by_room_name', {
      keyword,
      limit
    });
  }

  /**
   * 会话消息搜索
   * @param {string} keyword 关键词
   * @param {string} roomId 群聊 id (可选)
   * @param {number} limit 返回数量
   */
  async searchMessages(keyword, roomId, limit = 10) {
    return this.post('/managle/chatdata/search_by_msg', {
      keyword,
      room_id: roomId,
      limit
    });
  }

  /**
   * 员工或客户名称搜索
   * @param {string} keyword 关键词
   * @param {number} limit 返回数量
   */
  async searchUser(keyword, limit = 10) {
    return this.post('/managle/chatdata/search_by_user', {
      keyword,
      limit
    });
  }

  // ========== 关键词规则管理 ==========

  /**
   * 获取关键词规则列表
   */
  async getKeywordRules() {
    return this.post('/managle/keyword/get_rules', {});
  }

  /**
   * 新增关键词规则
   * @param {string} ruleName 规则名称
   * @param {string[]} keywords 关键词列表
   * @param {string} wordGroupId 词库组 id
   */
  async addKeywordRule(ruleName, keywords, wordGroupId) {
    return this.post('/managle/keyword/add_rule', {
      rule_name: ruleName,
      keyword_list: keywords,
      word_group_id: wordGroupId
    });
  }

  /**
   * 删除关键词规则
   * @param {string} ruleId 规则 id
   */
  async deleteKeywordRule(ruleId) {
    return this.post('/managle/keyword/del_rule', { rule_id: ruleId });
  }

  /**
   * 获取命中关键词规则的会话记录
   * @param {string} ruleId 规则 id
   * @param {number} limit 返回数量
   */
  async getHitRecords(ruleId, limit = 100) {
    return this.post('/managle/keyword/get_hit_records', {
      rule_id: ruleId,
      limit
    });
  }

  // ========== 知识库管理 ==========

  /**
   * 获取企业知识集列表
   */
  async getKnowledgeList() {
    return this.post('/managle/knowledge/list', {});
  }

  /**
   * 创建知识集
   * @param {string} name 知识集名称
   * @param {string} description 描述
   */
  async createKnowledge(name, description) {
    return this.post('/managle/knowledge/create', {
      name,
      description
    });
  }

  /**
   * 删除知识集
   * @param {string} knowledgeId 知识集 id
   */
  async deleteKnowledge(knowledgeId) {
    return this.post('/managle/knowledge/delete', { knowledge_id: knowledgeId });
  }

  /**
   * 添加知识条目
   * @param {string} knowledgeId 知识集 id
   * @param {string} question 问题
   * @param {string} answer 答案
   */
  async addKnowledgeItem(knowledgeId, question, answer) {
    return this.post('/managle/knowledge/add_item', {
      knowledge_id: knowledgeId,
      question,
      answer
    });
  }

  // ========== 会话内容导出 ==========

  /**
   * 会话内容导出
   * @param {string} roomId 群聊 id
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string} exportType 导出类型: all-全部, text-文本, file-文件
   */
  async exportChat(roomId, startTime, endTime, exportType = 'all') {
    return this.post('/managle/chatdata/export', {
      room_id: roomId,
      start_time: startTime,
      end_time: endTime,
      export_type: exportType
    });
  }

  /**
   * 获取导出结果
   * @param {string} taskId 任务 id
   */
  async getExportResult(taskId) {
    return this.post('/managle/chatdata/get_export_result', { task_id: taskId });
  }

  // ========== 情感分析 ==========

  /**
   * 情感分析
   * @param {string} content 待分析内容
   */
  async sentimentAnalysis(content) {
    return this.post('/managle/analysis/sentiment', { content });
  }

  // ========== 通用模型 ==========

  /**
   * 通用模型分析
   * @param {string} prompt 提示词
   * @param {string} query 查询内容
   */
  async generalModelAnalysis(prompt, query) {
    return this.post('/managle/model/general', { prompt, query });
  }

  // ========== 客户标签模型 ==========

  /**
   * 客户标签推荐
   * @param {string} userId 成员 ID
   * @param {string} externalUserId 外部客户 ID
   */
  async getCustomerTags(userId, externalUserId) {
    return this.post('/managle/model/customer_tag', {
      userid: userId,
      external_userid: externalUserId
    });
  }

  // ========== 会话摘要模型 ==========

  /**
   * 会话摘要
   * @param {string} roomId 群聊 ID
   * @param {string} msgId 消息 ID
   */
  async getChatSummary(roomId, msgId) {
    return this.post('/managle/model/summary', {
      room_id: roomId,
      msgid: msgId
    });
  }

  // ========== 自有模型分析 ==========

  /**
   * 异步调用自有分析程序
   * @param {string} programId 程序 ID
   * @param {object} inputData 输入数据
   */
  async callSelfModel(programId, inputData) {
    return this.post('/managle/model/self_analysis/async', {
      program_id: programId,
      input_data: inputData
    });
  }

  /**
   * 上报异步任务结果
   * @param {string} programId 程序 ID
   * @param {string} taskId 任务 ID
   * @param {string} result 结果
   * @param {string} errorMsg 错误信息
   */
  async reportTaskResult(programId, taskId, result, errorMsg = '') {
    return this.post('/managle/model/self_analysis/report', {
      program_id: programId,
      task_id: taskId,
      result,
      error_msg: errorMsg
    });
  }

  // ========== 会话反垃圾分析 ==========

  /**
   * 会话反垃圾分析
   * @param {string} content 待分析内容
   * @param {string} msgType 消息类型
   */
  async spamAnalysis(content, msgType = 'text') {
    return this.post('/managle/analysis/spam', { content, msg_type: msgType });
  }

  // ========== 话术推荐 ==========

  /**
   * 获取话术推荐
   * @param {string} content 客户消息
   * @param {string} scene 场景
   */
  async getRecommendReply(content, scene = 'default') {
    return this.post('/managle/recommend/get', {
      content,
      scene
    });
  }
}

module.exports = Intelligence;
