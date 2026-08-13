/**
 * 通讯录管理模块
 * API 章节：三 - 通讯录管理
 * 包含：成员管理、部门管理、标签管理、异步导入导出
 */

const WeComSDK = require('../../sdk');
const logger = require('../../utils/logger');
const log = logger('addressbook');

class AddressBook extends WeComSDK {
  constructor(config) {
    super(config);
    // v1.5.2 P0：缓存 + flushCache (事件路由: change_type=create_user/update_user/delete_user)
    this._userCache = new Map();        // Map<cacheKey, { timestamp, data }>
    this._deptCache = new Map();        // Map<deptCacheKey, { timestamp, data }> 支持 list + detail 共存
    this._userDetailCache = new Map();  // Map<userid, { timestamp, data }>
    this._cacheTtlMs = 24 * 3600 * 1000; // 24h TTL, 但接企业微信 change_type 事件后 flush
  }

  /**
   * v1.5.2 P0：清空所有地址本缓存
   * 使用：接到 企业微信通讯录变更事件 (change_type=create_user/update_user/delete_user) 后调用
   * 行为：仅清缓存，不主动重新拉取 (下次 get* 时再拉)
   * @returns {object} { flushed, before, timestamp }
   */
  flushCache() {
    const before = {
      users: this._userCache.size,
      departments: this._deptCache ? 1 : 0,
      userDetails: this._userDetailCache.size,
    };
    this._userCache.clear();
    this._deptCache.clear();
    this._userDetailCache.clear();
    const r = { flushed: true, before, timestamp: Math.floor(Date.now() / 1000) };
    if (process?.env?.WECOM_DEBUG_CACHE) log.info('[addressbook] flush:', r);
    return r;
  }

