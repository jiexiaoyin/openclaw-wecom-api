/**
 * 企业微信 SDK 统一封装
 * 基于官方 API: https://developer.work.weixin.qq.com
 * 
 * 统一特性：
 * - Token 自动获取与缓存
 * - 统一错误处理
 * - 文件上传支持
 * - 分页查询支持
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * 企业微信 API 错误（v1.5.2 — W3-2）
 */
class WecomAPIError extends Error {
  constructor(code, msg, extra) {
    super(`[${code}] ${msg}`);
    this.name = 'WecomAPIError';
    this.code = code;
    this.extra = extra;
  }
}

class WeComSDK {
  constructor(config) {
    this.corpId = config.corpId;
    this.corpSecret = config.corpSecret;
    this.agentId = config.agentId;
    this.tokenCache = null;
    this.tokenExpireTime = 0;
    this.baseUrl = 'https://qyapi.weixin.qq.com/cgi-bin';
  }

  // ==================== Token 管理 ====================

  /**
   * 获取 access_token
   */
  async getAccessToken() {
    const now = Date.now();
    if (this.tokenCache && now < this.tokenExpireTime) {
      return this.tokenCache;
    }

    const url = `${this.baseUrl}/gettoken`;
    const { data } = await axios.get(url, {
      params: { corpid: this.corpId, corpsecret: this.corpSecret },
      timeout: 10000
    });

    if (data.errcode !== 0) {
      throw new Error(`获取 token 失败: ${data.errmsg}`);
    }

    this.tokenCache = data.access_token;
    // 提前5分钟过期
    this.tokenExpireTime = now + (data.expires_in - 300) * 1000;
    return this.tokenCache;
  }

  /**
   * 清除 token 缓存
   */
  clearTokenCache() {
    this.tokenCache = null;
    this.tokenExpireTime = 0;
  }

  // ==================== 通用请求 ====================

  /**
   * 通用请求方法
   * @param {string} method 请求方法
   * @param {string} url 请求路径
   * @param {object} data 请求数据
   * @param {object} options 额外选项
   */
  async request(method, url, data = {}, options = {}) {
    const token = await this.getAccessToken();
    const fullUrl = `${this.baseUrl}${url}?access_token=${token}`;

    const config = { method, url: fullUrl, timeout: 15000 };
    // TODO(v1.5.3): 改用 Authorization: Bearer {token} 头

    if (method === 'GET') {
      config.params = { ...data, ...options };
    } else {
      config.data = data;
    }

    // 文件上传处理
    if (options.apiType === 'upload') {
        console.log('[DEBUG-SDK] buildFormData called, data=', JSON.stringify(data).slice(0, 200));
        const fdDebug = this.buildFormData(data);
        console.log('[DEBUG-SDK] fd.getBuffer().length=', fdDebug.getBuffer().length);
        console.log('[DEBUG-SDK] fd.getHeaders()=', JSON.stringify(fdDebug.getHeaders()));
      // v2026-07-26 10:08 fix (老板 query B):
      // 1. Node 22.5+ 全局 FormData 不认 {value, options} 结构 → 用 form-data npm 包
      // 2. axios 默认 transformRequest 调 headers.getContentType() - plain object 没这个方法,
      //    axios 静默 catch 异常 → transformRequest 返回 undefined → Buffer 被当 JSON 序列化
      //    → 企微收到 empty body → 44001
      // 3. 必须: AxiosHeaders 实例 (有 getContentType) + fd.getBuffer() 同步 buffer
      const fd = this.buildFormData(data);
      const AxiosHeaders = axios.AxiosHeaders;
      config.headers = new AxiosHeaders(fd.getHeaders());   // ← AxiosHeaders instance
      config.data = fd.getBuffer();
      config.maxBodyLength = Infinity;
      config.maxContentLength = Infinity;
    }

    // 响应类型处理
    if (options.responseType) {
      config.responseType = options.responseType;
    }

    const response = await axios(config);
    const result = response.data;

    // 统一错误处理（v1.5.2 W3-2 — WecomAPIError）
    if (result.errcode && result.errcode !== 0) {
      throw new WecomAPIError(result.errcode, result.errmsg, result);
    }

    return result;
  }

  /**
   * GET 请求
   */
  async get(url, params = {}) {
    return this.request('GET', url, params);
  }

  /**
   * POST 请求
   */
  async post(url, data = {}, options = {}) {
    return this.request('POST', url, data, options);
  }

  // ==================== 文件处理 ====================

  /**
   * 构建表单数据（文件上传）
   * v2026-07-26 10:08 fix (老板 query B): Node 22.5+ 默认用全局 Web FormData,
   *   它要求 value 必须是 Blob/string, 但 SDK uploadMedia/uploadFile 调用
   *   formData.append(key, {value:Buffer, options:{filename,contentType}})
   *   (form-data npm 包语义), Web FormData 把整个对象转 Blob 失败
   *   → empty media data → 企微 44001
   * 修复: 用 form-data npm 包（已装在 node_modules, pnpm 共享依赖）替代全局 Web FormData
   *   form-data 认 {value:Buffer, options:{filename,contentType}} 原生结构
   *   且返回 getHeaders() 给 axios 手动设 Content-Type（含 boundary）
   */
  buildFormData(data) {
    const FormDataLib = require('form-data');
    const formData = new FormDataLib();
    for (const key in data) {
      const val = data[key];
      if (val && typeof val === 'object' && Buffer.isBuffer(val.value) && val.options) {
        // {value:Buffer, options:{filename,contentType}} 原生结构, form-data 认
        formData.append(key, val.value, val.options);
      } else {
        formData.append(key, typeof val === 'string' ? val : JSON.stringify(val));
      }
    }
    return formData;
  }

