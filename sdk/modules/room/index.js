/**
 * 会议室模块
 * API 章节：二十五 - 会议室
 * 包含：会议室管理、会议室预定管理
 * 注意：与会议模块(meeting)的Rooms不同，这里是独立的会议室系统
 */

const WeComSDK = require('../../sdk');

class Room extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 会议室管理 ==========

  /**
   * 获取会议室列表
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getMeetingRoomList(offset = 0, size = 100) {
    return this.post('/meetingroom/list', { offset, limit: size });
  }

  /**
   * 获取会议室详情
   * @param {string} meetingRoomId 会议室 ID
   */
  async getMeetingRoomDetail(meetingRoomId) {
    return this.post('/meetingroom/get', { meetingroom_id: meetingRoomId });
  }

  /**
   * 添加会议室
   * @param {object} room 会议室信息
   */
  async addMeetingRoom(room) {
    return this.post('/meetingroom/add', room);
  }

  /**
   * 修改会议室
   * @param {string} meetingRoomId 会议室 ID
   * @param {object} room 会议室信息
   */
  async updateMeetingRoom(meetingRoomId, room) {
    return this.post('/meetingroom/edit', {
      meetingroom_id: meetingRoomId,
      ...room
    });
  }

  /**
   * 删除会议室
   * @param {string} meetingRoomId 会议室 ID
   */
  async deleteMeetingRoom(meetingRoomId) {
    return this.post('/meetingroom/del', { meetingroom_id: meetingRoomId });
  }

  // ========== 会议室预定管理 ==========

  /**
   * 预定会议室
   * @param {string} meetingRoomId 会议室 ID
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string} userId 预定人 ID
   * @param {string} subject 会议主题
   */
  async bookMeetingRoom(meetingRoomId, startTime, endTime, userId, subject = '') {
    return this.post('/meetingroom/book', {
      meetingroom_id: meetingRoomId,
      start_time: startTime,
      end_time: endTime,
      userid: userId,
      subject
    });
  }

  /**
   * 取消预定会议室
   * @param {string} meetingRoomId 会议室 ID
   * @param {string} bookingId 预定记录 ID
   */
  async cancelMeetingRoomBooking(meetingRoomId, bookingId) {
    return this.post('/meetingroom/cancel_book', {
      meetingroom_id: meetingRoomId,
      booking_id: bookingId
    });
  }

  /**
   * 获取会议室预定情况
   * @param {string} meetingRoomId 会议室 ID
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   */
  async getMeetingRoomBookings(meetingRoomId, startTime, endTime) {
    return this.post('/meetingroom/get_booking_info', {
      meetingroom_id: meetingRoomId,
      start_time: startTime,
      end_time: endTime
    });
  }

  /**
   * 获取用户预定列表
   * @param {string} userId 用户 ID
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getUserBookings(userId, offset = 0, size = 100) {
    return this.post('/meetingroom/user_booking_list', {
      userid: userId,
      offset,
      limit: size
    });
  }

  /**
   * 获取会议室可用时间
   * @param {string} meetingRoomId 会议室 ID
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   */
  async getMeetingRoomAvailableTime(meetingRoomId, startTime, endTime) {
    return this.post('/meetingroom/get_available_time', {
      meetingroom_id: meetingRoomId,
      start_time: startTime,
      end_time: endTime
    });
  }

  /**
   * 设置会议室管理员
   * @param {string} meetingRoomId 会议室 ID
   * @param {string[]} userIds 管理员 userid 列表
   */
  async setMeetingRoomAdmins(meetingRoomId, userIds) {
    return this.post('/meetingroom/set_admins', {
      meetingroom_id: meetingRoomId,
      userids: userIds
    });
  }

  // ========== 会议室分组管理 ==========

  /**
   * 获取会议室分组列表
   */
  async getMeetingRoomGroupList() {
    return this.post('/meetingroom/group_list', {});
  }

  /**
   * 创建会议室分组
   * @param {string} groupName 分组名称
   * @param {string[]} roomIds 会议室 ID 列表
   */
  async createMeetingRoomGroup(groupName, roomIds) {
    return this.post('/meetingroom/group_add', {
      group_name: groupName,
      meetingroom_ids: roomIds
    });
  }

  /**
   * 删除会议室分组
   * @param {string} groupId 分组 ID
   */
  async deleteMeetingRoomGroup(groupId) {
    return this.post('/meetingroom/group_del', { group_id: groupId });
  }
}

module.exports = Room;
