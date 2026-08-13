/**
 * 其他/边缘业务模块 (v1.5.2 coverage-enhance)
 * 
 * 包含未单独建模块的低频端点, 按域分组:
 * - card: 电子发票 (card/invoice/reimburse/*)
 * - corpgroup: 互联企业
 * - wedrive: 微盘管理
 * - exmail: 腾讯企业邮
 * - externalpay: 对外收款
 * - miniapppay: 小程序支付
 * - report: 汇报/巡查 (report/*)
 * - aibot: 智能机器人
 * - gettoken: 访问凭证
 */
const WeComSDK = require('../../sdk');

class Misc extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== card 域 (电子发票) ==========

  /**
   * 获取电子发票详情
   * @param {string[]} cardIds 发票卡券 ID 列表
   */
  async getCardInvoiceInfo(cardIds) {
    return this.post('/card/invoice/reimburse/getinvoiceinfo', { card_id_list: cardIds });
  }

  /**
   * 批量获取电子发票详情
   * @param {string[]} cardIds 发票卡券 ID 列表
   */
  async batchGetCardInvoiceInfo(cardIds) {
    return this.post('/card/invoice/reimburse/getinvoiceinfobatch', { card_id_list: cardIds });
  }

  /**
   * 更新电子发票报销状态
   * @param {string} cardId 发票卡券 ID
   * @param {number} reimburseStatus 状态码
   */
  async updateCardInvoiceStatus(cardId, reimburseStatus) {
    return this.post('/card/invoice/reimburse/updateinvoicestatus', {
      card_id: cardId,
      reimburse_status: reimburseStatus
    });
  }

  /**
   * 批量更新电子发票报销状态
   * @param {string[]} cardIds 发票卡券 ID 列表
   * @param {number} reimburseStatus 状态码
   */
  async batchUpdateCardInvoiceStatus(cardIds, reimburseStatus) {
    return this.post('/card/invoice/reimburse/updatestatusbatch', {
      card_id_list: cardIds,
      reimburse_status: reimburseStatus
    });
  }

  // ========== corpgroup 域 (互联企业) ==========

  /**
   * 互联企业 unionid 转 corpid
   * @param {string[]} unionids unionid 列表
   */
  async getCorpIdByUnionId(unionids) {
    return this.post('/corpgroup/unionid', { unionid_list: unionids });
  }

  /**
   * 获取互联企业 access_token
   * @param {string[]} corpIds 互联企业 corpid 列表
   */
  async getCorpGroupToken(corpIds) {
    return this.post('/corpgroup/corp/gettoken', { corpid_list: corpIds });
  }

  // ========== wedrive 域 (微盘) ==========

  /**
   * 微盘管理 (新增/删除/移动空间)
   * @param {object} params 操作参数 (action=create_space/delete_space/move_file 等)
   */
  async wedriveManage(params) {
    return this.post('/wedrive/mng', params);
  }

  /**
   * 创建微盘新文件
   * @param {object} params { spaceid, fatherid, file_type, file_name }
   */
  async wedriveCreate(params) {
    return this.post('/wedrive/new', params);
  }

  // ========== exmail 域 (腾讯企业邮) ==========

  /**
   * 企业邮写信 (代发邮件)
   * @param {object} params { from, to, subject, content, cc?, bcc? }
   */
  async composeExmail(params) {
    return this.post('/exmail/app/compose', params);
  }

  // ========== externalpay 域 (对外收款) ==========

  /**
   * 查询商户号信息
   * @param {string} merchantId 商户号
   */
  async getExternalPayMerchant(merchantId) {
    return this.post('/externalpay/getmerchant', { merchant_id: merchantId });
  }


  /**
   * v1.5.2 coverage-enhance: 查询对外支付订单
   * 用于查询对外支付的订单状态 (工资发放/供应商付款等场景)
   * @param {object} params { out_trade_no 或 transaction_id 二选一 }
   * @returns {Promise<object>} { errcode, errmsg, trade_state, amount, pay_time, ... }
   */
  async getExternalPay(params) {
    return this.post('/externalpay/get', params);
  }


  /**
   * v1.5.2 coverage-enhance: 小程序客户分配 (transfer 客户到指定小程序)
   * 用于把外部联系人从企微转到指定小程序 (小程序场景下的客户分配)
   * @param {object} params { external_userid, mini_program_appid, transfer_reason }
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async transferToMiniProgram(params) {
    return this.post('/miniprogram/transfer', params);
  }



  // ========== miniapppay 域 (小程序支付) ==========

  /**
   * 小程序退款
   * @param {object} params { order_id, refund_amount, reason }
   */
  async refundMiniAppPay(params) {
    return this.post('/miniapppay/refund', params);
  }


  /**
   * v1.5.2 coverage-enhance: 上传小程序支付凭证 (订单上传)
   * 用于小程序支付场景下上传订单支付凭证
   * @param {object} params { order_id, pay_info, media_id? }
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async uploadMiniAppPay(params) {
    return this.post('/miniapppay/upload', params);
  }


  /**
   * v1.5.2 coverage-enhance: 申请小程序支付 (订单创建前申请)
   * 用于小程序支付场景下申请支付订单
   * @param {object} params { appid, mch_id, out_trade_no, body, total_fee, etc }
   * @returns {Promise<object>} { errcode, errmsg, prepay_id }
   */
  async applyMiniAppPay(params) {
    return this.post('/miniapppay/apply', params);
  }

  /**
   * v1.5.2 coverage-enhance: 关闭小程序支付订单
   * 用于关闭未支付或已撤销的订单
   * @param {string} outTradeNo 商户订单号
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async closeMiniAppPay(outTradeNo) {
    return this.post('/miniapppay/close', { out_trade_no: outTradeNo });
  }

  /**
   * v1.5.2 coverage-enhance: 创建小程序支付订单
   * 用于创建支付订单, 返回支付参数供前端调起支付
   * @param {object} params { appid, mch_id, out_trade_no, total_fee, spbill_create_ip, etc }
   * @returns {Promise<object>} { errcode, errmsg, prepay_id, pay_sign }
   */
  async createMiniAppPay(params) {
    return this.post('/miniapppay/create', params);
  }

  /**
   * v1.5.2 coverage-enhance: 查询小程序支付订单
   * 用于查询订单支付状态 (同步 SDK 端点 /miniapppay/get)
   * @param {string} outTradeNo 商户订单号
   * @returns {Promise<object>} { errcode, errmsg, trade_state, transaction_id }
   */
  async getMiniAppPay(outTradeNo) {
    return this.post('/miniapppay/get', { out_trade_no: outTradeNo });
  }



  // ========== report 域 (汇报) ==========

  /**
   * 获取居民/居民服务汇报分类
   * @param {object} params 筛选条件
   */
  async getResidentReportCategory(params = {}) {
    return this.post('/report/resident/category', params);
  }

  /**
   * 获取巡查汇报分类
   * @param {object} params 筛选条件
   */
  async getPatrolReportCategory(params = {}) {
    return this.post('/report/patrol/category', params);
  }

  // ========== aibot 域 (智能机器人) ==========

  /**
   * 智能机器人问答 (v2 API)
   * @param {object} params { query, userid, agent_id }
   */
  async aiBotResponse(params) {
    return this.post('/aibot/response', params);
  }

  // ========== access_token ==========

  /**
   * 获取 access_token (应用级凭证, 不需要 corpsecret 加密传输)
   * @param {string} corpid 企业 ID
   * @param {string} corpsecret 应用密钥
   */
  async getAccessToken(corpid, corpsecret) {
    return this.get('/gettoken', { corpid, corpsecret });
  }
}

module.exports = Misc;
