/**
 * 通讯录缓存模块
 * 
 * 功能：
 * 1. 本地缓存部门树和员工列表
 * 2. 事件驱动的自动更新
 * 3. 快速查询接口
 * 
 * 数据文件：data/addressbook_cache.json
 * 
 * 首次使用会检查是否需要同步，用户确认后才同步
 */

const fs = require('fs');
const path = require('path');

class AddressBookCache {
  constructor(config, options = {}) {
    this.config = config;
    this.cachePath = path.join(process.cwd(), 'data', 'addressbook_cache.json');
    this.cache = this._loadCache();
    this.syncConfirmed = false;  // 是否已确认同步
    this.onConfirmCallback = options.onConfirm;  // 确认回调
  }

  /**
   * 检查是否需要同步
   * @returns {boolean}
   */
  needsSync() {
    // 没有缓存数据，需要同步
    if (!this.cache.updatedAt) {
      return true;
    }
    // 缓存超过7天，建议重新同步
    const cacheDate = new Date(this.cache.updatedAt);
    const now = new Date();
    const daysDiff = (now - cacheDate) / (1000 * 60 * 60 * 24);
    return daysDiff > 7;
  }

  /**
   * 获取同步状态信息
   */
  getSyncStatus() {
    return {
      needsSync: this.needsSync(),
      lastSyncTime: this.cache.updatedAt,
      departmentCount: this.cache.departments?.length || 0,
      userCount: this.cache.users?.length || 0
    };
  }

  /**
   * 请求同步（首次或用户主动触发）
   * @returns {object} 状态信息
   */
  requestSync() {
    const status = this.getSyncStatus();
    
    if (!status.needsSync && this.syncConfirmed) {
      return {
        needConfirm: false,
        alreadySynced: true,
        status: status
      };
    }
    
    return {
      needConfirm: true,
      confirmed: this.syncConfirmed,
      status: status,
      message: status.lastSyncTime 
        ? `通讯录缓存已过期（上一次同步：${status.lastSyncTime}），是否重新同步？`
        : '通讯录缓存尚未初始化，是否立即同步？'
    };
  }

  /**
   * 确认同步
   */
  confirmSync() {
    this.syncConfirmed = true;
    if (this.onConfirmCallback) {
      this.onConfirmCallback();
    }
  }

  /**
   * 跳过同步
   */
  skipSync() {
    this.syncConfirmed = false;
  }