  /**
   * 上传文件
   * @param {string} filePath 文件路径
   * @param {string} fieldName 字段名
   * @param {object} additionalData 额外数据
   */
  async uploadFile(filePath, fieldName = 'media', additionalData = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    const formData = {
      [fieldName]: {
        value: fileBuffer,
        options: {
          filename: fileName,
          contentType: this.getContentType(fileName)
        }
      },
      ...additionalData
    };

    return this.post('/media/upload', formData, { apiType: 'upload' });
  }

  /**
   * 下载文件
   * @param {string} mediaId 媒体 ID
   * @param {string} savePath 保存路径
   */
  async downloadFile(mediaId, savePath) {
    const response = await this.request('GET', '/media/get', { media_id: mediaId }, { responseType: 'stream' });

    if (savePath) {
      const writer = fs.createWriteStream(savePath);
      response.data.pipe(writer);
      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve({ savePath }));
        writer.on('error', reject);
      });
    }

    return response.data;
  }

  /**
   * 根据文件扩展名获取 Content-Type
   */
  getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const types = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
      '.mp3': 'audio/mpeg', '.wav': 'audio/x-wav', '.amr': 'audio/amr',
      '.mp4': 'video/mp4', '.avi': 'video/x-msvideo',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip'
    };
    return types[ext] || 'application/octet-stream';
  }

  // ==================== 分页查询 ====================

  /**
   * 分页查询通用方法
   * @param {Function} fetchFn 获取单页数据的函数
   * @param {string} listKey 返回列表的字段名
   * @param {number} pageSize 每页数量
   * @returns {Promise<Array>} 所有数据
   */
  async paginate(fetchFn, listKey = 'list', pageSize = 100) {
    let cursor = '';
    const results = [];

    do {
      const pageData = await fetchFn(cursor, pageSize);
      const list = pageData[listKey] || [];
      results.push(...list);
      cursor = pageData.next_cursor || '';
    } while (cursor);

    return results;
  }

  /**
   * 批量 «拉列表 → 逐条查详情 → 并发合返» 通用助手 (v1.5.1+)
   *
   * 适用场景：老板需要「某状态单据 列表+详情」，例如审批/打卡/会议这类
   * 「先拿 ID，再查详情才能拿全信息」的两步接口。
   *
   * @param {object} options
   * @param {Function} options.listFn      接 (cursor, pageSize) 返 列表页
   * @param {Function} options.detailFn    接 (id) 返 详情页
   * @param {string}   [options.listKey='list']  列表页中数组字段名（如 'sp_no_list'）
   * @param {string}   [options.nextCursorKey='next_cursor']
   * @param {string}   [options.detailInfoKey='info']   详情页中主体字段名
   * @param {number}   [options.concurrency=10]        并发路数
   * @param {number}   [options.pageSize=100]          单页数量
   * @param {number}   [options.maxPages=20]           防止意外越界循环
   * @returns {Promise<Array<{id, info, error?}>>}      详情结果数组，error 表示该条拼失败
   */
  async batchWithDetails(options) {
    const {
      listFn,
      detailFn,
      listKey = 'list',
      nextCursorKey = 'next_cursor',
      detailInfoKey = 'info',
      concurrency = 10,
      pageSize = 100,
      maxPages = 20
    } = options;

    // 1. 分页拉列表
    const allIds = [];
    let cursor = options.cursor ?? '';
    let pages = 0;
    while (pages < maxPages) {
      const pageData = await listFn(cursor, pageSize);
      const ids = pageData[listKey] || [];
      allIds.push(...ids);
      cursor = pageData[nextCursorKey] || '';
      pages++;
      if (!cursor || ids.length === 0) break;
    }
    if (allIds.length === 0) return [];

    // 2. 并发拉详情
    const results = [];
    let inflight = [];
    for (let i = 0; i < allIds.length; i++) {
      const id = allIds[i];
      inflight.push(
        Promise.resolve()
          .then(() => detailFn(id))
          .then(d => ({ id, info: detailInfoKey ? (d && d[detailInfoKey]) || d : d }))
          .catch(e => ({ id, error: e.message ? e.message.substring(0, 120) : String(e) }))
      );
      if (inflight.length >= concurrency || i === allIds.length - 1) {
        results.push(...await Promise.all(inflight));
        inflight = [];
      }
    }
    return results;
  }

  // ==================== 工具方法 ====================

  /**
   * 时间戳转日期
   */
  timestampToDate(timestamp) {
    return new Date(timestamp * 1000);
  }

  /**
   * 日期转时间戳
   */
  dateToTimestamp(date) {
    return Math.floor(new Date(date).getTime() / 1000);
  }

  /**
   * 格式化用户列表（用 | 分隔）
   */
  formatUserList(userIds) {
    return Array.isArray(userIds) ? userIds.join('|') : userIds;
  }

  /**
   * 格式化部门列表
   */
  formatDepartmentList(departmentIds) {
    return Array.isArray(departmentIds) ? departmentIds.join('|') : departmentIds;
  }

  // ==================== 企业信息 ====================

  /**
   * 获取企业微信接口 IP 段
   * 用于设置企业可信IP
   */
  async getApiIpList() {
    return this.get('/cgi-bin/get_api_ip_json', {});
  }

  /**
   * 获取企业微信回调 IP 段
   * 用于验证回调请求来源
   */
  async getCallbackIpList() {
    return this.get('/cgi-bin/getcallback_ip_json', {});
  }
}

module.exports = WeComSDK;
module.exports.WecomAPIError = WecomAPIError;
