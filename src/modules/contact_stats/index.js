/**
 * 客户统计模块
 * API 章节：十三 - 统计管理
 * 包含：联系客户统计、群聊数据统计
 * 
 * =====================================================
 * ⚠️ 重要限制说明 (2026-03-21)
 * =====================================================
 * 
 * 1. 【数据时效限制】
 *    - API 无法查询【当天数据】
 *    - 只能查询【昨天及之前】的历史数据
 *    - 判断方式：endTime <= 昨天 23:59:59
 * 
 * 2. 【多用户查询限制】
 *    - 传入多个 userid → 返回【总体数据】，不是每人一条
 *    - 如需查看【每个员工】的数据 → 必须逐个调用 API
 * 
 * 3. 【当日数据获取方案】
 *    - 当日实时数据需通过【事件回调】获取：
 *      * add_external_contact     → 新增客户
 *      * change_external_contact  → 客户变更
 *      * del_external_contact     → 删除/拉黑客户
 *      * 消息发送事件            → 聊天数/消息数
 * 
 * =====================================================
 */

const WeComSDK = require('../../sdk');
const fs = require('fs');
const path = require('path');

class ContactStats extends WeComSDK {
  constructor(config) {
    super(config);
    // 用于缓存当日实时数据（从事件回调收集）
    this._storagePath = path.join(process.cwd(), 'data', 'wecom-stats.json');
    this._todayStats = this._loadStats();
  }

  /**
   * 加载持久化的统计数据
   * @private
   */
  _loadStats() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    try {
      if (fs.existsSync(this._storagePath)) {
        const data = JSON.parse(fs.readFileSync(this._storagePath, 'utf8'));
        // 检查是否是今天的数据
        if (data.date === today) {
          console.log('[ContactStats] 从持久化存储恢复今日统计:', data);
          return data;
        }
      }
    } catch (e) {
      console.log('[ContactStats] 加载统计数据失败:', e.message);
    }
    
