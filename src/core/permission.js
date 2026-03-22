/**
 * 权限控制核心模块
 * 
 * 权限来源优先级：
 * 1. 自定义映射表（roleMapping）
 * 2. 企微部门负责人字段
 * 3. 默认规则（admin > manager > staff）
 */

const ROLE = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff'
};

// 角色等级（数值越大权限越高）
const ROLE_LEVEL = {
  [ROLE.STAFF]: 1,
  [ROLE.MANAGER]: 2,
  [ROLE.ADMIN]: 3
};

// 模块权限矩阵
// format: module.action = [allowed roles]
const PERMISSION_MATRIX = {
  // 通讯录
  addressbook: {
    getDepartmentList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getDepartmentDetail: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getDepartmentUsers: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getUser: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getTagList: [ROLE.ADMIN, ROLE.MANAGER],
    createUser: [ROLE.ADMIN],
    updateUser: [ROLE.ADMIN],
    deleteUser: [ROLE.ADMIN],
    batchDeleteUser: [ROLE.ADMIN],
    importUsers: [ROLE.ADMIN],
    exportUsers: [ROLE.ADMIN],
    convertToUserId: [ROLE.ADMIN, ROLE.MANAGER],
    getUserIdByName: [ROLE.ADMIN, ROLE.MANAGER]
  },

  // 审批
  approval: {
    getApprovalDetail: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getApprovalList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getApprovalTemplate: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getSelfApprovalList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    submitApproval: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    cancelApproval: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    approveApproval: [ROLE.ADMIN, ROLE.MANAGER],
    getHolidayBalance: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF]
  },

  // 客户联系
  contact: {
    getClientList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getClientDetail: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getClientTags: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getGroupList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getGroupMemberList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getUnassignedList: [ROLE.ADMIN, ROLE.MANAGER],
    transferClient: [ROLE.ADMIN, ROLE.MANAGER],
    getContactStats: [ROLE.ADMIN, ROLE.MANAGER]
  },

  // 考勤
  checkin: {
    getCheckinData: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getCheckinSummary: [ROLE.ADMIN, ROLE.MANAGER],
    getCheckinMonthReport: [ROLE.ADMIN, ROLE.MANAGER],
    getScheduleList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getExceptionList: [ROLE.ADMIN, ROLE.MANAGER]
  },

  // 消息推送
  message: {
    sendMessage: [ROLE.ADMIN, ROLE.MANAGER],
    sendTextMessage: [ROLE.ADMIN, ROLE.MANAGER],
    sendImageMessage: [ROLE.ADMIN, ROLE.MANAGER],
    sendFileMessage: [ROLE.ADMIN, ROLE.MANAGER],
    sendMpNewsMessage: [ROLE.ADMIN, ROLE.MANAGER],
    sendChatMessage: [ROLE.ADMIN, ROLE.MANAGER],
    getChatList: [ROLE.ADMIN, ROLE.MANAGER],
    getChatDetail: [ROLE.ADMIN, ROLE.MANAGER]
  },

  // 应用管理
  app: {
    getAppInfo: [ROLE.ADMIN],
    setAppInfo: [ROLE.ADMIN],
    getMenu: [ROLE.ADMIN, ROLE.MANAGER],
    createMenu: [ROLE.ADMIN],
    deleteMenu: [ROLE.ADMIN]
  },

  // 素材管理
  media: {
    uploadMedia: [ROLE.ADMIN, ROLE.MANAGER],
    getMedia: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getMediaList: [ROLE.ADMIN, ROLE.MANAGER],
    deleteMedia: [ROLE.ADMIN]
  },

  // 会议
  meeting: {
    getMeetingList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getMeetingDetail: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    scheduleMeeting: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    cancelMeeting: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getMeetingParticipants: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF]
  },

  // 日程
  schedule: {
    getScheduleList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getScheduleDetail: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    createSchedule: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    updateSchedule: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    deleteSchedule: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF]
  },

  // 文档
  document: {
    getDocumentList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getDocumentDetail: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    createDocument: [ROLE.ADMIN, ROLE.MANAGER],
    updateDocument: [ROLE.ADMIN, ROLE.MANAGER],
    deleteDocument: [ROLE.ADMIN]
  },

  // 微盘
  disk: {
    getFileList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getFileDetail: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    uploadFile: [ROLE.ADMIN, ROLE.MANAGER],
    downloadFile: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    deleteFile: [ROLE.ADMIN, ROLE.MANAGER]
  },

  // 客服
  custom: {
    getAccountList: [ROLE.ADMIN],
    getSessionList: [ROLE.ADMIN, ROLE.MANAGER],
    getSessionDetail: [ROLE.ADMIN, ROLE.MANAGER],
    getMessageList: [ROLE.ADMIN, ROLE.MANAGER],
    sendMessage: [ROLE.ADMIN, ROLE.MANAGER]
  },

  // 直播
  live: {
    getLivingList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getLivingDetail: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getLivingStat: [ROLE.ADMIN, ROLE.MANAGER]
  },

  // 智能会话
  intelligence: {
    getRecordList: [ROLE.ADMIN, ROLE.MANAGER],
    getRecordDetail: [ROLE.ADMIN, ROLE.MANAGER],
    getChatData: [ROLE.ADMIN]
  },

  // 通讯录同步
  addressbook_cache: {
    syncDepartmentTree: [ROLE.ADMIN],
    syncUserList: [ROLE.ADMIN],
    getDepartmentTree: [ROLE.ADMIN, ROLE.MANAGER],
    searchUser: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF]
  },

  // 客户统计
  contactstats: {
    getUserStats: [ROLE.ADMIN, ROLE.MANAGER],
    getDepartmentStats: [ROLE.ADMIN, ROLE.MANAGER],
    getTrendStats: [ROLE.ADMIN, ROLE.MANAGER]
  },

  // 安全相关
  security: {
    getLoginDeviceList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getOperationLog: [ROLE.ADMIN],
    getMessageRemindConfig: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF]
  },

  // 人事
  hr: {
    getStaffDetail: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getStaffList: [ROLE.ADMIN, ROLE.MANAGER]
  },

  // 会议室
  room: {
    getRoomList: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    getRoomDetail: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    bookRoom: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF],
    cancelRoom: [ROLE.ADMIN, ROLE.MANAGER, ROLE.STAFF]
  },

  // 回调
  callback: {
    getEventHistory: [ROLE.ADMIN],
    getEventById: [ROLE.ADMIN],
    exportEventHistory: [ROLE.ADMIN],
    clearEventHistory: [ROLE.ADMIN]
  }
};

