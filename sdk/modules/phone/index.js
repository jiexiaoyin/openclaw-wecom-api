/**
 * 公费电话模块
 * API 章节：二十 - 公费电话
 * 包含：拨打记录
 */

const WeComSDK = require('../../sdk');

class Phone extends WeComSDK {
  constructor(config) {
    super(config);
  }

  /**
   * 获取公费电话拨打记录
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string} userId 成员 ID（可选）
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getDialRecord(startTime, endTime, userId = '', offset = 0, size = 100) {
    return this.post('/Dial/get_dial_record', {
      start_time: startTime,
      end_time: endTime,
      userid: userId,
      offset,
      limit: size
    });
  }

  /**
   * 获取公费电话分钟数使用情况
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   */
  async getUsageStat(startTime, endTime) {
    return this.post('/Dial/get_usage_stat', {
      start_time: startTime,
      end_time: endTime
    });
  }
}

module.exports = Phone;
