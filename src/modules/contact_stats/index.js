/**
 * 客户统计模块
 * API 章节：十三 - 统计管理
 * 包含：联系客户统计、群聊数据统计
 * 
 * =====================================================
 * ⚠️ 企业微信官方强制规范 (2026-03-21)
 * =====================================================
 * 
 * 1. 【必须逐员工调用】
 *    联系客户统计接口不支持批量，必须按 userid 逐个请求
 * 
 * 2. 【必须先检查本地员工数据】
 *    无员工数据时，禁止直接调用 API
 * 
 * 3. 【无员工必须提示】
 *    提示语：请先同步企业微信员工数据
 * 
 * =====================================================
 */

const WeComSDK = require('../../sdk');
const fs = require('fs');
const path = require('path');

class ContactStats extends WeComSDK {
  constructor(config) {
    super(config);
    this._storagePath = path.join(process.cwd(), 'data', 'wecom-stats.json');
    this._todayStats = this._loadStats();
  }

  // ====================
  // 持久化存储
  // ====================
  
  _loadStats() {
    const today = new Date().toISOString().split('T')[0];
    try {
      if (fs.existsSync(this._storagePath)) {
        const data = JSON.parse(fs.readFileSync(this._storagePath, 'utf8'));
        if (data.date === today) {
          return data;
        }
      }
    } catch (e) {}
    return this._createEmptyStats(today);
  }

  _createEmptyStats(date) {
    return {
      date,
      newCustomers: 0,
      lostCustomers: 0,
      messagesSent: 0,
      chatsCount: 0,
      applications: 0
    };
  }

  _saveStats() {
    try {
      const dir = path.dirname(this._storagePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this._storagePath, JSON.stringify(this._todayStats, null, 2));
    } catch (e) {}
  }

  // ====================
  // 事件回调更新
  // ====================

  /**
   * 从事件回调更新当日统计数据
   * @param {string} eventType 事件类型
   * @param {object} eventData 事件数据
   */
  updateTodayStats(eventType, eventData) {
    const today = new Date().toISOString().split('T')[0];
    if (this._todayStats.date !== today) {
      this._todayStats = this._createEmptyStats(today);
      this._saveStats();
    }

    switch (eventType) {
      case 'add_external_contact':
        this._todayStats.newCustomers++;
        break;
      case 'del_external_contact':
        this._todayStats.lostCustomers++;
        break;
      case 'change_external_contact':
        if (eventData.state === 'unsubscribe') {
          this._todayStats.lostCustomers++;
        }
        break;
      case 'new_msg':
      case 'msgsend':
      case 'kf_msg':
      case 'kf_send_msg':
        this._todayStats.messagesSent++;
        break;
    }
    this._saveStats();
    return this._todayStats;
  }

