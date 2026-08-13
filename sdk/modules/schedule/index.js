/**
 * 日程管理模块
 * API 章节：十六 - 日程
 * 包含：管理日历、管理日程
 */

const WeComSDK = require('../../sdk');

class Schedule extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 管理日历 ==========

  /**
   * 创建日历
   * @param {object} params 日历参数
   * v1.0.1 修复：title → summary（openapi 是 summary 不是 title）
   */
  async createCalendar(params) {
    const { title, summary, color, description, shares, calendarIds } = params;
    return this.post('/oa/calendar/add', {
      calendar: {
        summary: summary || title,  // 兼容两种写法
        color,
        description,
        shares,
        calendar_ids: calendarIds
      }
    });
  }

  /**
   * 更新日历
   * @param {string} calendarId 日历 id
   * @param {object} params 更新参数
   * v1.0.1 修复：title → summary
   */
  async updateCalendar(calendarId, params) {
    const { title, summary, color, description, shares } = params || {};
    return this.post('/oa/calendar/update', {
      calendar: {
        calendar_id: calendarId,
        summary: summary || title,  // 兼容
        color,
        description,
        shares
      }
    });
  }

  /**
   * 获取日历详情
   * @param {string|string[]} calendarId 单个 id 或 id 数组
   * v1.0.1 修复：API 要 cal_id_list (array)，不是 calendar_id (single)
   */
  async getCalendar(calendarId) {
    const ids = Array.isArray(calendarId) ? calendarId : [calendarId];
    return this.post('/oa/calendar/get', { cal_id_list: ids });
  }

  /**
   * 删除日历
   * @param {string} calendarId 日历 id
   */
  async deleteCalendar(calendarId) {
    return this.post('/oa/calendar/del', { calendar_id: calendarId });
  }

  // ========== 管理日程 ==========

  /**
   * 创建日程
   * @param {object} params 日程参数
   */
  async createEvent(params) {
    const {
      organizer, title, startTime, endTime, attendees,
      description, location, reminders, meetingId, roomId
    } = params;

    const event = {
      organizer,
      title,
      start: {
        timestamp: Math.floor(new Date(startTime).getTime() / 1000),
        timezone: 'Asia/Shanghai'
      },
      end: {
        timestamp: Math.floor(new Date(endTime).getTime() / 1000),
        timezone: 'Asia/Shanghai'
      }
    };

    if (attendees) event.attendees = attendees;
    if (description) event.description = description;
    if (location) event.location = { name: location };
    if (reminders) event.reminders = reminders;
    if (meetingId) event.meeting_id = meetingId;
    if (roomId) event.room_id = roomId;

    return this.post('/oa/schedule/add', { schedule: event });
  }

  /**
   * 更新日程
   * @param {string} scheduleId 日程 id
   * @param {object} params 更新参数
   */
  async updateEvent(scheduleId, params) {
    const { title, startTime, endTime, attendees, description, location, reminders } = params;

    const event = {
      schedule_id: scheduleId
    };

    if (title) event.title = title;
    if (startTime) {
      event.start = {
        timestamp: Math.floor(new Date(startTime).getTime() / 1000),
        timezone: 'Asia/Shanghai'
      };
    }
    if (endTime) {
      event.end = {
        timestamp: Math.floor(new Date(endTime).getTime() / 1000),
        timezone: 'Asia/Shanghai'
      };
    }
    if (attendees) event.attendees = attendees;
    if (description) event.description = description;
    if (location) event.location = { name: location };
    if (reminders) event.reminders = reminders;

    return this.post('/oa/schedule/update', { schedule: event });
  }

  /**
   * 更新重复日程
   * @param {string} scheduleId 日程 id
   * @param {string} seriesId 重复系列 id
   * @param {object} params 更新参数
   */
  async updateRecurringEvent(scheduleId, seriesId, params) {
    const { title, startTime, endTime, attendees, description, location, reminders } = params;

    const event = {
      schedule_id: scheduleId,
      series_id: seriesId
    };

    if (title) event.title = title;
    if (startTime) {
      event.start = {
        timestamp: Math.floor(new Date(startTime).getTime() / 1000),
        timezone: 'Asia/Shanghai'
      };
    }
    if (endTime) {
      event.end = {
        timestamp: Math.floor(new Date(endTime).getTime() / 1000),
        timezone: 'Asia/Shanghai'
      };
    }
    if (attendees) event.attendees = attendees;
    if (description) event.description = description;
    if (location) event.location = { name: location };
    if (reminders) event.reminders = reminders;

    return this.post('/oa/schedule/update', { schedule: event });
  }

  /**
   * 删除日程
   * @param {string} scheduleId 日程 id
   */
  async deleteEvent(scheduleId) {
    return this.post('/oa/schedule/del', { schedule_id: scheduleId });
  }

  /**
   * 删除重复日程
   * @param {string} scheduleId 日程 id
   * @param {string} seriesId 重复系列 id
   * @param {number} type 删除类型: 1-单日 2-后续 3-全部
   */
  async deleteRecurringEvent(scheduleId, seriesId, type = 1) {
    return this.post('/oa/schedule/del', {
      schedule_id: scheduleId,
      series_id: seriesId,
      type
    });
  }

  /**
   * 新增日程参与者
   * @param {string} scheduleId 日程 id
   * @param {string[]} attendees 参与者 userid 列表
   */
  async addEventAttendees(scheduleId, attendees) {
    return this.post('/oa/schedule/add_attendees', {
      schedule_id: scheduleId,
      attendees
    });
  }

  /**
   * 删除日程参与者
   * @param {string} scheduleId 日程 id
   * @param {string[]} attendees 参与者 userid 列表
   */
  async removeEventAttendees(scheduleId, attendees) {
    return this.post('/oa/schedule/del_attendees', {
      schedule_id: scheduleId,
      attendees
    });
  }

  /**
   * 获取日历下的日程列表
   * @param {string} calendarId 日历 id
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   */
  async getCalendarEvents(calendarId, startTime, endTime) {
    return this.post('/oa/schedule/list', {
      calendar_id: calendarId,
      start_time: startTime,
      end_time: endTime
    });
  }

  /**
   * 获取日程详情
   * @param {string} scheduleId 日程 id
   */
  async getEventDetail(scheduleId) {
    return this.post('/oa/schedule/get', { schedule_id: scheduleId });
  }

  /**
   * 取消日程
   * @param {string} scheduleId 日程 id
   */
  async cancelEvent(scheduleId) {
    return this.deleteEvent(scheduleId);
  }
}

module.exports = Schedule;
