/**
 * 直播管理模块
 * API 章节：十九
 */

const WeComSDK = require('../../sdk');

class Live extends WeComSDK {
  constructor(config) {
    super(config);
  }

  /**
   * 创建预约直播
   * @param {object} params 直播参数
   */
  async createLive(params) {
    const {
      title,           // 直播标题
      startTime,       // 开始时间戳
      endTime,         // 结束时间戳
      description,    // 直播简介
      coverMediaId,   // 封面 media_id
      type,           // 直播类型: 0-通用直播
      remindTime,      // 提醒时间 (秒)
      agenda,         // 直播日程
      groupId,        // 群直播ID
      broadcasterName, // 主播名称
      broadcasterUserId // 主播 userid
    } = params;

    return this.post('/live/create', {
      title,
      start_time: startTime,
      end_time: endTime,
      description,
      cover_media_id: coverMediaId,
      type,
      remind_time: remindTime,
      agenda,
      groupid: groupId,
      broadcaster_name: broadcasterName,
      broadcaster_userid: broadcasterUserId
    });
  }

  /**
   * 修改预约直播
   * @param {string} livingId 直播ID
   * @param {object} params 更新参数
   */
  async updateLive(livingId, params) {
    return this.post('/live/modify', {
      living_id: livingId,
      ...params
    });
  }

  /**
   * 取消预约直播
   * @param {string} livingId 直播ID
   */
  async cancelLive(livingId) {
    return this.post('/live/delete', { living_id: livingId });
  }

  /**
   * 获取成员直播 ID 列表
   * @param {string} userId 成员 userid
   * @param {number} limit 返回数量
   */
  async getUserLiveIds(userId, limit = 100) {
    return this.post('/live/get_user_living_id_list', {
      userid: userId,
      limit
    });
  }

  /**
   * 获取直播详情
   * @param {string} livingId 直播ID
   */
  async getLiveDetail(livingId) {
    return this.post('/live/get_living_info', { living_id: livingId });
  }

  /**
   * 获取直播观看明细
   * @param {string} livingId 直播ID
   * @param {number} offset 分页偏移
   * @param {number} limit 每页数量
   */
  async getWatchers(livingId, offset = 0, limit = 100) {
    return this.post('/live/get_watch_stat', {
      living_id: livingId,
      offset,
      limit
    });
  }

  /**
   * 删除直播回放
   * @param {string} livingId 直播ID
   */
  async deleteReplay(livingId) {
    return this.post('/live/delete_replay', { living_id: livingId });
  }

  /**
   * 获取跳转小程序商城的直播观众信息
   * @param {string} livingId 直播ID
   * @param {string} userId 成员 userid
   */
  async getMallInfo(livingId, userId) {
    return this.post('/live/get_mall_info', {
      living_id: livingId,
      userid: userId
    });
  }
}

module.exports = Live;