  /**
   * v1.5.2 P0：缓存版本 getDepartmentUsers
   * 如果有 cache 且未过期 → 返回缓存
   * 否则发起实际 API 请求并缓存
   */
  async getDepartmentUsers(departmentId, fetchChild = false) {
    const cacheKey = `${departmentId}_${fetchChild ? 1 : 0}`;
    const cached = this._userCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this._cacheTtlMs) {
      if (process?.env?.WECOM_DEBUG_CACHE) log.info('[addressbook] cache hit:', cacheKey);
      return cached.data;
    }
    const data = await this.post('/user/simplelist', {
      department_id: departmentId,
      fetch_child: fetchChild ? 1 : 0,
    });
    // v1.5.2 P0：只缓存 errcode=0 结果（错误不缓存，调用者可能 rethrow）
    if (data && data.errcode === 0) {
      this._userCache.set(cacheKey, { timestamp: Date.now(), data });
    }
    return data;
  }

  /**
   * v1.5.2 P0：缓存版本 getDepartmentList
   */
  async getDepartmentList(departmentId = 1) {
    // v1.5.2 P0：缓存 + flushCache (事件路由: change_type=update_party/delete_party)
    const cacheKey = `list_${departmentId}`;
    const cached = this._deptCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this._cacheTtlMs) {
      if (process?.env?.WECOM_DEBUG_CACHE) log.info('[addressbook] dept list cache hit:', cacheKey);
      return cached.data;
    }
    const data = await this.post('/department/list', { id: departmentId });
    // v1.5.2 P0：只缓存 errcode=0 结果（错误不缓存，调用者可能 rethrow）
    if (data && data.errcode === 0) {
      this._deptCache.set(cacheKey, { timestamp: Date.now(), data });
    }
    return data;
  }

  // ========== 成员管理 ==========

  /**
   * 创建成员
   * @param {object} params 成员参数
   */
  async createUser(params) {
    const { userId, name, mobile, email, departments, position, gender, avatar, enable } = params;
    return this.post('/user/create', {
      userid: userId,
      name,
      mobile,
      email,
      department: departments,
      position,
      gender: gender || 0,
      avatar,
      enable: enable !== undefined ? enable : 1
    });
  }

  /**
   * 读取成员
   * @param {string} userId 成员 userid
   */
  async getUser(userId) {
    // v1.5.2 P0：缓存 + flushCache (事件路由: change_type=update_user/delete_user)
    const cached = this._userDetailCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < this._cacheTtlMs) {
      if (process?.env?.WECOM_DEBUG_CACHE) log.info('[addressbook] user cache hit:', userId);
      return cached.data;
    }
    // v1.5.2 修复：POST 改 GET（文档明确 GET 直查参数 /user/get?userid=）
    const data = await this.get('/user/get', { userid: userId });
    if (data && data.errcode === 0) {
      this._userDetailCache.set(userId, { timestamp: Date.now(), data });
    }
    return data;
  }

  /**
   * 更新成员
   * @param {object} params 成员参数
   */
  async updateUser(params) {
    const { userId, name, mobile, email, departments, position, gender, avatar, enable } = params;
    return this.post('/user/update', {
      userid: userId,
      name,
      mobile,
      email,
      department: departments,
      position,
      gender,
      avatar,
      enable
    });
  }

  /**
   * 删除成员
   * @param {string} userId 成员 userid
   */
  async deleteUser(userId) {
    return this.post('/user/delete', { userid: userId });
  }

  /**
   * 批量删除成员
   * @param {string[]} userIds 成员 userid 列表
   */
  async batchDeleteUsers(userIds) {
    return this.post('/user/batchdelete', { useridlist: userIds });
  }

  /**
   * 获取部门成员
   * @param {number} departmentId 部门 id
   * @param {boolean} fetchChild 是否递归获取子部门成员
   */
  // v1.5.2 P0: 已上移到顶部 (35 行附近) 含缓存版, 删去重复
  // async getDepartmentUsers(departmentId, fetchChild = false) {
  //   return this.get('/user/simplelist', {
  //     department_id: departmentId,
  //     fetch_child: fetchChild ? 1 : 0
  //   });
  // }

  /**
   * 获取部门成员详情
   * @param {number} departmentId 部门 id
   * @param {boolean} fetchChild 是否递归获取子部门成员
   */
  async getDepartmentUsersDetail(departmentId, fetchChild = false) {
    // v1.5.2 P0：缓存 + flushCache (事件路由: change_type=create_user/update_user/delete_user)
    const cacheKey = `detail_${departmentId}_${fetchChild ? 1 : 0}`;
    const cached = this._userCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this._cacheTtlMs) {
      if (process?.env?.WECOM_DEBUG_CACHE) log.info('[addressbook] user detail cache hit:', cacheKey);
      return cached.data;
    }
    const data = await this.get('/user/list', {
      department_id: departmentId,
      fetch_child: fetchChild ? 1 : 0
    });
    if (data && data.errcode === 0) {
      this._userCache.set(cacheKey, { timestamp: Date.now(), data });
    }
    return data;
  }

  /**
   * userid 与 openid 互换
   * @param {string} openId openid
   * @param {string} userId userid
   */
  async convertToUserId(openId, userId) {
    return this.post('/user/convert_to_userid', { openid: openId, userid: userId });
  }

  /**
   * 手机号获取 userid
   * @param {string} mobile 手机号
   */
  async getUserIdByMobile(mobile) {
    return this.post('/user/getuserid', { mobile });
  }

  /**
   * 邮箱获取 userid
   * @param {string} email 邮箱
   */
  async getUserIdByEmail(email) {
    return this.post('/user/get_userid_by_email', { email });
  }

  /**
   * 邀请成员
   * @param {string} userId 成员 userid
   */
  async inviteUser(userId) {
    return this.post('/invite/user', { userid: userId });
  }

  /**
   * 获取加入企业二维码
   * @param {number} sizeType 二维码尺寸类型
   */
  async getJoinQrCode(sizeType = 1) {
    return this.post('/invite/get_qrcode', { size_type: sizeType });
  }

  /**
   * 获取成员 ID 列表
   * @param {number} departmentId 部门 id
   */
  async getUserIdList(departmentId) {
    // v1.5.2 P0：缓存 + flushCache (事件路由: change_type=*)
    const cacheKey = `useridlist_${departmentId}`;
    const cached = this._userCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this._cacheTtlMs) {
      if (process?.env?.WECOM_DEBUG_CACHE) log.info('[addressbook] userid list cache hit:', cacheKey);
      return cached.data;
    }
    const data = await this.get('/user/list_id', { department_id: departmentId });
    if (data && data.errcode === 0) {
      this._userCache.set(cacheKey, { timestamp: Date.now(), data });
    }
    return data;
  }

  // ========== 用户ID转换 ==========

  /**
   * tmp_external_userid 的转换
   * 将外部联系人临时 ID 转换为永久 external_userid
   * v1.4.0 修复：原 /externalcontact/convert_to_external_userid 错，正确 /externalcontact/convert_to_openid
   * @param {string} tmpExternalUserId 外部联系人临时 ID
   */
  async convertTmpExternalUserId(tmpExternalUserId) {
    return this.post('/externalcontact/convert_to_openid', {
      tmp_external_userid: tmpExternalUserId
    });
  }

  // ========== 成员扩展属性 ==========

  /**
   * 获取成员扩展属性
   * @param {string} userId 成员 userid
   */
  async getUserExtAttr(userId) {
    return this.post('/user/get', { userid: userId });
  }

  /**
   * 设置成员扩展属性
   * @param {string} userId 成员 userid
   * @param {object[]} extAttr 扩展属性列表
   */
  async setUserExtAttr(userId, extAttr) {
    return this.post('/user/update', {
      userid: userId,
      extattr: extAttr
    });
  }

  // ========== 部门管理 ==========

  /**
   * 创建部门
   * @param {string} name 部门名称
   * @param {number} parentId 父部门 id
   * @param {number} order 排序
   */
  async createDepartment(name, parentId = 1, order = 0) {
    return this.post('/department/create', {
      name,
      parentid: parentId,
      order
    });
  }

  /**
   * 更新部门
   * @param {number} departmentId 部门 id
   * @param {object} params 更新参数
   */
  async updateDepartment(departmentId, { name, parentId, order }) {
    return this.post('/department/update', {
      id: departmentId,
      name,
      parentid: parentId,
      order
    });
  }

  /**
   * 删除部门
   * @param {number} departmentId 部门 id
   */
  async deleteDepartment(departmentId) {
    return this.post('/department/delete', { id: departmentId });
  }

  /**
   * 获取部门列表
   * @param {number} departmentId 部门 id，不填则获取全部
   */
  async getDepartmentList(departmentId) {
    return this.post('/department/list', { id: departmentId });
  }

  /**
   * 获取子部门 ID 列表
   * @param {number} departmentId 部门 id
   */
  async getSubDepartmentIds(departmentId) {
    return this.post('/department/list_id', { id: departmentId });
  }

  /**
   * 获取单个部门详情
   * @param {number} departmentId 部门 id
   */
  async getDepartmentDetail(departmentId) {
    // v1.5.2 P0：缓存 + flushCache (事件路由: change_type=update_party/delete_party)
    const cacheKey = `detail_${departmentId}`;
    const cached = this._deptCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this._cacheTtlMs) {
      if (process?.env?.WECOM_DEBUG_CACHE) log.info('[addressbook] dept detail cache hit:', cacheKey);
      return cached.data;
    }
    const data = await this.get('/department/get', { id: departmentId });
    if (data && data.errcode === 0) {
      this._deptCache.set(cacheKey, { timestamp: Date.now(), data });
    }
    return data;
  }

  // ========== 标签管理 ==========

  /**
   * 创建标签
   * @param {string} tagName 标签名称
   * @param {number} tagId 标签 id（可选）
   */
  async createTag(tagName, tagId) {
    return this.post('/tag/create', {
      tagname: tagName,
      tagid: tagId
    });
  }

  /**
   * 更新标签名字
   * @param {number} tagId 标签 id
   * @param {string} tagName 新标签名
   */
  async updateTag(tagId, tagName) {
    return this.post('/tag/update', {
      tagid: tagId,
      tagname: tagName
    });
  }

  /**
   * 删除标签
   * @param {number} tagId 标签 id
   */
  async deleteTag(tagId) {
    return this.post('/tag/delete', { tagid: tagId });
  }

  /**
   * 获取标签成员
   * @param {number} tagId 标签 id
   */
  async getTagUsers(tagId) {
    return this.post('/tag/get', { tagid: tagId });
  }

  /**
   * 增加标签成员
   * @param {number} tagId 标签 id
   * @param {string[]} userIds 成员 userid 列表
   * @param {number[]} departmentIds 部门 id 列表
   */
  async addTagUsers(tagId, userIds = [], departmentIds = []) {
    return this.post('/tag/addtagusers', {
      tagid: tagId,
      userlist: userIds,
      partylist: departmentIds
    });
  }

  /**
   * 删除标签成员
   * @param {number} tagId 标签 id
   * @param {string[]} userIds 成员 userid 列表
   * @param {number[]} departmentIds 部门 id 列表
   */
  async removeTagUsers(tagId, userIds = [], departmentIds = []) {
    return this.post('/tag/deltagusers', {
      tagid: tagId,
      userlist: userIds,
      partylist: departmentIds
    });
  }

  /**
   * 获取标签列表
   */
  async getTagList() {
    return this.post('/tag/list', {});
  }

  // ========== 异步导入 ==========

  /**
   * 增量更新成员
   * v1.5.0 修复：原 /user/syncuser 错，正确 /batch/syncuser
   * @param {string} mediaId 文件 id
   * @param {boolean} toInvite 是否邀请
   */
  async syncUsers(mediaId, toInvite = true) {
    return this.post('/batch/syncuser', {
      media_id: mediaId,
      to_invite: toInvite ? 1 : 0
    });
  }

  /**
   * 全量覆盖成员
   * v1.5.0 修复：原 /user/replaceuser 错，正确 /batch/replaceuser
   * @param {string} mediaId 文件 id
   * @param {boolean} toInvite 是否邀请
   */
  async replaceUsers(mediaId, toInvite = true) {
    return this.post('/batch/replaceuser', {
      media_id: mediaId,
      to_invite: toInvite ? 1 : 0
    });
  }

  /**
   * v1.5.2 coverage-enhance: 获取异步批量任务结果
   * 用于 syncUsers / replaceUsers / batchInvite / replaceDepartments 等异步操作
   * @param {string} jobId - 异步任务 ID (从异步接口返回)
   * @returns {Promise<object>} 任务结果 { status, errcode, errmsg, result }
   */
  async getBatchResult(jobId) {
    return this.post('/batch/getresult', { jobid: jobId });
  }

  /**
   * v1.5.2 coverage-enhance: 批量邀请成员 (新增成员邀请/覆盖邀请)
   * 与 inviteUser 不同, 此 API 支持上传 CSV 批量邀请
   * @param {string} mediaId - CSV 文件 media_id (经 /media/upload 上传)
   * @returns {Promise<object>} 任务结果 (jobid 用于 getBatchResult)
   */
  async batchInviteUsers(mediaId) {
    return this.post('/batch/invite', { media_id: mediaId });
  }

  /**
   * v1.5.2 coverage-enhance: openid 转 userid (批量)
   * 用于小程序/公众号场景下 openid 与企微 userid 的转换
   * @param {string[]} openids - 待转换 openid 列表 (最多 100 个)
   * @returns {Promise<object>} { userid_list: [{openid, userid}] }
   */
  async openIdToUserId(openids) {
    return this.post('/batch/openuserid', { openid_list: openids });
  }

  /**
   * v1.5.2 coverage-enhance: 全量覆盖部门 (与 replaceDepartments 互补)
   * replaceDepartments 走 /department/replaceparty (单次)
   * replaceParty 走 /batch/replaceparty (异步批量)
   * @param {string} mediaId - CSV 文件 media_id
   * @returns {Promise<object>} 任务结果 (jobid)
   */
  async batchReplaceParty(mediaId) {
    return this.post('/batch/replaceparty', { media_id: mediaId });
  }

  /**
   * 全量覆盖部门
   * @param {string} mediaId 文件 id
   */
  async replaceDepartments(mediaId) {
    return this.post('/department/replaceparty', { media_id: mediaId });
  }

  /**
   * 获取异步任务结果
   * @param {string} jobId 任务 id
   */
  async getAsyncJobResult(jobId) {
    return this.post('/getresult', { jobid: jobId });
  }

  // ========== 异步导出 ==========

  /**
   * 导出成员
   * @param {number} departmentId 部门 id
   * @param {number} departmentIds 部门 id 列表
   */
  async exportUsers(departmentId = 1, departmentIds = []) {
    return this.post('/export/simple_user', {
      department_id: departmentId,
      department_ids: departmentIds
    });
  }

  /**
   * 导出成员详情
   * @param {number} departmentId 部门 id
   */
  async exportUsersDetail(departmentId = 1) {
    return this.post('/export/user', { department_id: departmentId });
  }

  /**
   * 导出部门
   */
  async exportDepartments() {
    return this.post('/export/party', {});
  }

  /**
   * 导出标签成员
   * @param {number} tagId 标签 id
   */
  async exportTagUsers(tagId) {
    return this.post('/export/tag_users', { tagid: tagId });
  }

  /**
   * 获取导出结果
   * @param {string} jobId 任务 id
   */
  async getExportResult(jobId) {
    return this.post('/export/getresult', { jobid: jobId });
  }
}

module.exports = AddressBook;