class Permission {
  constructor(config, addressbookModule) {
    // 权限映射配置
    this.roleMapping = config.roleMapping || {};
    // 企微部门树模块（用于获取部门负责人）
    this.addressbook = addressbookModule;
    // 缓存
    this._userRoleCache = new Map();
    this._departmentHeadCache = new Map();
  }

  /**
   * 获取用户的角色
   * @param {string} userId 用户ID
   * @returns {Promise<string>} 角色
   */
  async getUserRole(userId) {
    // 先检查缓存
    if (this._userRoleCache.has(userId)) {
      return this._userRoleCache.get(userId);
    }

    let role = null;

    // 1. 先查自定义映射表
    role = await this._getRoleFromMapping(userId);
    if (role) {
      this._userRoleCache.set(userId, role);
      return role;
    }

    // 2. 查企微部门负责人
    role = await this._getRoleFromDepartmentHead(userId);
    if (role) {
      this._userRoleCache.set(userId, role);
      return role;
    }

    // 3. 默认 staff
    role = ROLE.STAFF;
    this._userRoleCache.set(userId, role);
    return role;
  }

  /**
   * 从自定义映射表获取角色
   */
  async _getRoleFromMapping(userId) {
    const mapping = this.roleMapping;

    // 检查 admin
    if (mapping.admin?.users?.includes(userId)) {
      return ROLE.ADMIN;
    }

    // 检查 manager
    if (mapping.manager?.users?.includes(userId)) {
      return ROLE.MANAGER;
    }

    // 检查 staff
    if (mapping.staff?.users?.includes(userId)) {
      return ROLE.STAFF;
    }

    return null;
  }

  /**
   * 从企微部门负责人获取角色
   */
  async _getRoleFromDepartmentHead(userId) {
    if (!this.addressbook) return null;

    try {
      // 获取用户的部门信息
      const userInfo = await this.addressbook.getUser(userId);
      if (!userInfo || !userInfo.department) return null;

      const departments = Array.isArray(userInfo.department) 
        ? userInfo.department 
        : [userInfo.department];

      // 检查是否为某些部门的负责人
      for (const deptId of departments) {
        if (this._departmentHeadCache.has(deptId)) {
          const headUserId = this._departmentHeadCache.get(deptId);
          if (headUserId === userId) {
            return ROLE.MANAGER;
          }
        }
      }

      // 从企微获取部门负责人
      for (const deptId of departments) {
        try {
          const deptDetail = await this.addressbook.getDepartmentDetail(deptId);
          if (deptDetail && deptDetail.department_chairman_userid === userId) {
            this._departmentHeadCache.set(deptId, userId);
            return ROLE.MANAGER;
          }
        } catch (e) {
          // 忽略单个部门的错误
        }
      }
    } catch (e) {
      // 忽略错误
    }

    return null;
  }

