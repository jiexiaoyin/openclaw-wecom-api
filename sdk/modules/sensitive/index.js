/**
 * 敏感词管理模块
 * API 章节：十三 - 聊天敏感词
 * 包含：敏感词管理、敏感行为管理
 */

const WeComSDK = require('../../sdk');

class Sensitive extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 敏感词管理 ==========
  // v1.4.0 注释：文档将原 "敏感词" 收编为 "聊天敏感词拦截规则" 的子模块；
  //          7 个原 sensitive_word/* 端点全部 throw（文档无独立端点）

  /**
   * 获取敏感词列表
   * ⚠️ v1.4.0 暂禁：官方文档无 /externalcontact/get_sensitive_word_list 端点
   * 拦截规则（含敏感词）请用 getInterceptRuleList
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getSensitiveWordList(offset = 0, size = 100) {
    throw new Error('getSensitiveWordList 已废弃：官方文档无此端点（v1.4.0），请用 getInterceptRuleList');
    // return this.post('/externalcontact/get_intercept_rule_list', { offset, limit: size });
  }

  /**
   * 获取敏感词详情
   * ⚠️ v1.4.0 暂禁：官方文档无 /externalcontact/get_sensitive_word 端点
   * @param {string} wordId 敏感词 ID
   */
  async getSensitiveWordDetail(wordId) {
    throw new Error('getSensitiveWordDetail 已废弃：官方文档无此端点（v1.4.0）');
    // return this.post('/externalcontact/get_intercept_rule', { word_id: wordId });
  }

  /**
   * 添加敏感词
   * ⚠️ v1.4.0 暂禁：官方文档无 /externalcontact/add_sensitive_word 端点
   * 拦截规则（含敏感词）请用 addInterceptRule
   */
  async addSensitiveWord(word, wordType = 'keyword', ruleId = '') {
    throw new Error('addSensitiveWord 已废弃：官方文档无此端点（v1.4.0），请用 addInterceptRule');
    // return this.post('/externalcontact/add_intercept_rule', { word, word_type: wordType, rule_id: ruleId });
  }

  /**
   * 编辑敏感词
   * ⚠️ v1.4.0 暂禁：官方文档无 /externalcontact/update_sensitive_word 端点
   */
  async updateSensitiveWord(wordId, word) {
    throw new Error('updateSensitiveWord 已废弃：官方文档无此端点（v1.4.0），请用 updateInterceptRule');
    // return this.post('/externalcontact/update_intercept_rule', { word_id: wordId, word });
  }

  /**
   * 删除敏感词
   * ⚠️ v1.4.0 暂禁：官方文档无 /externalcontact/del_sensitive_word 端点
   */
  async deleteSensitiveWord(wordId) {
    throw new Error('deleteSensitiveWord 已废弃：官方文档无此端点（v1.4.0），请用 deleteInterceptRule');
    // return this.post('/externalcontact/del_intercept_rule', { word_id: wordId });
  }

  // ========== 敏感词规则管理 ==========
  // v1.4.0 全部重命名为 "intercept_rule"（拦截规则）

  /**
   * 获取敏感词规则列表
   * v1.4.0 修复：原 /externalcontact/get_sensitive_rule_list 错，正确 /externalcontact/get_intercept_rule_list
   */
  async getSensitiveRuleList() {
    return this.post('/externalcontact/get_intercept_rule_list', {});
  }

  /**
   * 获取敏感词规则详情
   * v1.4.0 修复：原 /externalcontact/get_sensitive_rule 错，正确 /externalcontact/get_intercept_rule
   */
  async getSensitiveRuleDetail(ruleId) {
    return this.post('/externalcontact/get_intercept_rule', {
      rule_id: ruleId
    });
  }

  /**
   * 添加敏感词规则
   * v1.4.0 修复：原 /externalcontact/add_sensitive_rule 错，正确 /externalcontact/add_intercept_rule
   */
  async addSensitiveRule(rule) {
    return this.post('/externalcontact/add_intercept_rule', rule);
  }

  /**
   * 编辑敏感词规则
   * v1.4.0 修复：原 /externalcontact/update_sensitive_rule 错，正确 /externalcontact/update_intercept_rule
   */
  async updateSensitiveRule(ruleId, rule) {
    return this.post('/externalcontact/update_intercept_rule', {
      rule_id: ruleId,
      ...rule
    });
  }

  /**
   * 删除敏感词规则
   * v1.4.0 修复：原 /externalcontact/del_sensitive_rule 错，正确 /externalcontact/del_intercept_rule
   */
  async deleteSensitiveRule(ruleId) {
    return this.post('/externalcontact/del_intercept_rule', {
      rule_id: ruleId
    });
  }

  // ========== 敏感操作管理 ==========

  /**
   * 获取成员敏感行为列表
   * ⚠️ v1.4.0 暂禁：官方文档无 /externalcontact/get_sensitive_action_list 端点
   * 如需成员敏感行为统计，请走 /externalcontact/get_user_behavior_data
   */
  async getSensitiveActionList(startTime, endTime, userId = '', type = '', offset = 0, size = 100) {
    throw new Error('getSensitiveActionList 已废弃：官方文档无此端点（v1.4.0），请用 getUserBehaviorData');
    // return this.post('/externalcontact/get_user_behavior_data', {
    //   start_time: startTime,
    //   end_time: endTime,
    //   userid: userId,
    //   type,
    //   offset,
    //   limit: size
    // });
  }

  // ========== 敏感成员配置 ==========

  /**
   * 获取使用敏感词的成员列表
   * ⚠️ v1.4.0 暂禁：官方文档无 /externalcontact/get_sensitive_word_users 端点
   */
  async getSensitiveWordUsers(wordId) {
    throw new Error('getSensitiveWordUsers 已废弃：官方文档无此端点（v1.4.0）');
    // return this.post('/externalcontact/get_intercept_rule', { word_id: wordId });
  }

  /**
   * 配置敏感词成员例外
   * ⚠️ v1.4.0 暂禁：官方文档无 /externalcontact/set_sensitive_word_exusers 端点
   */
  async setSensitiveWordExusers(wordId, userIds) {
    throw new Error('setSensitiveWordExusers 已废弃：官方文档无此端点（v1.4.0）');
    // return this.post('/externalcontact/update_intercept_rule', { word_id: wordId, user_ids: userIds });
  }
}

module.exports = Sensitive;
