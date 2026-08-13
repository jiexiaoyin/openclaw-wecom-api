/**
 * 安全管理模块
 * API 章节：七 - 安全管理
 * 包含：文件防泄漏、设备管理、截屏/录屏管理、高级功能账号管理、操作日志
 */

const WeComSDK = require('../../sdk');

class Security extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 文件防泄漏 ==========

  /**
   * 获取文件防泄漏规则列表
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getDlpRules(offset = 0, size = 100) {
    return this.post('/dlp/rules/list', { offset, limit: size });
  }

  /**
   * 获取文件防泄漏规则详情
   * @param {string} ruleId 规则 ID
   */
  async getDlpRuleDetail(ruleId) {
    return this.post('/dlp/rules/get', { rule_id: ruleId });
  }

  /**
   * 创建文件防泄漏规则
   * @param {object} rule 规则配置
   */
  async createDlpRule(rule) {
    return this.post('/dlp/rules/add', rule);
  }

  /**
   * 更新文件防泄漏规则
   * @param {string} ruleId 规则 ID
   * @param {object} rule 规则配置
   */
  async updateDlpRule(ruleId, rule) {
    return this.post('/dlp/rules/update', { rule_id: ruleId, ...rule });
  }

  /**
   * 删除文件防泄漏规则
   * @param {string} ruleId 规则 ID
   */
  async deleteDlpRule(ruleId) {
    return this.post('/dlp/rules/del', { rule_id: ruleId });
  }

  // ========== 设备管理 ==========

  // ========== VIP 权限管理 ==========

  /**
   * v1.5.2 coverage-enhance: 提交高级功能账号变更 (VIP 权限)
   * 用于批量调整企业内成员的"高级功能"使用权限
   * @param {string[]} userIds userid 列表
   * @param {number} action 1=开通, 2=关闭
   * @returns {Promise<object>} { errcode, errmsg, invalid_userid_list }
   */
  async submitVipAccount(userIds, action) {
    return this.post('/security/vip/submit', {
      userid_list: userIds,
      action
    });
  }


  /**
   * 获取设备列表
   * @param {string} deviceId 设备 ID
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getDeviceList(deviceId = '', offset = 0, size = 100) {
    return this.post('/device/list', {
      device_id: deviceId,
      offset,
      limit: size
    });
  }

  /**
   * 获取设备详情
   * @param {string} deviceId 设备 ID
   */
  async getDeviceDetail(deviceId) {
    return this.post('/device/get', { device_id: deviceId });
  }

  /**
   * 绑定设备
   * @param {string} deviceId 设备 ID
   * @param {string} userId 成员 ID
   */
  async bindDevice(deviceId, userId) {
    return this.post('/device/bind', { device_id: deviceId, userid: userId });
  }

  /**
   * 解绑设备
   * @param {string} deviceId 设备 ID
   */
  async unbindDevice(deviceId) {
    return this.post('/device/unbind', { device_id: deviceId });
  }

  /**
   * 获取设备使用记录
   * @param {string} deviceId 设备 ID
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   */
  async getDeviceLog(deviceId, startTime, endTime) {
    return this.post('/device/log', {
      device_id: deviceId,
      start_time: startTime,
      end_time: endTime
    });
  }

  // ========== 截屏/录屏管理 ==========

  /**
   * 获取截屏/录屏管理规则
   */
  async getScreenCaptureRule() {
    return this.post('/device/screen_capture/get', {});
  }

  /**
   * 设置截屏/录屏管理规则
   * @param {number} status 状态: 0-关闭 1-开启
   * @param {string} allowUsers 允许截屏的成员列表
   * @param {string} denyUsers 禁止截屏的成员列表
   */
  async setScreenCaptureRule(status, allowUsers = '', denyUsers = '') {
    return this.post('/device/screen_capture/set', {
      status,
      allow_users: allowUsers,
      deny_users: denyUsers
    });
  }

  // ========== 高级功能账号管理 ==========

  /**
   * 分配高级功能账号
   * @param {string} userId 成员 ID
   * @param {string} type 高级功能类型: exmail, wecom, file, yzp
   */
  async assignAdvancedAccount(userId, type) {
    return this.post('/security/assign_advanced_account', {
      userid: userId,
      type
    });
  }

  /**
   * 取消高级功能账号
   * @param {string} userId 成员 ID
   * @param {string} type 高级功能类型
   */
  async cancelAdvancedAccount(userId, type) {
    return this.post('/security/cancel_advanced_account', {
      userid: userId,
      type
    });
  }

  /**
   * 获取高级功能账号列表
   * @param {string} type 高级功能类型
   */
  async getAdvancedAccountList(type) {
    return this.post('/security/list_advanced_account', { type });
  }

  // ========== 操作日志 ==========

  /**
   * 获取成员操作记录
   * @param {string} userId 成员 ID
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getMemberOperationLog(userId, startTime, endTime, offset = 0, size = 100) {
    return this.post('/security/get_member_operation_log', {
      userid: userId,
      start_time: startTime,
      end_time: endTime,
      offset,
      limit: size
    });
  }

  /**
   * 获取管理端操作日志
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string} operUserId 操作人 ID
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getAdminOperationLog(startTime, endTime, operUserId = '', offset = 0, size = 100) {
    return this.post('/security/get_admin_operation_log', {
      start_time: startTime,
      end_time: endTime,
      oper_userid: operUserId,
      offset,
      limit: size
    });
  }

  /**
   * 获取企业微信域名 IP 信息
   */
  async getDomainIpList() {
    return this.post('/security/get_domain_ip_list', {});
  }

  /**
   * 获取回调 IP 段信息
   */
  async getCallbackIpList() {
    // v1.5.2 修复：路径 /security/get_callback_ip_list → /getcallbackip
    return this.get('/getcallbackip', {});
  }
}

module.exports = Security;
