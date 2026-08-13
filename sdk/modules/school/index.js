/**
 * 家校消息模块
 * API 章节：八 - 家校消息
 * 包含：学校通知
 */

const WeComSDK = require('../../sdk');

class School extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 学校通知 ==========

  /**
   * 发送学校通知
   * @param {string} userId 老师 ID
   * @param {string} studentUserId 学生 userid（家校通知时必填）
   * @param {object} content 通知内容
   */
  async sendSchoolNotice(userId, studentUserId, content) {
    const { title, content: text, mediaId, msgType = 'text' } = content;
    
    const params = {
      userid: userId,
      msgtype: msgType
    };

    // 如果是家校通知，需要传入学生信息
    if (studentUserId) {
      params.student_userid = studentUserId;
    }

    switch (msgType) {
      case 'text':
        params.text = { content: text };
        break;
      case 'image':
        params.image = { media_id: mediaId };
        break;
      case 'voice':
        params.voice = { media_id: mediaId };
        break;
      case 'video':
        params.video = { media_id: mediaId };
        break;
      case 'file':
        params.file = { media_id: mediaId };
        break;
      case 'news':
        params.news = { articles: content.articles };
        break;
      case 'mpnews':
        params.mpnews = { articles: content.articles };
        break;
    }

    return this.post('/school/send_notice', params);
  }

  /**
   * 获取学校通知发送结果
   * @param {string} msgId 消息 ID
   */
  async getSchoolNoticeResult(msgId) {
    return this.post('/school/get_notice_result', { msg_id: msgId });
  }

  /**
   * 撤回学校通知
   * @param {string} msgId 消息 ID
   */
  async recallSchoolNotice(msgId) {
    return this.post('/school/recall_notice', { msg_id: msgId });
  }

  // ========== 家校通讯录 ==========

  /**
   * 获取班级列表
   * @param {string} schoolId 学校 ID
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getClassList(schoolId, offset = 0, size = 100) {
    return this.post('/school/get_class_list', {
      schoolid: schoolId,
      offset,
      limit: size
    });
  }

  /**
   * 获取学生列表
   * @param {string} classId 班级 ID
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getStudentList(classId, offset = 0, size = 100) {
    return this.post('/school/get_student_list', {
      classid: classId,
      offset,
      limit: size
    });
  }

  /**
   * 获取家长列表
   * @param {string} studentUserId 学生 userid
   */
  async getParentList(studentUserId) {
    return this.post('/school/get_parent_list', { student_userid: studentUserId });
  }

  /**
   * 获取老师列表
   * @param {string} schoolId 学校 ID
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getTeacherList(schoolId, offset = 0, size = 100) {
    return this.post('/school/get_teacher_list', {
      schoolid: schoolId,
      offset,
      limit: size
    });
  }

  // ========== 健康上报 ==========

  /**
   * 创建健康上报任务
   * @param {string} schoolId 学校 ID
   * @param {string} classId 班级 ID
   * @param {object} task 上报任务配置
   */
  async createHealthReportTask(schoolId, classId, task) {
    return this.post('/school/add_health_report_task', {
      schoolid: schoolId,
      classid: classId,
      ...task
    });
  }

  /**
   * 获取健康上报统计
   * @param {string} taskId 任务 ID
   */
  async getHealthReportStat(taskId) {
    return this.post('/school/get_health_report_stat', { task_id: taskId });
  }

  /**
   * 获取健康上报详情
   * @param {string} taskId 任务 ID
   * @param {string} studentUserId 学生 userid
   */
  async getHealthReportDetail(taskId, studentUserId) {
    return this.post('/school/get_health_report_detail', {
      task_id: taskId,
      student_userid: studentUserId
    });
  }

  // ========== 成绩管理 ==========

  /**
   * 发布成绩
   * @param {string} schoolId 学校 ID
   * @param {string} studentUserId 学生 userid
   * @param {object} score 成绩信息
   */
  async publishScore(schoolId, studentUserId, score) {
    return this.post('/school/publish_score', {
      schoolid: schoolId,
      student_userid: studentUserId,
      ...score
    });
  }

  /**
   * 获取成绩列表
   * @param {string} schoolId 学校 ID
   * @param {string} studentUserId 学生 userid
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getScoreList(schoolId, studentUserId, offset = 0, size = 100) {
    return this.post('/school/get_score_list', {
      schoolid: schoolId,
      student_userid: studentUserId,
      offset,
      limit: size
    });
  }

  // ========== v1.5.2 coverage-enhance: school 域补充端点 ==========

  /**
   * 创建学校部门 (院系/班级)
   * @param {string} schoolId 学校 ID
   * @param {object} department { name, parentid?, type? }
   * @returns {Promise<object>} { errcode, errmsg, department_id }
   */
  async createSchoolDepartment(schoolId, department) {
    return this.post('/school/department/create', { schoolid: schoolId, ...department });
  }

  /**
   * 删除学校部门
   * @param {string} schoolId 学校 ID
   * @param {string} departmentId 部门 ID
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async deleteSchoolDepartment(schoolId, departmentId) {
    return this.post('/school/department/delete', {
      schoolid: schoolId,
      department_id: departmentId
    });
  }

  /**
   * 更新学校部门
   * @param {string} schoolId 学校 ID
   * @param {string} departmentId 部门 ID
   * @param {object} department { name?, parentid? }
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async updateSchoolDepartment(schoolId, departmentId, department) {
    return this.post('/school/department/update', {
      schoolid: schoolId,
      department_id: departmentId,
      ...department
    });
  }

  /**
   * 获取家长/学生/教师身份信息 (教培机构查询家长绑定关系)
   * @param {string[]} userIds userid 列表
   * @returns {Promise<object>} { errcode, errmsg, user_info_list }
   */
  async getSchoolUserInfo(userIds) {
    return this.post('/school/getuserinfo', { userid_list: userIds });
  }

  /**
   * 配置学校应用参数
   * @param {object} params { schoolid, allow_teacher_to_modify?, etc }
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async setSchoolConfig(params) {
    return this.post('/school/set', params);
  }

  /**
   * 批量导入学校成员 (教培机构批量加学生/教师/家长)
   * @param {string} schoolId 学校 ID
   * @param {string} type member/student/teacher/parent
   * @param {string[]} userIds userid 列表
   * @returns {Promise<object>} { errcode, errmsg, invalid_list }
   */
  async batchSchoolUser(schoolId, type, userIds) {
    return this.post('/school/user/batch', {
      schoolid: schoolId,
      type,
      userid_list: userIds
    });
  }

  /**
   * 新增学校成员
   * @param {string} schoolId 学校 ID
   * @param {string} type member/student/teacher/parent
   * @param {string} userId userid
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async createSchoolUser(schoolId, type, userId) {
    return this.post('/school/user/create', {
      schoolid: schoolId,
      type,
      userid: userId
    });
  }

  /**
   * 删除学校成员
   * @param {string} schoolId 学校 ID
   * @param {string} type member/student/teacher/parent
   * @param {string} userId userid
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async deleteSchoolUser(schoolId, type, userId) {
    return this.post('/school/user/delete', {
      schoolid: schoolId,
      type,
      userid: userId
    });
  }

  /**
   * 更新学校成员信息
   * @param {string} schoolId 学校 ID
   * @param {string} type member/student/teacher/parent
   * @param {string} userId userid
   * @param {object} data 更新的字段
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async updateSchoolUser(schoolId, type, userId, data) {
    return this.post('/school/user/update', {
      schoolid: schoolId,
      type,
      userid: userId,
      ...data
    });
  }

}

module.exports = School;