  /**
   * 加载本地缓存
   */
  _loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
        console.log('[AddressBookCache] 已加载本地缓存');
        return data;
      }
    } catch (e) {
      console.log('[AddressBookCache] 加载缓存失败:', e.message);
    }
    return this._createEmptyCache();
  }

  /**
   * 创建空缓存结构
   */
  _createEmptyCache() {
    return {
      updatedAt: null,
      departments: [],
      users: [],
      userMap: {},  // userId -> user
      departmentMap: {}  // deptId -> department
    };
  }

  /**
   * 保存缓存到文件
   */
  _saveCache() {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.cache.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
      console.log('[AddressBookCache] 缓存已保存');
    } catch (e) {
      console.log('[AddressBookCache] 保存缓存失败:', e.message);
    }
  }

  /**
   * 初始化/更新完整通讯录
   * 
   * ⚠️ 注意：只需获取根部门（id=1）并设置 fetch_child=true
   * 因为它会递归获取所有子部门成员，避免重复获取
   */
  async syncFromAPI(addressbook) {
    console.log('[AddressBookCache] 从 API 同步通讯录...');
    
    try {
      // 获取部门列表
      const deptResult = await addressbook.getDepartmentList();
      this.cache.departments = deptResult.department || [];
      
      // 构建部门 map
      this.cache.departmentMap = {};
      for (const dept of this.cache.departments) {
        this.cache.departmentMap[dept.id] = dept;
      }
      
      // 获取所有员工（只需获取根部门，fetch_child=true 会递归获取子部门）
      this.cache.users = [];
      this.cache.userMap = {};
      
      try {
        // 只获取根部门，fetch_child=true 会递归获取所有子部门成员
        const users = await addressbook.getDepartmentUsers(1, true);
        if (users.userlist) {
          for (const user of users.userlist) {
            // 根据用户所在的部门设置信息
            const dept = this.cache.departmentMap[user.department?.[0] || 1];
            user.departmentId = user.department?.[0] || 1;
            user.departmentName = dept?.name || '未知部门';
            
            // 使用 userId 去重
            if (!this.cache.userMap[user.userid]) {
              this.cache.users.push(user);
              this.cache.userMap[user.userid] = user;
            }
          }
        }
        console.log(`[AddressBookCache] 获取成员成功: ${users.userlist?.length || 0} 人`);
      } catch (e) {
        console.log('[AddressBookCache] 获取成员失败:', e.message);
      }
      
      this._saveCache();
      console.log(`[AddressBookCache] 同步完成: ${this.cache.departments.length} 部门, ${this.cache.users.length} 员工`);
      
    } catch (e) {
      console.log('[AddressBookCache] 同步失败:', e.message);
    }
  }

  // ========== 事件驱动的更新 ==========

  /**
   * 处理成员新增事件
   */
  onUserAdd(user) {
    console.log('[AddressBookCache] 成员新增:', user.name || user.userid);
    
    // 检查是否已存在
    if (!this.cache.userMap[user.userid]) {
      this.cache.users.push(user);
      this.cache.userMap[user.userid] = user;
      this._saveCache();
    }
  }

  /**
   * 处理成员删除事件
   */
  onUserDelete(userId) {
    console.log('[AddressBookCache] 成员删除:', userId);
    
    if (this.cache.userMap[userId]) {
      const user = this.cache.userMap[userId];
      this.cache.users = this.cache.users.filter(u => u.userid !== userId);
      delete this.cache.userMap[userId];
      this._saveCache();
      return user;
    }
    return null;
  }

  /**
   * 处理成员更新事件
   */
  onUserUpdate(user) {
    console.log('[AddressBookCache] 成员更新:', user.userid);
    
    if (this.cache.userMap[user.userid]) {
      Object.assign(this.cache.userMap[user.userid], user);
      const index = this.cache.users.findIndex(u => u.userid === user.userid);
      if (index >= 0) {
        Object.assign(this.cache.users[index], user);
      }
      this._saveCache();
    }
  }

  /**
   * 处理部门新增事件
   */
  onDepartmentAdd(dept) {
    console.log('[AddressBookCache] 部门新增:', dept.name);
    
    if (!this.cache.departmentMap[dept.id]) {
      this.cache.departments.push(dept);
      this.cache.departmentMap[dept.id] = dept;
      this._saveCache();
    }
  }

  /**
   * 处理部门删除事件
   */
  onDepartmentDelete(deptId) {
    console.log('[AddressBookCache] 部门删除:', deptId);
    
    if (this.cache.departmentMap[deptId]) {
      this.cache.departments = this.cache.departments.filter(d => d.id !== deptId);
      delete this.cache.departmentMap[deptId];
      this._saveCache();
    }
  }

  /**
   * 处理部门更新事件
   */
  onDepartmentUpdate(dept) {
    console.log('[AddressBookCache] 部门更新:', dept.id);
    
    if (this.cache.departmentMap[dept.id]) {
      Object.assign(this.cache.departmentMap[dept.id], dept);
      const index = this.cache.departments.findIndex(d => d.id === dept.id);
      if (index >= 0) {
        Object.assign(this.cache.departments[index], dept);
      }
      this._saveCache();
    }
  }

  // ========== 查询接口 ==========

  /**
   * 获取所有部门
   */
  getDepartments() {
    return this.cache.departments;
  }

  /**
   * 获取所有员工
   */
  getUsers() {
    return this.cache.users;
  }

  /**
   * 根据 ID 获取员工
   */
  getUser(userId) {
    return this.cache.userMap[userId];
  }

  /**
   * 根据部门 ID 获取员工
   */
  getUsersByDepartment(deptId) {
    return this.cache.users.filter(u => u.departmentId === deptId);
  }

  /**
   * 根据部门 ID 获取子部门（包括自己）
   */
  getSubDepartments(deptId) {
    const result = [];
    const addDeptAndChildren = (id) => {
      result.push(this.cache.departmentMap[id]);
      for (const dept of this.cache.departments) {
        if (dept.parentid === id) {
          addDeptAndChildren(dept.id);
        }
      }
    };
    addDeptAndChildren(deptId);
    return result;
  }

  /**
   * 获取部门树
   */
  getDepartmentTree() {
    const buildTree = (parentId) => {
      return this.cache.departments
        .filter(d => d.parentid === parentId)
        .map(d => ({
          ...d,
          children: buildTree(d.id)
        }));
    };
    return buildTree(0);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      updatedAt: this.cache.updatedAt,
      departmentCount: this.cache.departments.length,
      userCount: this.cache.users.length,
      usersByDepartment: this.cache.departments.map(d => ({
        id: d.id,
        name: d.name,
        userCount: this.getUsersByDepartment(d.id).length
      }))
    };
  }
}

module.exports = AddressBookCache;