    // 返回新的空统计
    return this._createEmptyStats(today);
  }

  /**
   * 创建空统计数据
   * @private
   */
  _createEmptyStats(date) {
    return {
      date: date,
      newCustomers: 0,
      lostCustomers: 0,
      messagesSent: 0,
      chatsCount: 0,
      applications: 0
    };
  }

  /**
   * 保存统计数据到持久化存储
   * @private
   */
  _saveStats() {
    try {
      const dir = path.dirname(this._storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this._storagePath, JSON.stringify(this._todayStats, null, 2));
    } catch (e) {
      console.log('[ContactStats] 保存统计数据失败:', e.message);
    }
  }

  /**
   * 初始化当日统计数据缓存
   * @private
   */
  _initTodayStats() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return {
      date: today,
      // 当日实时数据（从事件回调累计）
      newCustomers: 0,           // 新增客户数
      lostCustomers: 0,         // 流失客户数
      messagesSent: 0,           // 发送消息数
      chatsCount: 0,             // 聊天数
      applications: 0            // 发起申请数
    };
  }

  /**
   * 获取昨天的时间戳范围
   * @private
   * @returns {{startTime: number, endTime: number}}
   */
  _getYesterdayRange() {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 昨天 00:00:00
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    
    // 昨天 23:59:59
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);
    
    return {
      startTime: Math.floor(startOfYesterday.getTime() / 1000),
      endTime: Math.floor(endOfYesterday.getTime() / 1000)
    };
  }

  /**
   * 检查指定时间是否包含当天
   * @private
   * @param {number} endTime 结束时间戳
   * @returns {boolean}
   */
  _includesToday(endTime) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const endDate = new Date(endTime * 1000);
    const todayStartTimestamp = Math.floor(todayStart.getTime() / 1000);
    
    return endTime >= todayStartTimestamp;
  }

  /**
   * 从事件回调更新当日统计数据
   * 
   * 📌 使用场景：
   * 当收到企业微信事件回调时，调用此方法更新当日统计
   * 
   * @param {string} eventType 事件类型
   * @param {object} eventData 事件数据
   * 
   * @example
   * // 在回调处理中调用
   * stats.updateTodayStats('add_external_contact', { userId: 'user1', externalUserId: 'ext1' });
   */
  updateTodayStats(eventType, eventData) {
    const today = new Date().toISOString().split('T')[0];
    
    // 检查是否需要重置（跨天）
    if (this._todayStats.date !== today) {
      this._todayStats = this._createEmptyStats(today);
      this._saveStats(); // 保存新的空统计
    }
    
    switch (eventType) {
      case 'add_external_contact':
        // 新增客户
        this._todayStats.newCustomers++;
        break;
        
      case 'del_external_contact':
        // 删除/拉黑客户
        this._todayStats.lostCustomers++;
        break;
        
      case 'change_external_contact':
        // 客户变更（可能是流失）
        // 需要根据事件中的 state 判断
        if (eventData.state === 'unsubscribe') {
          this._todayStats.lostCustomers++;
        }
        break;
        
      case 'new_msg':
      case 'msgsend':
        // 发送消息
        this._todayStats.messagesSent++;
        break;
        
      case 'kf_msg':
      case 'kf_send_msg':
        // 客服消息
        this._todayStats.messagesSent++;
        break;
        
      default:
        break;
    }
    
    // 每次更新后保存到持久化存储
    this._saveStats();
    
    return this._todayStats;
  }

  /**
   * 智能获取联系客户统计（自动判断日期范围）
   * 
   * 📌 功能说明：
   * - 自动判断查询日期是否包含今天
   * - 历史数据 → 调用 API（YYYYMMDD格式）
   * - 当日数据 → 返回缓存的实时统计
   * 
   * @param {string|number} startDate 开始日期（YYYYMMDD格式）
   * @param {string|number} endDate 结束日期（YYYYMMDD格式）
   * @param {string} userId 成员ID（可选，多个用逗号分隔）
   * @param {string} departmentId 部门ID（可选）
   * @returns {Promise<object>}
   * 
   * @example
   * // 查询最近7天数据（会自动处理今天和历史的返回）
   * const stats = await contactStats.getUserClientStatSmart(
   *   '20260314',  // 7天前
   *   '20260321',  // 今天
   *   'user1,user2'
   * );
   * console.log(stats);
   * // {
   * //   historical: { ... },  // 历史数据（API返回）
   * //   today: { newCustomers: 5, ... },  // 当日实时数据
   * //   isTodayIncluded: true
   * // }
   */
  async getUserClientStatSmart(startDate, endDate, userId = '', departmentId = '') {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const todayNum = parseInt(today);
    const startNum = parseInt(String(startDate));
    const endNum = parseInt(String(endDate));
    
    const includesToday = endNum >= todayNum;
    
    const result = {
      isTodayIncluded: includesToday,
      startDate: String(startDate),
      endDate: String(endDate),
      historical: null,
      today: null
    };
    
    if (includesToday) {
      // 需要分别处理：历史 + 今天
      
      // 1. 获取昨天及之前的历史数据
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0].replace(/-/g, '');
      
      if (startNum < parseInt(yesterdayStr)) {
        // 只查询到昨天
        result.historical = await this.getUserClientStat(
          startDate,
          yesterdayStr,
          userId,
          departmentId
        );
      }
      
      // 2. 当日数据从缓存返回
      result.today = { ...this._todayStats };
      
    } else {
      // 全部是历史数据，直接调用 API
      result.historical = await this.getUserClientStat(
        startDate,
        endDate,
        userId,
        departmentId
      );
    }
    
    return result;
  }

  /**
   * 获取「联系客户统计」数据（标准API）
   * 
   * ⚠️ 注意：
   * - 无法查询当天数据，只能查询昨天及之前
   * - 传入多个userid返回总体数据，非每人一条
   * - 日期格式：YYYYMMDD（如 20260320）
   * 
   * @param {string|number} startDate 开始日期（YYYYMMDD格式）
   * @param {string|number} endDate 结束日期（YYYYMMDD格式）
   * @param {string} userId 成员ID（可选，多个用逗号分隔）
   * @param {string} departmentId 部门ID（可选）
   */
  async getUserClientStat(startDate, endDate, userId = '', departmentId = '') {
    /**
     * 📌 API 限制说明：
     * 1. endDate 不能是今天
     * 2. 多个 userid 返回总体数据
     * 3. 查看单人数据需逐个调用
     */
    return this.post('/externalcontact/get_user_client_data', {
      start_time: String(startDate),
      end_time: String(endDate),
      userid: userId,
      department_id: departmentId
    });
  }

  /**
   * 获取成员联系客户统计明细
   * 
   * @param {string} userId 成员ID
   * @param {string|number} startDate 开始日期（YYYYMMDD格式）
   * @param {string|number} endDate 结束日期（YYYYMMDD格式）
   */
  async getUserClientDetail(userId, startDate, endDate) {
    return this.post('/externalcontact/get_user_client_detail', {
      userid: userId,
      start_time: String(startDate),
      end_time: String(endDate)
    });
  }

  // ========== 群聊数据统计 ==========

  /**
   * 获取「群聊数据统计」数据（标准API）
   * 
   * ⚠️ 注意：同样受当天数据限制
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
   * 智能获取群聊统计数据
   * @see getUserClientStatSmart
   */
  async getGroupChatStatSmart(startDate, endDate, userId = '', departmentId = '') {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const todayNum = parseInt(today);
    const startNum = parseInt(String(startDate));
    const endNum = parseInt(String(endDate));
    
    const includesToday = endNum >= todayNum;
    
    const result = {
      isTodayIncluded: includesToday,
      historical: null,
      today: null
    };
    
    if (includesToday) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0].replace(/-/g, '');
      
      if (startNum < parseInt(yesterdayStr)) {
        result.historical = await this.getGroupChatStat(
          startDate,
          yesterdayStr,
          userId,
          departmentId
        );
      }
      // 当日群聊数据需要从事件回调收集（暂无缓存）
      result.today = { note: '当日群聊数据需通过事件回调获取' };
    } else {
      result.historical = await this.getGroupChatStat(startDate, endDate, userId, departmentId);
    }
    
    return result;
  }

  /**
   * 获取群聊统计数据详情
   */
  async getGroupChatDetail(chatId, startDate, endDate) {
    return this.post('/externalcontact/get_group_chat_detail', {
      chat_id: chatId,
      start_time: String(startDate),
      end_time: String(endDate)
    });
  }

  // ========== 客户流失统计 ==========

  /**
   * 获取客户流失统计数据
   */
  async getUserLostStat(startDate, endDate, userId = '') {
    return this.post('/externalcontact/get_user_lost_data', {
      start_time: String(startDate),
      end_time: String(endDate),
      userid: userId
    });
  }

  // ========== 客户群统计 ==========

  /**
   * 获取客户群成员统计
   */
  async getGroupChatMemberStat(groupChatId, startDate, endDate) {
    return this.post('/externalcontact/get_group_chat_member_stat', {
      chat_id: groupChatId,
      start_time: String(startDate),
      end_time: String(endDate)
    });
  }

  // ========== 客户互动统计 ==========

  /**
   * 获取客户互动统计数据
   */
  async getUserInteractionStat(userId, startDate, endDate) {
    return this.post('/externalcontact/get_user_interaction_stat', {
      userid: userId,
      start_time: String(startDate),
      end_time: String(endDate)
    });
  }
}

module.exports = ContactStats;
