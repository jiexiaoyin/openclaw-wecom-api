/**
 * 身份验证模块
 * API 章节：四 - 身份验证
 * 包含：网页授权登录、企业微信 Web 登录、二次验证
 */

const WeComSDK = require('../../sdk');

class Auth extends WeComSDK {
  constructor(config) {
    super(config);
    this.redirectUri = config.redirectUri || '';
  }

  // ========== 网页授权登录 ==========

  /**
   * 构造网页授权链接
   * @param {string} redirectUri 授权回调地址
   * @param {string} state 自定义状态
   * @param {string} scope 授权作用域: snsapi_base 或 snsapi_userinfo
   */
  getWebAuthUrl(redirectUri, state = '', scope = 'snsapi_userinfo') {
    const encodedUri = encodeURIComponent(redirectUri);
    return `https://open.work.weixin.qq.com/wwopen/sso/qrConnect?appid=${this.corpId}&agentid=${this.agentId}&redirect_uri=${encodedUri}&state=${state}&scope=${scope}`;
  }

  /**
   * 获取访问用户身份（用户同意授权后获取）
   * @param {string} code 授权 code
   */
  async getUserInfo(code) {
    throw new Error('getUserInfoByCode 已废弃：文档无 /user/getuserinfo（v1.5.0）'); // return this.get('/user/getuserinfo', { code });
  }

  /**
   * 获取访问用户敏感信息
   * @param {string} code 授权 code
   */
  async getUserDetail(code) {
    throw new Error('getUserDetailByCode 已废弃：文档无 /user/getuserdetail（v1.5.0）'); // return this.post('/user/getuserdetail', { code });
  }

  // ========== 企业微信 Web 登录 ==========

  /**
   * 获取用户登录身份（Web 登录）
   * ⚠️ v1.5.0 暂禁：文档无 /user/get_login_info 端点
   */
  async getWebLoginUserInfo(code) {
    throw new Error('getWebLoginUserInfo 已废弃：文档无此端点（v1.5.0）');
    // return this.post('/user/get_login_info', { code });
  }

  // ========== 二次验证 ==========

  /**
   * 获取用户二次验证信息
   * ⚠️ v1.5.0 暂禁：文档无 /user/get_second_verification_info 端点
   */
  async getSecondVerifyInfo(userId) {
    throw new Error('getSecondVerifyInfo 已废弃：文档无此端点（v1.5.0）');
    // return this.post('/user/get_second_verification_info', { userid: userId });
  }

  /**
   * 登录二次验证
   * ⚠️ v1.5.0 暂禁：文档无 /user/second_verification 端点
   */
  async secondVerify(userId, verificationCode) {
    throw new Error('secondVerify 已废弃：文档无此端点（v1.5.0）');
    // return this.post('/user/second_verification', { userid: userId, verification_code: verificationCode });
  }

  /**
   * 使用二次验证
   * ⚠️ v1.5.0 暂禁：文档无 /user/apply_second_verification 端点
   */
  async applySecondVerify(userId) {
    throw new Error('applySecondVerify 已废弃：文档无此端点（v1.5.0）');
    // return this.post('/user/apply_second_verification', { userid: userId });
  }

  // ========== 登录辅助方法 ==========

  /**
   * 通过 code 获取用户 ID
   * @param {string} code 授权 code
   */
  async getUserIdByCode(code) {
    try {
      const result = await this.getUserInfo(code);
      if (result.ErrCode === 0) {
        return result.UserId;
      }
      throw new Error(`getUserIdByCode failed: ErrCode=${result.ErrCode}`);
    } catch (err) {
      throw err;
    }
  }

  /**
   * v1.5.2 coverage-enhance: 标记用户二次验证成功
   * 用于标记用户二次验证已完成, 避免重复弹窗
   * @param {string} userId 成员 userid
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async userAuthSuccess(userId) {
    return this.post('/user/authsucc', { userid: userId });
  }

  /**
   * v1.5.2 coverage-enhance: 启用/查询用户二次验证 (TFA)
   * @param {string} userId 成员 userid
   * @param {number} status 1=启用, 2=关闭
   * @returns {Promise<object>} { errcode, errmsg, status }
   */
  async setUserTwoFactor(userId, status) {
    return this.post('/user/tfa', { userid: userId, status });
  }

}

module.exports = Auth;