  /**
   * 检查用户是否有权限
   * @param {string} userId 用户ID
   * @param {string} module 模块名
   * @param {string} action 操作名
   * @returns {Promise<boolean>}
   */
  async checkPermission(userId, module, action) {
    // 管理员拥有所有权限
    const userRole = await this.getUserRole(userId);
    if (userRole === ROLE.ADMIN) return true;

    // 查找权限矩阵
    const modulePerm = PERMISSION_MATRIX[module];
    if (!modulePerm) {
      // 模块未定义权限矩阵，默认允许
      return true;
    }

    const allowedRoles = modulePerm[action];
    if (!allowedRoles) {
      // 操作未定义，默认允许
      return true;
    }

    return allowedRoles.includes(userRole);
  }

  /**
   * 检查权限并抛出异常
   * @param {string} userId 用户ID
   * @param {string} module 模块名
   * @param {string} action 操作名
   */
  async requirePermission(userId, module, action) {
    const hasPermission = await this.checkPermission(userId, module, action);
    if (!hasPermission) {
      const error = new Error(`无权限: ${module}.${action}`);
      error.code = 'PERMISSION_DENIED';
      error.details = { userId, module, action };
      throw error;
    }
  }

  /**
   * 获取用户在某个模块的数据权限范围
   * @param {string} userId 用户ID
   * @param {string} module 模块名
   * @returns {Promise<Object>} 数据权限范围
   */
  async getDataScope(userId, module) {
    const userRole = await this.getUserRole(userId);

    switch (userRole) {
      case ROLE.ADMIN:
        // 管理员可访问所有数据
        return { scope: 'all', departmentIds: null };

      case ROLE.MANAGER:
        // 经理获取管辖部门
        const depts = await this._getManagerDepartments(userId);
        return { scope: 'department', departmentIds: depts };

      case ROLE.STAFF:
      default:
        // 员工只能看自己的数据
        return { scope: 'self', userId };
    }
  }

  /**
   * 获取经理管辖的部门列表
   */
  async _getManagerDepartments(userId) {
    const mapping = this.roleMapping;
    
    // 优先用映射表
    if (mapping.manager?.departments?.length > 0) {
      return mapping.manager.departments;
    }

    // 从企微获取
    if (!this.addressbook) return [];

    try {
      const userInfo = await this.addressbook.getUser(userId);
      if (!userInfo || !userInfo.department) return [];
      return Array.isArray(userInfo.department) 
        ? userInfo.department 
        : [userInfo.department];
    } catch (e) {
      return [];
    }
  }

  /**
   * 过滤数据（根据权限范围）
   * @param {Array} data 数据列表
   * @param {string} userId 用户ID
   * @param {string} dataField 数据中用于判断的字段名
   * @returns {Promise<Array>} 过滤后的数据
   */
  async filterData(data, userId, dataField = 'userId') {
    const scope = await this.getDataScope(userId);
    
    if (scope.scope === 'all') {
      return data;
    }

    if (scope.scope === 'self') {
      return data.filter(item => item[dataField] === scope.userId);
    }

    if (scope.scope === 'department') {
      // 如果数据包含 department 字段，过滤
      if (data.length > 0 && data[0].department !== undefined) {
        return data.filter(item => 
          scope.departmentIds.includes(item.department)
        );
      }
    }

    return data;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this._userRoleCache.clear();
    this._departmentHeadCache.clear();
  }

  /**
   * 获取权限矩阵
   */
  getPermissionMatrix() {
    return PERMISSION_MATRIX;
  }

  /**
   * 获取角色定义
   */
  static getRoles() {
    return ROLE;
  }

  /**
   * 获取角色等级
   */
  static getRoleLevel() {
    return ROLE_LEVEL;
  }
}

module.exports = Permission;
module.exports.ROLE = ROLE;
module.exports.ROLE_LEVEL = ROLE_LEVEL;
module.exports.PERMISSION_MATRIX = PERMISSION_MATRIX;
