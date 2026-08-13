/**
 * 消息推送模块
 * API 章节：十三 - 消息推送（企业群发）
 * 包含：企业群发、欢迎语、提醒成员等
 */

const WeComSDK = require('../../sdk');

class Messenger extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 企业群发 ==========

  /**
   * 创建企业群发
   * @param {string} userId 成员 ID
   * @param {object} content 消息内容
   * @param {string} chatId 群聊 ID（可选）
   */
  async createMassMessage(userId, content, chatId = '') {
    const { text, image, video, file, link, miniprogram, msgType } = content;
    
    const params = {
      userid: userId,
      msgtype: msgType || 'text'
    };

    if (chatId) params.chatid = chatId;
    
    switch (params.msgtype) {
      case 'text':
        params.text = { content: text };
        break;
      case 'image':
        params.image = { media_id: image };
        break;
      case 'video':
        params.video = { media_id: video };
        break;
      case 'file':
        params.file = { media_id: file };
        break;
      case 'link':
        params.link = link;
        break;
      case 'miniprogram':
        params.miniprogram = miniprogram;
        break;
    }

    return this.post('/externalcontact/add_msg_template', params);
  }

  /**
   * 获取企业的全部群发记录
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {string} userId 成员 ID（可选）
   * @param {number} cursor 分页游标
   * @param {number} size 每页数量
   */
  async getMassMessageList(startTime, endTime, chatType = 'single', creator = '', filterType = 0, cursor = '', limit = 100) {
    // v1.5.2 修复：原 /externalcontact/get_groupmsg_list_v 404，正确 /externalcontact/get
    // 文档必填 chat_type（single=发给客户, group=发给客户群）
    return this.post('/externalcontact/get', {
      chat_type: chatType,
      start_time: startTime,
      end_time: endTime,
      creator,
      filter_type: filterType,
      cursor,
      limit: Math.min(limit, 100)
    });
  }

  /**
   * 获取群发消息发送结果
   * v1.4.0 修复：原 /externalcontact/get_moment_task_result 错，正确 /externalcontact/get_groupmsg_send_result
   * @param {string} msgId 消息 ID
   */
  async getMassMessageResult(msgId) {
    return this.post('/externalcontact/get_groupmsg_send_result', {
      msg_id: msgId
    });
  }

  /**
   * 停止企业群发
   * @param {string} msgId 消息 ID
   */
  async cancelMassMessage(msgId) {
    // v1.4.0 修复：原 /externalcontact/cancel_moment_task 错，正确 /externalcontact/cancel_groupmsg_send
    return this.post('/externalcontact/cancel_groupmsg_send', {
      msg_id: msgId
    });
  }

  // ========== 提醒成员群发 ==========

  /**
   * 提醒成员群发
   * @param {string} userId 成员 ID
   * @param {string} msgId 消息 ID
   */
  async remindMassMessage(userId, msgId) {
    // v1.4.0 修复：原 /externalcontact/remind_moment_task 错，正确 /externalcontact/remind_groupmsg_send
    return this.post('/externalcontact/remind_groupmsg_send', {
      userid: userId,
      msg_id: msgId
    });
  }

  // ========== 欢迎语管理 ==========

  /**
   * 发送新客户欢迎语
   * v1.5.2 修复：传 userid+external_userid 全错！文档要求传 welcome_code
   * welcome_code 通过"添加外部联系人事件"推送（20秒有效）
   * @param {string} welcomeCode 企业接收到的事件中带的 welcome_code
   * @param {object} content 欢迎语内容
   */
  async sendWelcomeMessage(welcomeCode, content) {
    if (!welcomeCode) {
      throw new Error('welcomeCode is required (通过"添加外部联系人"事件获取，20秒有效)');
    }
    const { text, image, video, file, link, miniprogram, msgType } = content;
    const params = {
      welcome_code: welcomeCode,
      msgtype: msgType || 'text',
    };

    switch (params.msgtype) {
      case 'text':
        params.text = { content: text };
        break;
      case 'image':
        params.image = { media_id: image };
        break;
      case 'video':
        params.video = { media_id: video };
        break;
      case 'file':
        params.file = { media_id: file };
        break;
      case 'link':
        params.link = link;
        break;
      case 'miniprogram':
        params.miniprogram = miniprogram;
        break;
    }

    return this.post('/externalcontact/send_welcome_msg', params);
  }

  /**
   * 获取欢迎语素材列表
   * ⚠️ v1.4.0 暂禁：官方文档无 /externalcontact/get_welcome_media 端点
   * 调用方请用 getGroupWelcomeMedia
   */
  async getWelcomeMediaList() {
    throw new Error('getWelcomeMediaList 已废弃：官方文档无此端点（v1.4.0），请用 getGroupWelcomeMedia');
    // return this.post('/externalcontact/group_welcome_template/get', {});
  }

  /**
   * 添加入群欢迎语素材
   * @param {string} filePath 文件路径
   * @param {string} type 素材类型
   */
  async uploadWelcomeMedia(filePath, type = 'image') {
    return this.uploadFile(filePath, 'media', { type });
  }

  // ========== 入群欢迎语素材管理 ==========

  /**
   * 获取入群欢迎语素材
   * @param {string} sceneId 场景 ID
   */
  async getGroupWelcomeMedia(sceneId) {
    // v1.4.0 修复：原 /externalcontact/get_group_welcome_media 错，正确 /externalcontact/group_welcome_template/get
    return this.post('/externalcontact/group_welcome_template/get', {
      scene_id: sceneId
    });
  }

  /**
   * 配置入群欢迎语素材
   * v1.4.0 修复：原 /externalcontact/set_group_welcome_media 错，正确 /externalcontact/group_welcome_template/add
   * @param {object} params 欢迎语参数
   */
  async setGroupWelcomeMedia(params) {
    return this.post('/externalcontact/group_welcome_template/add', params);
  }

  /**
   * 删除入群欢迎语素材
   * v1.4.0 修复：原 /externalcontact/del_group_welcome_media 错，正确 /externalcontact/group_welcome_template/del
   * @param {string} sceneId 场景 ID
   */
  async deleteGroupWelcomeMedia(sceneId) {
    return this.post('/externalcontact/group_welcome_template/del', {
      scene_id: sceneId
    });
  }

  // ========== 消息存档 ==========

  /**
   * 获取群发消息发送成员列表
   * v1.4.0 修复：原 /externalcontact/get_moment_task_detail 错，正确 /externalcontact/get_groupmsg_task
   * @param {string} msgId 消息 ID
   */
  async getMassMessageUsers(msgId) {
    return this.post('/externalcontact/get_groupmsg_task', {
      msg_id: msgId
    });
  }
}

module.exports = Messenger;
