/**
 * 会议管理模块
 * API 章节：十七 - 会议
 * 包含：预约会议、会议统计、会中控制、网络研讨会、会议室等
 */

const WeComSDK = require('../../sdk');

class Meeting extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 预约会议基础管理 ==========

  /**
   * 创建预约会议
   * @param {object} params 会议参数
   */
  async createMeeting(params) {
    const { topic, startTime, endTime, organizers, guests, meetingType, password, settings } = params;
    return this.post('/meeting/create', {
      topic,
      meeting_start_time: Math.floor(new Date(startTime).getTime() / 1000),
      meeting_end_time: Math.floor(new Date(endTime).getTime() / 1000),
      organizers,
      guests,
      meeting_type: meetingType || 1,
      password,
      settings: settings || {}
    });
  }

  /**
   * 修改预约会议
   * @param {string} meetingId 会议 id
   * @param {object} params 更新参数
   */
  async updateMeeting(meetingId, { topic, startTime, endTime, guests, password, settings }) {
    return this.post('/meeting/update', {
      meeting_id: meetingId,
      topic,
      meeting_start_time: startTime ? Math.floor(new Date(startTime).getTime() / 1000) : undefined,
      meeting_end_time: endTime ? Math.floor(new Date(endTime).getTime() / 1000) : undefined,
      guests,
      password,
      settings
    });
  }

  /**
   * 取消预约会议
   * @param {string} meetingId 会议 id
   */
  async cancelMeeting(meetingId) {
    return this.post('/meeting/cancel', { meeting_id: meetingId });
  }

  /**
   * v1.5.2 coverage-enhance: 查询会议有效性 (会议是否真实存在)
   * 与 getMeetingDetail 区别: checkMeeting 只验证存在性, 返回更快
   * @param {string} meetingId 会议 ID
   * @returns {Promise<object>} { errcode, errmsg, meeting_exist }
   */
  async checkMeeting(meetingId) {
    return this.post('/meeting/check', { meeting_id: meetingId });
  }

  /**
   * v1.5.2 coverage-enhance: 会议报名审批
   * @param {string} meetingId 会议 ID
   * @param {string[]} enrollIds 报名 ID 列表
   * @param {number} action 1=通过, 2=拒绝
   */
  async approveMeetingEnroll(meetingId, enrollIds, action) {
    return this.post('/meeting/enroll/approve', {
      meetingid: meetingId,
      enroll_id_list: enrollIds,
      action
    });
  }

  /**
   * v1.5.2 coverage-enhance: 批量导入会议报名
   * @param {string} meetingId 会议 ID
   * @param {string[]} userIds userid 列表
   */
  async importMeetingEnroll(meetingId, userIds) {
    return this.post('/meeting/enroll/import', {
      meetingid: meetingId,
      userid_list: userIds
    });
  }

  /**
   * v1.5.2 coverage-enhance: PSTN 电话外呼
   * @param {object} params { meetingId, calleeUserId, calleeNumber }
   */
  async meetingPhoneCallout(params) {
    return this.post('/meeting/phone/callout', params);
  }

  /**
   * v1.5.2 coverage-enhance: 提交 VIP 报名
   * @param {string} meetingId 会议 ID
   * @param {object[]} vipList VIP 列表
   */
  async submitMeetingVip(meetingId, vipList) {
    return this.post('/meeting/vip/submit', {
      meetingid: meetingId,
      vip_list: vipList
    });
  }

  /**
   * v1.5.2 coverage-enhance: Webinar 报名审批
   * @param {string} webinarId Webinar ID
   * @param {string[]} enrollIds 报名 ID 列表
   * @param {number} action 1=通过, 2=拒绝
   */
  async approveWebinarEnroll(webinarId, enrollIds, action) {
    return this.post('/meeting/webinar/enroll/approve', {
      webinar_id: webinarId,
      enroll_id_list: enrollIds,
      action
    });
  }

  /**
   * 获取会议详情
   * @param {string} meetingId 会议 id
   */
  async getMeetingDetail(meetingId) {
    return this.post('/meeting/get_info', { meeting_id: meetingId });
  }

  /**
   * 获取成员会议 ID 列表
   * v1.3.1 修复：官方文档中该端点名为 /meeting/check
   *   - /meeting/get_user_meetingid 已废弃
   *   - 字段由 begin_time/end_time 调整为 meeting_start_time/meeting_end_time
   * @param {string} userId 成员 userid
   * @param {string} meetingId 会议 ID
   */
  async getUserMeetingIds(userId, beginTime, endTime, cursor = '', limit = 100) {
    // v1.5.2 修复：v1.3.1 把 /meeting/get_user_meetingid 说成"已废弃"改 /meeting/check 是错的！
    // 实测 /meeting/check 返 404，/meeting/get_user_meetingid 返 200 errcode=0
    // 路径回归 + 重写签名 (userId, beginTime, endTime, cursor, limit)
    return this.post('/meeting/get_user_meetingid', {
      userid: userId,
      begin_time: beginTime,
      end_time: endTime,
      cursor,
      limit,
    });
  }

  // ========== 会议统计管理 ==========

  /**
   * 获取会议发起记录
   * v1.3.1 修复：官方文档中该端点名为 /meeting/statistics/get
   *   - /meeting/get_meeting_record 已废弃
   *   - 文档字段：start_time/end_time/cursor/limit（size→limit）
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {number} cursor 分页游标
   * @param {number} limit 每页数量
   */
  async getMeetingRecord(startTime, endTime, cursor = 0, limit = 100) {
    return this.post('/meeting/statistics/get_start_list', {
      start_time: startTime,
      end_time: endTime,
      cursor,
      limit
    });
  }

  // ========== 预约会议高级管理 ==========

  /**
   * 创建预约会议（高级）
   * @param {object} params 会议参数
   */
  async createMeetingAdvanced(params) {
    const {
      topic, startTime, endTime, meetingType, password,
      hosts, organizers, recurrenceType, recurrenceUntil,
      attendees, allowIn, allowOut, mute, settings
    } = params;

    const meetingInfo = {
      topic,
      meeting_start_time: Math.floor(new Date(startTime).getTime() / 1000),
      meeting_end_time: Math.floor(new Date(endTime).getTime() / 1000),
      meeting_type: meetingType || 1,
      password,
      hosts,
      organizers
    };

    if (recurrenceType) {
      meetingInfo.recurrence_type = recurrenceType;
      meetingInfo.recurrence_until = recurrenceUntil;
    }

    if (attendees) meetingInfo.attendees = attendees;

    meetingInfo.settings = settings || {
      allow_in: allowIn !== undefined ? allowIn : true,
      allow_out: allowOut !== undefined ? allowOut : true,
      mute: mute !== undefined ? mute : 1
    };

    return this.post('/meeting/create', meetingInfo);
  }

  /**
   * 获取会议受邀成员列表
   * v1.3.1 修复：官方文档中该端点名为 /meeting/set（语义：更新会议受邀成员列表，含 get 能力）
   * @param {string} meetingId 会议 id
   */
  async getMeetingAttendees(meetingId) {
    return this.post('/meeting/set', {
      meeting_id: meetingId,
      operator: 'get_attendees'
    });
  }

  /**
   * 更新会议受邀成员列表
   * v1.5.0 修复：原 /meeting/update_attendees 错，正确 /meeting/set_invitees
   * @param {string} meetingId 会议 id
   * @param {object} params 参数
   */
  async updateMeetingAttendees(meetingId, { attendees, updateScope }) {
    return this.post('/meeting/set_invitees', {
      meeting_id: meetingId,
      attendees,
      update_scope: updateScope
    });
  }

  /**
   * 获取用户专属参会链接
   * ⚠️ v1.3.1 暂禁：官方文档无 /meeting/get_user_meeting_link 端点
   * 调用方请改走 getUserMeetingIds(userId, meetingId)（v1.3.1 走 /meeting/check）
   */
  async getUserMeetingJoinLink(meetingId, userId) {
    throw new Error('getUserMeetingJoinLink 已废弃：官方文档无此端点（v1.3.1），请用 getUserMeetingIds');
    // return this.post('/meeting/get_user_meeting_link', {
    //   meeting_id: meetingId,
    //   userid: userId
    // });
  }

  /**
   * 获取实时会中成员列表
   * ⚠️ v1.3.1 暂禁：官方文档无 /meeting/get_meeting_members 端点
   * 调用方请走 /meeting/check（v1.3.1）或 /meeting/get（含 attendees 字段）
   */
  async getMeetingMembers(meetingId) {
    throw new Error('getMeetingMembers 已废弃：官方文档无此端点（v1.3.1），请走 /meeting/check 或 /meeting/get');
    // return this.post('/meeting/get_meeting_members', { meeting_id: meetingId });
  }

  // ========== 会中控制管理 ==========

  /**
   * 管理会中设置
   * @param {string} meetingId 会议 id
   * @param {object} settings 设置参数
   */
  async updateMeetingSettings(meetingId, settings) {
    // v1.5.0 修复：原 /meeting/update_meeting 错，正确 /meeting/update
    return this.post('/meeting/update', {
      meeting_id: meetingId,
      settings
    });
  }

  /**
   * 管理联席主持人
   * ⚠️ v1.3.1 暂禁：官方文档无 /meeting/set_co_host 端点
   * 若需设置联席主持人，请走 /meeting/realcontrol/manage
   */
  async manageCoHost(meetingId, userIds, type = 1) {
    throw new Error('manageCoHost 已废弃：官方文档无此端点（v1.3.1），请走 /meeting/realcontrol/manage');
    // return this.post('/meeting/set_co_host', {
    //   meeting_id: meetingId,
    //   userid: userIds,
    //   type
    // });
  }

  /**
   * 静音成员
   * v1.3.1 修复：官方端点名为 /meeting/realcontrol/mute
   * @param {string} meetingId 会议 id
   * @param {string[]} userIds 成员 userid 列表
   * @param {boolean} muteAll 是否全员静音
   */
  async muteMember(meetingId, userIds, muteAll = false) {
    return this.post('/meeting/realcontrol/mute_user', {
      meeting_id: meetingId,
      userid: userIds,
      mute_all: muteAll
    });
  }

  /**
   * 关闭或开启成员视频
   * v1.3.1 修复：官方端点名为 /meeting/realcontrol/switch（操作视频开关）
   * @param {string} meetingId 会议 id
   * @param {string} userId 成员 userid
   * @param {boolean} muteVideo 是否关闭视频
   */
  async updateMemberVideo(meetingId, userId, muteVideo = true) {
    return this.post('/meeting/realcontrol/switch_user_video', {
      meeting_id: meetingId,
      userid: userId,
      mute_video: muteVideo
    });
  }

  /**
   * 关闭成员屏幕共享
   * v1.3.1 修复：官方端点名为 /meeting/realcontrol/close
   * @param {string} meetingId 会议 id
   * @param {string} userId 成员 userid
   */
  async stopMemberScreenShare(meetingId, userId) {
    return this.post('/meeting/realcontrol/close_screen_share', {
      meeting_id: meetingId,
      userid: userId
    });
  }

  /**
   * 管理等候室成员
   * v1.3.1 修复：官方端点名为 /meeting/realcontrol/manage
   * @param {string} meetingId 会议 id
   * @param {string} userId 成员 userid
   * @param {number} type 1-进入等候室 2-移出等候室 3-进入会议
   */
  async manageWaitingRoom(meetingId, userId, type) {
    return this.post('/meeting/realcontrol/manage_waiting_room_users', {
      meeting_id: meetingId,
      userid: userId,
      type
    });
  }

  /**
   * 移出成员
   * v1.3.1 修复：官方端点名为 /meeting/realcontrol/kickout
   * @param {string} meetingId 会议 id
   * @param {string[]} userIds 成员 userid 列表
   */
  async kickMember(meetingId, userIds) {
    return this.post('/meeting/realcontrol/kickout_users', {
      meeting_id: meetingId,
      userid: userIds
    });
  }

  /**
   * 结束会议
   * v1.3.1 修复：官方端点名为 /meeting/realcontrol/dismiss
   * @param {string} meetingId 会议 id
   */
  async endMeeting(meetingId) {
    return this.post('/meeting/realcontrol/dismiss', { meeting_id: meetingId });
  }

  // ========== 网络研讨会管理 ==========

  /**
   * 创建网络研讨会
   * @param {object} params 研讨会参数
   */
  async createWebinar(params) {
    const { topic, startTime, endTime, password, hosts, guests, settings } = params;
    return this.post('/meeting/webinar/create', {
      topic,
      meeting_start_time: Math.floor(new Date(startTime).getTime() / 1000),
      meeting_end_time: Math.floor(new Date(endTime).getTime() / 1000),
      password,
      hosts,
      guests,
      settings: settings || {}
    });
  }

  /**
   * 修改网络研讨会
   * @param {string} webinarId 研讨会 id
   * @param {object} params 更新参数
   */
  async updateWebinar(webinarId, params) {
    return this.post('/meeting/webinar/update', {
      webinar_id: webinarId,
      ...params
    });
  }

  /**
   * 取消网络研讨会
   * @param {string} webinarId 研讨会 id
   */
  async cancelWebinar(webinarId) {
    return this.post('/meeting/webinar/cancel', { webinar_id: webinarId });
  }

  /**
   * 获取网络研讨会详情
   * @param {string} webinarId 研讨会 id
   */
  async getWebinarDetail(webinarId) {
    return this.post('/meeting/webinar/get', { webinar_id: webinarId });
  }

  // ========== 会议室管理 (Rooms) ==========

  /**
   * 预定 Rooms 会议室
   * @param {string} roomId 会议室 id
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string} userId 预定人 userid
   */
  async bookRoom(roomId, startTime, endTime, userId) {
    return this.post('/meeting/rooms/book', {
      room_id: roomId,
      start_time: startTime,
      end_time: endTime,
      userid: userId
    });
  }

  /**
   * 释放 Rooms 会议室
   * @param {string} roomId 会议室 id
   * @param {string} meetingId 会议 id
   */
  async releaseRoom(roomId, meetingId) {
    return this.post('/meeting/rooms/release', {
      room_id: roomId,
      meeting_id: meetingId
    });
  }

  /**
   * 获取 Rooms 会议室列表
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getRoomsList(offset = 0, size = 100) {
    return this.post('/meeting/rooms/list', { offset, limit: size });
  }

  /**
   * 获取 Rooms 会议室详情
   * @param {string} roomId 会议室 id
   */
  async getRoomDetail(roomId) {
    return this.post('/meeting/rooms/get_info', { room_id: roomId });
  }

  /**
   * 呼叫 Rooms 会议室
   * @param {string} roomId 会议室 id
   * @param {string} userId 呼叫人 userid
   */
  async callRoom(roomId, userId) {
    return this.post('/meeting/rooms/call', {
      room_id: roomId,
      userid: userId
    });
  }

  /**
   * 取消呼叫 Rooms 会议室
   * @param {string} roomId 会议室 id
   */
  async cancelCallRoom(roomId) {
    return this.post('/meeting/rooms/cancel_call', { room_id: roomId });
  }

  // ========== 录制管理 ==========

  /**
   * 获取会议录制列表
   * v1.3.1 修复：官方端点名为 /meeting/record/list
   * @param {string} meetingId 会议 id
   */
  async getMeetingRecordings(meetingId) {
    return this.post('/meeting/record/list', { meeting_id: meetingId });
  }

  /**
   * 获取会议录制地址
   * v1.3.1 修复：官方端点名为 /meeting/record/get
   * @param {string} meetingId 会议 id
   */
  async getMeetingRecordingUrl(meetingId) {
    return this.post('/meeting/record/get_file', { meeting_id: meetingId });
  }

  /**
   * 删除会议录制
   * ✅ 已是正确端点 /meeting/record/delete
   * @param {string} meetingId 会议 id
   */
  async deleteMeetingRecording(meetingId) {
    return this.post('/meeting/record/delete', { meeting_id: meetingId });
  }

  /**
   * 修改会议录制共享设置
   * v1.3.1 修复：官方端点名为 /meeting/record/update
   * @param {string} meetingId 会议 id
   * @param {number} shareType 共享类型
   */
  async updateRecordingShare(meetingId, shareType) {
    return this.post('/meeting/record/update_sharing_config', {
      meeting_id: meetingId,
      share_type: shareType
    });
  }

  // ========== 会议投票管理 ==========
  // v1.3.1 全部 throw error：官方文档中投票端点名为 /meeting/poll/* 而非 /meeting/vote/*

  /**
   * 创建会议投票主题
   * ⚠️ v1.3.1 暂禁：官方端点名为 /meeting/poll/create
   */
  async createMeetingVote(meetingId, vote) {
    throw new Error('createMeetingVote 已废弃：官方端点名为 /meeting/poll/create（v1.3.1）');
    // return this.post('/meeting/poll/create', {
    //   meeting_id: meetingId,
    //   vote
    // });
  }

  /**
   * 修改会议投票主题
   * ⚠️ v1.3.1 暂禁：官方端点名为 /meeting/poll/update
   */
  async updateMeetingVote(meetingId, voteId, vote) {
    throw new Error('updateMeetingVote 已废弃：官方端点名为 /meeting/poll/update（v1.3.1）');
    // return this.post('/meeting/poll/update', {
    //   meeting_id: meetingId,
    //   vote_id: voteId,
    //   vote
    // });
  }

  /**
   * 获取会议投票列表
   * ⚠️ v1.3.1 暂禁：官方端点名为 /meeting/poll/get
   */
  async getMeetingVoteList(meetingId) {
    throw new Error('getMeetingVoteList 已废弃：官方端点名为 /meeting/poll/get（v1.3.1）');
    // return this.post('/meeting/poll/get', { meeting_id: meetingId });
  }

  /**
   * 获取会议投票详情
   * ⚠️ v1.3.1 暂禁：官方端点名为 /meeting/poll/get + vote_id
   */
  async getMeetingVoteDetail(meetingId, voteId) {
    throw new Error('getMeetingVoteDetail 已废弃：官方端点名为 /meeting/poll/get（v1.3.1）');
    // return this.post('/meeting/poll/get', {
    //   meeting_id: meetingId,
    //   vote_id: voteId
    // });
  }

  /**
   * 删除会议投票
   * ⚠️ v1.3.1 暂禁：官方端点名为 /meeting/poll/delete
   */
  async deleteMeetingVote(meetingId, voteId) {
    throw new Error('deleteMeetingVote 已废弃：官方端点名为 /meeting/poll/delete（v1.3.1）');
    // return this.post('/meeting/poll/delete', {
    //   meeting_id: meetingId,
    //   vote_id: voteId
    // });
  }

  /**
   * 发起会议投票
   * ⚠️ v1.3.1 暂禁：官方端点名为 /meeting/poll/start
   */
  async startMeetingVote(meetingId, voteId) {
    throw new Error('startMeetingVote 已废弃：官方端点名为 /meeting/poll/start（v1.3.1）');
    // return this.post('/meeting/poll/start', {
    //   meeting_id: meetingId,
    //   vote_id: voteId
    // });
  }

  /**
   * 结束会议投票
   * ⚠️ v1.3.1 暂禁：官方端点名为 /meeting/poll/finish
   */
  async endMeetingVote(meetingId, voteId) {
    throw new Error('endMeetingVote 已废弃：官方端点名为 /meeting/poll/finish（v1.3.1）');
    // return this.post('/meeting/poll/finish', {
    //   meeting_id: meetingId,
    //   vote_id: voteId
    // });
  }

  // ========== 会议布局和背景管理 ==========

  /**
   * 获取布局模板列表
   */
  async getLayoutTemplateList() {
    return this.post('/meeting/layout/list_background', {});
  }

  /**
   * 添加会议基础布局
   * @param {object} layout 布局配置
   */
  async addBasicLayout(layout) {
    return this.post('/meeting/layout/add', layout);
  }

  /**
   * 添加会议高级布局
   * @param {object} layout 布局配置
   */
  async addAdvancedLayout(layout) {
    // v1.3.1 修复：官方端点名为 /meeting/advanced
    return this.post('/meeting/advanced', layout);
  }

  /**
   * 修改会议基础布局
   * @param {string} layoutId 布局 ID
   * @param {object} layout 布局配置
   */
  async updateBasicLayout(layoutId, layout) {
    return this.post('/meeting/layout/update', {
      layout_id: layoutId,
      ...layout
    });
  }

  /**
   * 设置会议默认布局
   * @param {string} meetingId 会议 ID
   * @param {string} layoutId 布局 ID
   */
  async setDefaultLayout(meetingId, layoutId) {
    // v1.3.1 修复：官方端点名为 /meeting/layout/set
    return this.post('/meeting/layout/set_default', {
      meeting_id: meetingId,
      layout_id: layoutId
    });
  }

  /**
   * 获取会议布局列表
   * @param {string} meetingId 会议 ID
   */
  async getMeetingLayoutList(meetingId) {
    // v1.3.1 修复：官方端点名为 /meeting/layout/list
    return this.post('/meeting/layout/list_background', { meeting_id: meetingId });
  }

  /**
   * 获取用户布局
   * ⚠️ v1.3.1 暂禁：官方文档无 /meeting/layout/get_user_layout 端点
   * 调用方请改走 /meeting/layout/list
   */
  async getUserLayout(userId) {
    throw new Error('getUserLayout 已废弃：官方文档无此端点（v1.3.1），请改走 /meeting/layout/list');
    // return this.post('/meeting/layout/get_user_layout', { userid: userId });
  }

  /**
   * 批量删除布局
   * v1.3.1 修复：官方端点名为 /meeting/layout/batch
   */
  async batchDeleteLayout(layoutIds) {
    return this.post('/meeting/layout/batch_delete_background', { layout_ids: layoutIds });
  }

  /**
   * 添加会议背景
   * @param {string} filePath 背景文件路径
   * @param {string} type 背景类型: default, custom
   */
  async addMeetingBackground(filePath, type = 'custom') {
    return this.uploadFile(filePath, 'media', { type });
  }

  /**
   * 获取会议背景列表
   */
  async getMeetingBackgroundList() {
    // v1.3.1 修复：官方已重命名为 /meeting/layout/list
    throw new Error('getMeetingBackgroundList 已废弃：官方重命名为 /meeting/layout/list（v1.3.1）');
    // return this.post('/meeting/layout/list_background', {});
  }

  /**
   * 设置会议默认背景
   * @param {string} backgroundId 背景 ID
   */
  async setDefaultBackground(backgroundId) {
    // v1.3.1 修复：官方端点名为 /meeting/layout/set
    return this.post('/meeting/layout/set_default', { background_id: backgroundId });
  }

  /**
   * 删除会议背景
   * v1.3.1 修复：官方端点名为 /meeting/layout/delete
   */
  async deleteMeetingBackground(backgroundId) {
    return this.post('/meeting/layout/delete_background', { background_id: backgroundId });
  }

  // ========== MRA会议室连接器管理 ==========

  /**
   * 获取 MRA 状态信息
   * @param {string} deviceId 设备 ID
   */
  async getMraStatus(deviceId) {
    // v1.3.1 修复：官方端点名为 /meeting/mra/query
    return this.post('/meeting/mra/query_status', { device_id: deviceId });
  }

  /**
   * 切换 MRA 默认布局
   * @param {string} deviceId 设备 ID
   * @param {string} layoutId 布局 ID
   */
  async switchMraLayout(deviceId, layoutId) {
    // v1.3.1 修复：官方端点名为 /meeting/mra/set
    return this.post('/meeting/mra/set_default_layout', {
      device_id: deviceId,
      layout_id: layoutId
    });
  }

  /**
   * 设置 MRA 举手或手放下
   * @param {string} deviceId 设备 ID
   * @param {number} handStatus 举手状态: 0-放下 1-举手
   */
  async setMraHand(deviceId, handStatus) {
    // v1.3.1 暂禁：官方文档无 /meeting/mra/hand 端点
    // 举手操作走 /meeting/realcontrol/set
    throw new Error('setMraHand 已废弃：官方无 /meeting/mra/hand 端点（v1.3.1）');
    // return this.post('/meeting/realcontrol/set', {
    //   device_id: deviceId,
    //   hand_status: handStatus
    // });
  }

  /**
   * 挂断 MRA 呼叫
   * @param {string} deviceId 设备 ID
   */
  async hangupMra(deviceId) {
    return this.post('/meeting/mra/hangup', { device_id: deviceId });
  }
}

module.exports = Meeting;
