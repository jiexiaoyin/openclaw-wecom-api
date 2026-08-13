/**
 * 获客助手模块
 * API 章节：十三 - 获客助手
 * 包含：获客链接管理、额度管理、广告优化等
 */

const WeComSDK = require('../../sdk');

class OceanEngine extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 获客链接管理 ==========

  /**
   * 创建获客链接
   * @param {string} name 链接名称
   * @param {string} intro 链接简介
   * @param {string} userId 成员 ID
   * @param {string} type 链接类型: 1-联系我 2-加入群聊
   * @param {string} contentId 联系我或群聊 ID
   */
  async createAcquisitionLink(name, intro, userId, type = 1, contentId) {
    return this.post('/externalcontact/customer_acquisition/create_link', {
      name,
      intro,
      user_id: userId,
      type,
      content_id: contentId
    });
  }

  /**
   * 获取获客链接列表
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  getAcquisitionLinkList(offset = 0, size = 100) {
    return this.post('/externalcontact/customer_acquisition/list_link', {
      offset,
      limit: size
    });
  }

  /**
   * 获取获客链接详情
   * @param {string} linkId 链接 ID
   */
  getAcquisitionLinkDetail(linkId) {
    return this.post('/externalcontact/customer_acquisition/get', {
      link_id: linkId
    });
  }

  /**
   * 更新获客链接
   * @param {string} linkId 链接 ID
   * @param {object} params 更新参数
   */
  updateAcquisitionLink(linkId, { name, intro, state }) {
    return this.post('/externalcontact/customer_acquisition/update_link', {
      link_id: linkId,
      name,
      intro,
      state
    });
  }

  /**
   * 删除获客链接
   * @param {string} linkId 链接 ID
   */
  deleteAcquisitionLink(linkId) {
    return this.post('/externalcontact/customer_acquisition/delete_link', {
      link_id: linkId
    });
  }

  // ========== 获客助手额度管理 ==========

  /**
   * 获取成员收客链接收客总数
   * @param {string} userId 成员 ID
   * @param {string} linkId 链接 ID
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   */
  async getLinkCustomerCnt(userId, linkId, startTime, endTime) {
    return this.post('/externalcontact/customer_acquisition/statistic', {
      user_id: userId,
      link_id: linkId,
      start_time: startTime,
      end_time: endTime
    });
  }

  /**
   * 获取企业获客链负责人收客数
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   */
  async getCorpCustomerCnt(startTime, endTime) {
    return this.post('/externalcontact/customer_acquisition_quota', {
      start_time: startTime,
      end_time: endTime
    });
  }

  /**
   * 获取成员获客统计
   * @param {string} userId 成员 ID
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   */
  async getUserAcquisitionStat(userId, startTime, endTime) {
    return this.post('/externalcontact/customer_acquisition/customer', {
      user_id: userId,
      start_time: startTime,
      end_time: endTime
    });
  }

  /**
   * 获取获客链接统计
   * @param {string} linkId 链接 ID
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   */
  async getLinkStat(linkId, startTime, endTime) {
    return this.post('/externalcontact/customer_acquisition/statistic', {
      link_id: linkId,
      start_time: startTime,
      end_time: endTime
    });
  }

  // ========== 获客助手事件 ==========

  /**
   * 获取由获客链接添加的客户信息
   * @param {string} linkId 链接 ID
   * @param {string} userId 成员 ID
   * @param {string} cursor 分页游标
   */
  async getLinkCustomers(linkId, userId, cursor = '') {
    return this.post('/externalcontact/customer_acquisition/customer', {
      link_id: linkId,
      user_id: userId,
      cursor
    });
  }

  // ========== 广告优化 ==========

  /**
   * 提升广告有效率
   * ⚠️ v1.4.0 暂禁：官方文档无 /externalcontact/acquisition/ad/improve 端点
   */
  async improveAdEffect(userId, externalUserId) {
    throw new Error('improveAdEffect 已废弃：官方文档无此端点（v1.4.0），广告能力需平台内部');
    // return this.post('/externalcontact/acquisition/ad/improve', {
    //   user_id: userId,
    //   external_userid: externalUserId
    // });
  }

  /**
   * 获取广告获客分析
   * ⚠️ v1.4.0 暂禁：官方文档无 /externalcontact/acquisition/ad/analysis 端点
   */
  async getAdAnalysis(startTime, endTime, userId = '') {
    throw new Error('getAdAnalysis 已废弃：官方文档无此端点（v1.4.0）');
    // return this.post('/externalcontact/acquisition/ad/analysis', {
    //   start_time: startTime,
    //   end_time: endTime,
    //   user_id: userId
    // });
  }

  // ========== 成员收客详情 ==========

  /**
   * 获取成员多次收消息详情
   * @param {string} userId 成员 ID
   * @param {string} cursor 分页游标
   * @param {number} size 每页数量
   */
  async getUserMultiReceiveStat(userId, cursor = '', size = 100) {
    return this.post('/externalcontact/customer_acquisition/get_chat_info', {
      user_id: userId,
      cursor,
      limit: size
    });
  }
}

module.exports = OceanEngine;
