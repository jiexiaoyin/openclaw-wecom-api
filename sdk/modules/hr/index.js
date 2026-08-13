/**
 * 人事助手模块
 * API 章节：二十四 - 人事助手
 * 包含：花名册管理
 */

const WeComSDK = require('../../sdk');

class HR extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 花名册 ==========

  /**
   * 获取员工字段配置
   * @param {number} fieldType 字段类型: 1-系统字段 2-自定义字段
   */
  async getUserFields(fieldType = 1) {
    return this.post('/hr/getuserfieldconfig', { field_type: fieldType });
  }

  /**
   * 获取员工花名册信息
   * @param {string} userId 员工 userid
   * @param {string[]} fieldIds 字段 ID 列表
   */
  async getUserProfile(userId, fieldIds = []) {
    return this.post('/hr/getuserprofile', {
      userid: userId,
      field_ids: fieldIds
    });
  }

  /**
   * 批量获取员工花名册信息
   * @param {string[]} userIds 员工 userid 列表
   * @param {string[]} fieldIds 字段 ID 列表
   */
  async batchGetUserProfiles(userIds, fieldIds = []) {
    return this.post('/hr/batchgetuserprofile', {
      userids: userIds,
      field_ids: fieldIds
    });
  }

  /**
   * 更新员工花名册信息
   * @param {string} userId 员工 userid
   * @param {object} fieldData 字段数据
   */
  async updateUserProfile(userId, fieldData) {
    return this.post('/hr/updateuserprofile', {
      userid: userId,
      field_data: fieldData
    });
  }

  // ========== 员工入职管理 ==========

  /**
   * 获取入职登记表 ID
   * @param {string} groupId 登记表模板组 ID
   */
  async getRegisterId(groupId) {
    return this.post('/hr/get_register_id', { group_id: groupId });
  }

  /**
   * 获取员工登记信息
   * @param {string} registerId 登记表 ID
   * @param {string} userId 员工 userid
   */
  async getRegisterInfo(registerId, userId) {
    return this.post('/hr/get_register_info', {
      register_id: registerId,
      userid: userId
    });
  }

  // ========== 员工离职管理 ==========

  /**
   * 获取离职交接人员列表
   * @param {string} userId 离职员工 userid
   */
  async getDimissionHandoverList(userId) {
    return this.post('/hr/get_dimission_handover_list', { userid: userId });
  }
}

module.exports = HR;
