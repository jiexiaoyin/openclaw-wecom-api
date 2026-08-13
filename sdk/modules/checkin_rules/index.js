/**
 * 打卡规则管理模块
 * API 章节：二十一 - 打卡（规则管理）
 * 包含：管理打卡规则、设备打卡数据
 */

const WeComSDK = require('../../sdk');

class CheckInRules extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 打卡规则管理 ==========

  /**
   * 获取企业所有打卡规则
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getCheckInRules(offset = 0, size = 100) {
    // v1.5.2 修复：v1.5.0 误判废弃，实际端点 /checkin/getcorpcheckinoption
    return this.post('/checkin/getcorpcheckinoption', { offset, size });
  }

  /**
   * 获取打卡规则详情
   * @param {string} groupId 打卡组 ID
   */
  async getCheckInRuleDetail(userIds, dateTime = Math.floor(Date.now() / 1000)) {
    // v1.5.2 修复：v1.5.0 误判废弃，实际端点 /checkin/getcheckinoption
    // 文档参数: useridlist[], datetime
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('userIds must be a non-empty array');
    }
    return this.post('/checkin/getcheckinoption', {
      useridlist: userIds,
      datetime: dateTime,  // 文档字段名是 datetime（低写 d）
    });
  }

  /**
   * 创建打卡规则
   * @param {object} rule 打卡规则配置
   */
  async createCheckInRule(rule) {
    return this.post('/checkin/add_checkin_option', rule);
  }

  /**
   * 更新打卡规则
   * @param {string} groupId 打卡组 ID
   * @param {object} rule 打卡规则配置
   */
  async updateCheckInRule(groupId, rule) {
    return this.post('/checkin/update_checkin_option', {
      group_id: groupId,
      ...rule
    });
  }

  /**
   * 删除打卡规则
   * @param {string} groupId 打卡组 ID
   */
  async deleteCheckInRule(groupId) {
    return this.post('/checkin/del_checkin_option', { group_id: groupId });
  }

  /**
   * 拷贝打卡规则
   * @param {string} sourceGroupId 源打卡组 ID
   * @param {string} newGroupName 新打卡组名称
   */
  async copyCheckInRule(sourceGroupId, newGroupName) {
    throw new Error('/checkin/copy_rule 已废弃：文档无此端点（v1.5.0）');
  }

  // ========== 打卡人员管理 ==========

  /**
   * 获取打卡规则成员
   * @param {string} groupId 打卡组 ID
   */
  async getCheckInRuleUsers(groupId) {
    throw new Error('/checkin/get_rule_user 已废弃：文档无此端点（v1.5.0）');
  }

  /**
   * 添加入打卡规则成员
   * @param {string} groupId 打卡组 ID
   * @param {string[]} userIds 成员 ID 列表
   * @param {number[]} departmentIds 部门 ID 列表
   */
  async addCheckInRuleUsers(groupId, userIds = [], departmentIds = []) {
    throw new Error('/checkin/add_rule_user 已废弃：文档无此端点（v1.5.0）');
  }

  /**
   * 删除打卡规则成员
   * @param {string} groupId 打卡组 ID
   * @param {string[]} userIds 成员 ID 列表
   * @param {number[]} departmentIds 部门 ID 列表
   */
  async removeCheckInRuleUsers(groupId, userIds = [], departmentIds = []) {
    throw new Error('/checkin/del_rule_user 已废弃：文档无此端点（v1.5.0）');
  }

  // ========== 打卡地点管理 ==========

  /**
   * 获取打卡地点列表
   * @param {string} groupId 打卡组 ID
   */
  async getCheckInLocations(groupId) {
    throw new Error('/checkin/get_location_list 已废弃：文档无此端点（v1.5.0）');
  }

  /**
   * 添加打卡地点
   * @param {string} groupId 打卡组 ID
   * @param {object} location 地点配置
   */
  async addCheckInLocation(groupId, location) {
    throw new Error('/checkin/add_location 已废弃：文档无此端点（v1.5.0）');
  }

  /**
   * 删除打卡地点
   * @param {string} groupId 打卡组 ID
   * @param {string} locationId 地点 ID
   */
  async deleteCheckInLocation(groupId, locationId) {
    throw new Error('/checkin/del_location 已废弃：文档无此端点（v1.5.0）');
  }

  // ========== 设备打卡数据 ==========

  /**
   * 获取设备打卡数据
   * @param {string} deviceId 设备 ID
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   */
  async getDeviceCheckInData(deviceId, startTime, endTime) {
    throw new Error('/checkin/get_device_data 已废弃：文档无此端点（v1.5.0）');
  }

  /**
   * 获取设备列表
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getDeviceList(offset = 0, size = 100) {
    throw new Error('/checkin/get_device_list 已废弃：文档无此端点（v1.5.0）');
  }

  // ========== 打卡提醒设置 ==========

  /**
   * 设置打卡提醒
   * @param {string} groupId 打卡组 ID
   * @param {number} remindTime 提醒时间（秒）
   * @param {string} remindLocation 提醒地点
   */
  async setCheckInReminder(groupId, remindTime, remidLocation = '') {
    throw new Error('/checkin/set_remind 已废弃：文档无此端点（v1.5.0）');
  }

  // ========== 排班管理 ==========

  /**
   * 获取打卡人员排班信息
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string} userId 成员 ID（可选）
   * @param {number} departmentId 部门 ID（可选）
   */
  async getCheckInSchedule(startTime, endTime, userId = '', departmentId = '') {
    return this.post('/checkin/getcheckinschedulist', {
      starttime: startTime,
      endtime: endTime,
      userid: userId,
      department_id: departmentId
    });
  }

  /**
   * 为打卡人员排班
   * @param {string} userId 成员 ID
   * @param {number} scheduleDate 排班日期时间戳
   * @param {string} dayType 日期类型: workdays-工作日, holidays-节假日
   * @param {string} timeSection 时段配置
   */
  async setCheckInSchedule(userId, scheduleDate, dayType = 'workdays', timeSection = '') {
    return this.post('/checkin/setcheckinschedulist', {
      userid: userId,
      schedule_date: scheduleDate,
      day_type: dayType,
      time_section: timeSection
    });
  }

  /**
   * 清除打卡人员排班
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string[]} userIds 成员 ID 列表
   */
  async clearCheckInSchedule(startTime, endTime, userIds) {
    throw new Error('/checkin/del_schedulelist 已废弃：文档无此端点（v1.5.0）');
  }

  // ========== 补卡管理 ==========

  /**
   * 为打卡人员补卡
   * @param {string} userId 成员 ID
   * @param {number} time 补卡时间戳
   * @param {string} notes 备注
   */
  async addCheckInRecord(userId, time, notes = '') {
    return this.post('/checkin/add_checkin_record', {
      userid: userId,
      time,
      notes
    });
  }
}

module.exports = CheckInRules;
