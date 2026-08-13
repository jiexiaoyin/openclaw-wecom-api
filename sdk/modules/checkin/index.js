/**
 * 打卡考勤模块
 * API 章节：二十一
 */

const WeComSDK = require('../../sdk');

class CheckIn extends WeComSDK {
  constructor(config) {
    super(config);
  }

  /**
   * 获取企业所有打卡规则
   * v1.0.1 修复：原 /checkin/getcorpcheckintypes 404，正确 /checkin/getcorpcheckinoption
   */
  async getCorpRules() {
    return this.post('/checkin/getcorpcheckinoption', {});
  }

  /**
   * 获取员工打卡规则
   * v1.3.0 修复：原 /checkin/getcheckinrule 404，正确 /checkin/getcheckinoption
   * @param {string} userId 成员 userid
   * @param {number} dateTime 查询日期时间戳
   */
  async getUserRules(userIds, dateTime) {
    // v1.5.2 修复 payload：userid → useridlist[]（文档示例明确要求数组）
    return this.post('/checkin/getcheckinoption', {
      datetime: dateTime,
      useridlist: Array.isArray(userIds) ? userIds : [userIds]
    });
  }

  /**
   * 获取打卡记录数据
   * @param {number} startTime 开始时间戳（跨距不超过 30 天）
   * @param {number} endTime 结束时间戳
   * @param {string[]} userIds 成员 userid 列表
   * @param {number} [opencheckindatatype=3] 打卡类型：1=上下班打卡 / 2=外出打卡 / 3=全部
   */
  async getRecords(startTime, endTime, userIds, opencheckindatatype = 3) {
    // v1.5.2 修复 payload：userid → useridlist[]；type → opencheckindatatype（文档明确区分）
    return this.post('/checkin/getcheckindata', {
      starttime: startTime,
      endtime: endTime,
      useridlist: userIds,
      opencheckindatatype
    });
  }

  /**
   * 获取打卡日报数据
   * v1.3.0 修复路径 → v1.5.0 修复 /checkin/getcheckin_daydata
   * v1.5.2 修复 payload：userid → useridlist[]（去除多余 type 字段，文档无此参数）
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string[]} userIds 成员 userid 列表（1-100 个）
   */
  async getDailyReport(startTime, endTime, userIds) {
    return this.post('/checkin/getcheckin_daydata', {
      starttime: startTime,
      endtime: endTime,
      useridlist: userIds
    });
  }

  /**
   * 获取打卡月报数据
   * v1.5.0 修复路径 /checkin/getcheckin_monthdata
   * v1.5.2 修复 payload：userid → useridlist[]
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string[]} userIds 成员 userid 列表
   */
  async getMonthlyReport(startTime, endTime, userIds) {
    return this.post('/checkin/getcheckin_monthdata', {
      starttime: startTime,
      endtime: endTime,
      useridlist: userIds
    });
  }

  /**
   * 获取打卡人员排班信息
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string[]} userIds 成员 userid 列表
   */
  async getSchedule(startTime, endTime, userIds) {
    // v1.5.2 修复 payload：userid → useridlist[]（getcheckinschedulist 文档要求）
    return this.post('/checkin/getcheckinschedulist', {
      starttime: startTime,
      endtime: endTime,
      useridlist: userIds
    });
  }

  /**
   * 为打卡人员排班
   * v1.3.0 修复：原 /checkin/addcheckinschedulist 404，正确 /checkin/setcheckinschedulist
   * @param {string} userId 成员 userid
   * @param {number} scheduleTime 排班日期时间戳
   * @param {object} schedule 班次信息
   */
  async addSchedule(userId, scheduleTime, schedule) {
    return this.post('/checkin/setcheckinschedulist', {
      userid: userId,
      schedule_time: scheduleTime,
      schedule
    });
  }

  /**
   * 为打卡人员补卡
   * v1.3.0 修复：原 /checkin/addcheckinrecord 404，正确 /checkin/punch
   *          （注：文档中 '添加打卡记录' 用 /checkin/add 但语义模糊，
   *            '补卡' 明确走 /checkin/punch；保留 addCheckinRecord 别名调用 punch）
   * @param {string} userId 成员 userid
   * @param {number} checkinTime 补卡时间戳
   * @param {string} notes 备注
   */
  async addCheckinRecord(userId, checkinTime, remark = '') {
    // v1.5.2 修复 payload：notes → remark（文档明确为 remark 字段）
    return this.post('/checkin/punch_correction', {
      userid: userId,
      checkin_time: checkinTime,
      remark
    });
  }

  /**
   * 获取设备打卡数据
   * ⚠️ v1.3.0 暂禁：官方文档无 /checkin/get_device_checkin_data 端点
   * 设备打卡数据请走硬件 API：/cgi-bin/hardware/get
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string} deviceId 设备ID
   */
  async getDeviceData(startTime, endTime, deviceId) {
    throw new Error('getDeviceData 已废弃：官方文档无此端点（v1.3.0），请走 hardware 模块');
    // return this.post('/checkin/get_device_checkin_data', {
    //   starttime: startTime,
    //   endtime: endTime,
    //   device_id: deviceId
    // });
  }

  /**
   * 录入打卡人员人脸信息
   * v1.3.0 修复：原 /checkin/add_face 404，正确 /checkin/addcheckinuserface
   * @param {string} userId 成员 userid
   * @param {string} faceData 人脸数据 (base64)
   */
  async addFace(userId, faceData) {
    return this.post('/checkin/addcheckinuserface', {
      userid: userId,
      face_data: faceData
    });
  }
}

module.exports = CheckIn;