  /**
   * 获取当日统计数据
   */
  getTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    if (this._todayStats.date !== today) {
      this._todayStats = this._createEmptyStats(today);
    }
    return { ...this._todayStats };
  }

  // ====================
  // 【核心】获取联系客户统计 - 企业微信官方规范
  // ====================

  /**
   * 获取单个员工的联系客户统计
   * 
   * ⚠️ 企业微信官方强制规范：
   * 1. 必须逐员工调用
   * 2. 必须先检查本地员工数据是否存在
   * 3. 无员工数据时必须提示先同步
   * 
   * @param {string} userId 成员ID
   * @param {string} startDate 开始日期（YYYYMMDD格式）
   * @param {string} endDate 结束日期（YYYYMMDD格式）
   * @param {object} addressBookCache 通讯录缓存（用于验证员工是否存在）
   * @returns {Promise<object>}
   */
  async getUserClientStat(userId, startDate, endDate, addressBookCache = null) {
    // 1. 先查本地是否有该员工信息
    if (addressBookCache) {
      const user = addressBookCache.getUser(userId);
      if (!user) {
        return {
          error: true,
          code: 'USER_NOT_FOUND',
          message: '请先同步企业微信员工数据',
          tip: '联系客户统计接口必须按员工调用，请先执行：同步组织架构'
        };
      }
    }

    // 2. 有员工 → 逐员工调用 API（注意：企业微信用 userid 而非 userid_list）
    return this.post('/externalcontact/get_user_behavior_data', {
      userid: [userId],
      start_time: startDate,
      end_time: endDate
    });
  }

  /**
   * 批量获取联系客户统计（逐员工调用）
   * 
   * ⚠️ 企业微信官方强制规范：必须逐员工调用
   * 
   * @param {string[]} userIds 成员ID列表
   * @param {string} startDate 开始日期（YYYYMMDD格式）
   * @param {string} endDate 结束日期（YYYYMMDD格式）
   * @param {object} addressBookCache 通讯录缓存
   * @returns {Promise<object>} { success: [], failed: [], notFound: [] }
   */
  async getUserClientStatByList(userIds, startDate, endDate, addressBookCache = null) {
    const results = { success: [], failed: [], notFound: [] };

    for (const userId of userIds) {
      // 1. 先查本地是否有该员工
      if (addressBookCache) {
        const user = addressBookCache.getUser(userId);
        if (!user) {
          results.notFound.push({ userId, error: '员工不存在，请先同步组织架构' });
          continue;
        }
      }

      // 2. 有员工 → 逐员工调用 API（注意：企业微信用 userid 而非 userid_list）
      try {
        const result = await this.post('/externalcontact/get_user_behavior_data', {
          userid: [userId],
          start_time: startDate,
          end_time: endDate
        });
        results.success.push({ userId, result });
      } catch (error) {
        results.failed.push({ userId, error: error.message });
      }
    }

    return results;
  }

  /**
   * 获取全员工联系客户统计
   * 
   * ⚠️ 企业微信官方强制规范：必须逐员工调用
   * 
   * @param {string} startDate 开始日期（YYYYMMDD格式）
   * @param {string} endDate 结束日期（YYYYMMDD格式）
   * @param {object} addressBookCache 通讯录缓存
   * @returns {Promise<object>}
   */
  async getAllUserClientStat(startDate, endDate, addressBookCache = null) {
    if (!addressBookCache) {
      return {
        error: true,
        code: 'CACHE_NOT_INITIALIZED',
        message: '请先初始化通讯录缓存',
        tip: '调用 syncFromAPI() 同步组织架构'
      };
    }

    const users = addressBookCache.getUsers();
    const userIds = users.map(u => u.userid);
    return this.getUserClientStatByList(userIds, startDate, endDate, addressBookCache);
  }

  /**
   * 智能获取联系客户统计（自动处理今天/历史）
   * 
   * @param {string} startDate 开始日期（YYYYMMDD格式）
   * @param {string} endDate 结束日期（YYYYMMDD格式）
   * @param {object} addressBookCache 通讯录缓存
   * @returns {Promise<object>}
   */
  async getUserClientStatSmart(startDate, endDate, addressBookCache = null) {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const todayNum = parseInt(today);
    const startNum = parseInt(String(startDate));
    const endNum = parseInt(String(endDate));

    const includesToday = endNum >= todayNum;

    const result = {
      isTodayIncluded: includesToday,
      startDate: String(startDate),
      endDate: String(endDate),
      errors: [],
      data: {}
    };

    if (includesToday) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0].replace(/-/g, '');

      if (startNum < parseInt(yesterdayStr)) {
        try {
          result.data.historical = await this.getAllUserClientStat(startDate, yesterdayStr, addressBookCache);
        } catch (e) {
          result.errors.push({ type: 'historical', message: e.message });
        }
      }
      result.data.today = this.getTodayStats();
    } else {
      try {
        result.data.historical = await this.getAllUserClientStat(startDate, endDate, addressBookCache);
      } catch (e) {
        result.errors.push({ type: 'historical', message: e.message });
      }
    }

    return result;
  }

  // ====================
  // 其他统计接口
  // ====================

  /**
   * 获取成员联系客户统计明细
   */
  async getUserClientDetail(userId, startDate, endDate) {
    return this.post('/externalcontact/get_user_client_detail', {
      userid: userId,
      start_time: String(startDate),
      end_time: String(endDate)
    });
  }

  /**
   * 获取群聊数据统计
   */
  async getGroupChatStat(startDate, endDate, userId = '', departmentId = '') {
    return this.post('/externalcontact/get_group_chat_data', {
      start_time: String(startDate),
      end_time: String(endDate),
      userid: userId,
      department_id: departmentId
    });
  }

  /**
   * 获取群聊统计详情
   */
  async getGroupChatDetail(chatId, startDate, endDate) {
    return this.post('/externalcontact/get_group_chat_detail', {
      chat_id: chatId,
      start_time: String(startDate),
      end_time: String(endDate)
    });
  }

  /**
   * 获取客户流失统计
   */
  async getUserLostStat(startDate, endDate, userId = '') {
    return this.post('/externalcontact/get_user_lost_data', {
      start_time: String(startDate),
      end_time: String(endDate),
      userid: userId
    });
  }
}

module.exports = ContactStats;
