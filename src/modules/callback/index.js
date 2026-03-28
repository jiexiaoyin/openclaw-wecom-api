/**
 * 回调处理模块
 * 企业微信回调消息处理框架
 *
 * 功能:
 * 1. 统一回调入口 - 处理所有企业微信回调事件
 * 2. 事件记录 - 自动记录所有回调事件
 * 3. 事件分发 - 根据事件类型自动调用对应处理器
 * 4. 响应生成 - 自动生成响应消息
 *
 * 使用方式:
 * const callback = new Callback(config);
 * callback.on('change_contact', async (event) => { ... });
 * callback.handle(req, res);
 */

const crypto = require('crypto');
const xml2js = require('xml2js');
const EventEmitter = require('events');
const { verifyWecomSignature, decryptWecomEncrypted, encryptWecomPlaintext } = require('../../crypto');
const Approval = require('../approval');

class Callback extends EventEmitter {
  constructor(config) {
    super();
    this.token = config.token || '';
    this.encodingAESKey = config.encodingAESKey || '';
    this.corpId = config.corpId || '';
    this.agentId = config.agentId || '';

    // 事件记录存储
    this.eventHistory = [];
    this.maxHistorySize = config.maxHistorySize || 1000;

    // 事件处理器映射
    this.handlers = {};

    // 审批模块(用于获取审批详情)
    this.approval = new Approval(config);

    // 初始化默认处理器
    this._initDefaultHandlers();

    // 加载已有事件历史
    this.loadEventHistory();
  }

  // ========== 初始化默认处理器 ==========

  _initDefaultHandlers() {
    // 通讯录事件
    this.handlers['change_contact'] = 'handleContactChange';
    this.handlers['change_external_contact'] = 'handleExternalContactChange';

    // 客户联系事件
    this.handlers['add_external_contact'] = 'handleAddExternalContact';
    this.handlers['del_external_contact'] = 'handleDelExternalContact';
    this.handlers['edit_external_contact'] = 'handleEditExternalContact';
    this.handlers['add_half_external_contact'] = 'handleAddHalfExternalContact';
    this.handlers['del_follow_user'] = 'handleDelFollowUser';
    this.handlers['transfer_fail'] = 'handleTransferFail';

    // 客户群事件
    this.handlers['create_chat'] = 'handleCreateChat';
    this.handlers['update_chat'] = 'handleUpdateChat';
    this.handlers['dismiss_chat'] = 'handleDismissChat';

    // 审批事件
    this.handlers['submit_approval'] = 'handleSubmitApproval';
    this.handlers['sys_approval_change'] = 'handleSysApprovalChange';
    this.handlers['Approval'] = 'handleApproval';

    // 打卡事件
    this.handlers['checkin'] = 'handleCheckin';
    this.handlers['report_checkin'] = 'handleReportCheckin';

    // 会议事件
    this.handlers['meeting_start'] = 'handleMeetingStart';
    this.handlers['meeting_end'] = 'handleMeetingEnd';
    this.handlers['meeting_created'] = 'handleMeetingCreated';
    this.handlers['meeting_cancelled'] = 'handleMeetingCancelled';

    // 回调验证事件
    this.handlers['url_verification'] = 'handleUrlVerification';
    this.handlers['callback_verification'] = 'handleCallbackVerification';

    // ========== 客户联系回调(新增)==========
    // 联系我相关
    this.handlers['add_contact_way'] = 'handleAddContactWay';
    this.handlers['del_contact_way'] = 'handleDelContactWay';

    // 入群方式相关
    this.handlers['add_join_way'] = 'handleAddJoinWay';
    this.handlers['del_join_way'] = 'handleDelJoinWay';

    // 客服消息相关
    this.handlers['kf_msg_push'] = 'handleKfMsgPush';
    this.handlers['kf_msg_send'] = 'handleKfMsgSend';
    this.handlers['msg_dialogice_send'] = 'handleMsgDialogiceSend';

    // ========== 通讯录变更回调(新增)==========
    this.handlers['change_member'] = 'handleChangeMember';
    this.handlers['change_department'] = 'handleChangeDepartment';
    this.handlers['change_tag'] = 'handleChangeTag';

    // ========== 会议回调(补充)==========
    this.handlers['meeting_ended'] = 'handleMeetingEnded';
    this.handlers['meetingParticipantJoin'] = 'handleMeetingParticipantJoin';
    this.handlers['meetingParticipantLeave'] = 'handleMeetingParticipantLeave';

    // ========== 直播回调 ==========
    this.handlers['living_status'] = 'handleLivingStatus';

    // ========== 微盘回调 ==========
    this.handlers['change_psm'] = 'handleChangePsm';
    this.handlers['change_disk'] = 'handleChangeDisk';
  }

  // ========== 消息验证 ==========

  /**
   * 验证 URL(用于首次配置回调)
   * @param {string} msgSignature 签名
   * @param {string} timestamp 时间戳
   * @param {string} nonce 随机字符串
   * @param {string} echostr 加密的随机字符串
   */
  verifyURL(msgSignature, timestamp, nonce, echostr) {
    const signature = this.getSignature(timestamp, nonce, echostr);
    if (signature !== msgSignature) {
      return { success: false, message: '签名验证失败' };
    }

    const decrypted = this.decrypt(echostr);
    return { success: true, echostr: decrypted };
  }

  /**
   * 验证消息签名
   * @param {string} msgSignature 签名
   * @param {string} timestamp 时间戳
   * @param {string} nonce 随机字符串
   * @param {string} encrypt 加密内容
   */
  verifyMessage(msgSignature, timestamp, nonce, encrypt) {
    console.log('[wecom-api] verifyMessage params:', {
      token: this.token,
      timestamp,
      nonce,
      encrypt: encrypt ? encrypt.substring(0, 50) + '...' : null,
      signature: msgSignature ? msgSignature.substring(0, 50) + '...' : null
    });
    const result = verifyWecomSignature({
      token: this.token,
      timestamp,
      nonce,
      encrypt,
      signature: msgSignature
    });
    console.log('[wecom-api] verifyMessage result:', result);
    return result;
  }

  // ========== 消息解密 ==========

  decrypt(encrypt) {
    try {
      return decryptWecomEncrypted({
        encodingAESKey: this.encodingAESKey,
        encrypt
      });
    } catch (e) {
      throw new Error('解密失败: ' + e.message);
    }
  }

  /**
   * 加密消息
   * @param {string} content 消息内容
   * @param {string} replyNonce 回复随机字符串
   * @param {number} timestamp 时间戳
   */
  encrypt(content, replyNonce, timestamp) {
    try {
      const encrypted = encryptWecomPlaintext({
        encodingAESKey: this.encodingAESKey,
        receiveId: this.corpId,
        plaintext: content
      });

      const signature = this.getSignature(timestamp, replyNonce, encrypted);

      return {
        encrypt: encrypted,
        signature,
        timestamp,
        nonce: replyNonce
      };
    } catch (e) {
      throw new Error('加密失败: ' + e.message);
    }
  }

  // ========== 消息解析 ==========

  /**
   * 解析 XML 消息
   * @param {string} xmlContent XML 内容
   */
  async parseXML(xmlContent) {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlContent);
    return result.xml;
  }

  /**
   * 解析消息事件
   * @param {string} xmlContent XML 内容
   */
  async parseMessage(xmlContent) {
    const xml = await this.parseXML(xmlContent);
    console.log('[wecom-api] parseMessage xml keys:', Object.keys(xml));
    console.log('[wecom-api] parseMessage xml:', JSON.stringify(xml).substring(0, 500));

    const message = {
      ToUserName: xml.ToUserName,
      FromUserName: xml.FromUserName,
      CreateTime: parseInt(xml.CreateTime),
      MsgType: xml.MsgType,
      Content: xml.Content,
      MsgId: xml.MsgId,
      Event: xml.Event,
      EventKey: xml.EventKey,
      AgentID: xml.AgentID,
      // 媒体相关
      MediaId: xml.MediaId,
      PicUrl: xml.PicUrl,
      Format: xml.Format,
      ThumbMediaId: xml.ThumbMediaId,
      // 位置相关
      Location_X: xml.Location_X,
      Location_Y: xml.Location_Y,
      Scale: xml.Scale,
      Label: xml.Label,
      // 链接相关
      Title: xml.Title,
      Description: xml.Description,
      Url: xml.Url,
      // 加密消息
      Encrypt: xml.Encrypt,
      // 外部联系人变更事件关键字段
      ChangeType: xml.ChangeType,
      ExternalUserId: xml.ExternalUserId,
    };

    return message;
  }

  // ========== 统一回调入口 ==========

  /**
   * 处理企业微信回调请求(统一入口)
   * @param {object} params 请求参数
   * @param {string} params.msgSignature 签名
   * @param {string} params.timestamp 时间戳
   * @param {string} params.nonce 随机字符串
   * @param {string} params.echostr 加密字符串(验证URL时)
   * @param {string} params.xmlBody XML请求体
   * @returns {Promise<object>} 处理结果
   */
  async handle(params) {
    const { msgSignature, timestamp, nonce, echostr, xmlBody } = params;

    // URL验证模式(首次配置回调)
    if (echostr) {
      return this._handleUrlVerification(msgSignature, timestamp, nonce, echostr);
    }

    // 消息处理模式
    if (xmlBody) {
      return this._handleMessage(msgSignature, timestamp, nonce, xmlBody);
    }

    throw new Error('缺少必要参数');
  }

  /**
   * 处理 URL 验证
   */
  async _handleUrlVerification(msgSignature, timestamp, nonce, echostr) {
    const result = this.verifyURL(msgSignature, timestamp, nonce, echostr);

    if (result.success) {
      // 记录事件
      this._recordEvent({
        type: 'url_verification',
        success: true,
        timestamp: Date.now()
      });

      return {
        type: 'success',
        body: result.echostr
      };
    }

    return {
      type: 'error',
      message: result.message
    };
  }

  /**
   * 处理消息事件
   * 注意：消息类事件（text/image/voice等）由 @sunnoy/wecom 统一处理
   * 这里只处理事件类消息（有 Event 字段）
   */
  async _handleMessage(msgSignature, timestamp, nonce, xmlBody) {
    const xml = await this.parseXML(xmlBody);
    const encrypt = xml.Encrypt;

    // 验证签名
    if (!this.verifyMessage(msgSignature, timestamp, nonce, encrypt)) {
      throw new Error('签名验证失败');
    }

    // 解密消息
    const decryptedXml = this.decrypt(encrypt);
    const message = await this.parseMessage(decryptedXml);

    // 非事件消息（text/image/voice等）由 @sunnoy/wecom 处理，直接返回成功
    if (!message.Event) {
      return { type: 'success', body: 'success' };
    }

    // 记录事件
    const eventRecord = this._recordEvent({
      type: message.Event,
      msgType: message.MsgType,
      fromUserName: message.FromUserName,
      createTime: message.CreateTime,
      event: message.Event,
      eventKey: message.EventKey,
      agentID: message.AgentID,
      raw: message,
      timestamp: Date.now()
    });

    // 触发事件
    this.emit(message.Event, message, eventRecord);

    // 调用对应处理器
    const handlerName = this.handlers[message.Event];
    if (handlerName && typeof this[handlerName] === 'function') {
      await this[handlerName](message, eventRecord);
    }

    return { type: 'success', body: 'success', message };
  }

  // ========== 事件记录 ==========

  /**
   * 记录回调事件
   * @param {object} event 事件数据
   */
  _recordEvent(event) {
    const record = {
      id: this._generateId(),
      ...event,
      timestamp: event.timestamp || Date.now()
    };

    this.eventHistory.unshift(record);

    // 限制历史记录数量
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }

    // 根据类型分别保存到不同文件
    if (record.type === 'text' || record.msgType === 'text') {
      this._appendToFile('message_history.jsonl', record);
    } else {
      this._appendToFile('event_history.jsonl', record);
    }

    return record;
  }

  /**
   * 获取事件历史记录
   * @param {object} options 查询选项
   * @param {string} options.type 事件类型
   * @param {number} options.limit 返回数量
   * @param {number} options.offset 偏移量
   */
  getEventHistory(options = {}) {
    let { type, limit = 100, offset = 0 } = options;

    let history = this.eventHistory;

    if (type) {
      history = history.filter(e => e.type === type);
    }

    return history.slice(offset, offset + limit);
  }

  /**
   * 获取事件详情
   * @param {string} eventId 事件ID
   */
  getEventById(eventId) {
    return this.eventHistory.find(e => e.id === eventId);
  }

  /**
   * 清空事件历史
   */
  clearEventHistory() {
    this.eventHistory = [];
  }

  /**
   * 导出事件历史到文件
   * @param {string} filePath 文件路径
   */
  async exportEventHistory(filePath) {
    const fs = require('fs');
    const data = JSON.stringify(this.eventHistory, null, 2);
    fs.writeFileSync(filePath, data, 'utf8');
    return { success: true, count: this.eventHistory.length, filePath };
  }

  /**
   * 追加记录到指定文件
   * @param {string} filename 文件名
   * @param {object} record 单条记录
   */
  _appendToFile(filename, record) {
    try {
      const fs = require('fs');
      const path = require('path');
      const dir = '/root/.openclaw/extensions/wecom-api/data';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filePath = path.join(dir, filename);
      fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');
    } catch (e) {
      console.log('[wecom-api] 写入文件失败:', e.message);
    }
  }

  /**
   * 加载事件历史(兼容旧数组格式 + 新增追加格式)
   * 文本消息从 message_history.jsonl 加载,事件从 event_history.jsonl 加载
   */
  loadEventHistory() {
    try {
      const fs = require('fs');
      const path = require('path');
      const dataDir = '/root/.openclaw/extensions/wecom-api/data';
      const records = [];

      const files = ['event_history.jsonl', 'message_history.jsonl'];

      for (const filename of files) {
        const filePath = path.join(dataDir, filename);

        if (!fs.existsSync(filePath)) {
          // 尝试旧格式数组文件
          const oldPath = path.join(dataDir, 'event_history.jsonl');
          if (fs.existsSync(oldPath)) {
            const raw = fs.readFileSync(oldPath, 'utf8').trim();
            if (raw.startsWith('[')) {
              const oldRecords = JSON.parse(raw);
              records.push(...oldRecords);
              console.log('[wecom-api] 兼容加载旧格式:', oldRecords.length, '条 from', filename);
            }
          }
          continue;
        }

        const raw = fs.readFileSync(filePath, 'utf8').trim();
        if (!raw) continue;

        const fileRecords = raw.split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
        records.push(...fileRecords);
        console.log('[wecom-api] 加载', filename, ':', fileRecords.length, '条');
      }

      // 按时间倒序
      records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      this.eventHistory = records.slice(0, this.maxHistorySize);
      console.log('[wecom-api] 事件历史合计:', this.eventHistory.length, '条');
    } catch (e) {
      console.log('[wecom-api] 加载事件历史失败:', e.message);
    }
  }

  /**
   * 加载事件历史从文件(兼容旧数组格式 + 新追加格式)
   */
  loadEventHistory() {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = '/root/.openclaw/extensions/wecom-api/data/event_history.jsonl';

      if (!fs.existsSync(filePath)) {
        return;
      }

      const raw = fs.readFileSync(filePath, 'utf8').trim();
      if (!raw) {
        return;
      }

      // 兼容旧格式(JSON 数组)
      if (raw.startsWith('[')) {
        this.eventHistory = JSON.parse(raw);
      } else {
        // 新格式:每行一个 JSON 对象
        this.eventHistory = raw.split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line))
          .reverse(); // reverse 让最新的在前面(与 unshift 一致)
      }

      console.log('[wecom-api] 已加载事件历史:', this.eventHistory.length, '条');
    } catch (e) {
      console.log('[wecom-api] 加载事件历史失败:', e.message);
    }
  }

  // ========== 事件处理器 ==========

  /**
   * 通讯录变更事件
   */
  /**
   * 通讯录变更事件(通用)
   * 关键字段: ChangeType(1=新增 2=更新 3=删除), UserID, Name, Department
   */
  async handleContactChange(event, record) {
    const ct = event.ChangeType || event.change_type || 0;
    const ctMap = {1:'新增', 2:'更新', 3:'删除'};
    record.changeType = ct;
    record.userId = event.UserID || event.userid || '';
    record.name = event.Name || event.name || '';
    record.department = event.Department || event.department || [];
    record.changeTypeText = ctMap[ct] || '变更(' + ct + ')';
    console.log('[Callback] 通讯录变更: ' + record.changeTypeText + ' UserId=' + record.userId);
    return { handled: true, changeType: record.changeTypeText, userId: record.userId };
  }

  /**
   * 外部联系人变更事件
   */
  /**
   * 外部联系人变更事件
   * 关键字段: ChangeType(1=新增 4=删除), UserID, ExternalUserId
   */
  async handleExternalContactChange(event, record) {
    const changeType = event.ChangeType || event.change_type || 0;
    const userId = event.UserID || event.userid || '';
    const externalUserId = event.ExternalUserId || event.external_userid || '';
    record.changeType = changeType;
    record.userId = userId;
    record.externalUserId = externalUserId;
    const actionMap = {1:'新增', 4:'删除'};
    record.action = actionMap[changeType] || '变更(' + changeType + ')';
    console.log('[Callback] 外部联系人变更: ' + record.action + ' UserId=' + userId + ' ExternalUserId=' + externalUserId);
    return { handled: true, changeType: record.action, userId, externalUserId };
  }

  /**
   * 添加外部联系人
   * 关键字段: UserID, ExternalUserId, WelcomeCode
   */
  async handleAddExternalContact(event, record) {
    record.userId = event.UserID || event.userid || '';
    record.externalUserId = event.ExternalUserId || event.external_userid || '';
    record.welcomeCode = event.WelcomeCode || event.welcome_code || '';
    console.log('[Callback] 添加外部联系人: UserId=' + record.userId + ' ExternalUserId=' + record.externalUserId);
    this.emit('external_contact:add', event, record);
    return { handled: true, userId: record.userId, externalUserId: record.externalUserId };
  }

  /**
   * 删除外部联系人
   * 关键字段: UserID, ExternalUserId
   */
  async handleDelExternalContact(event, record) {
    record.userId = event.UserID || event.userid || '';
    record.externalUserId = event.ExternalUserId || event.external_userid || '';
    console.log('[Callback] 删除外部联系人: UserId=' + record.userId + ' ExternalUserId=' + record.externalUserId);
    this.emit('external_contact:del', event, record);
    return { handled: true, userId: record.userId, externalUserId: record.externalUserId };
  }

  /**
   * 编辑外部联系人
   */
  /**
   * 编辑外部联系人
   * 关键字段: UserID, ExternalUserId
   */
  async handleEditExternalContact(event, record) {
    record.userId = event.UserID || event.userid || '';
    record.externalUserId = event.ExternalUserId || event.external_userid || '';
    console.log('[Callback] 编辑外部联系人: UserId=' + record.userId + ' ExternalUserId=' + record.externalUserId);
    return { handled: true, userId: record.userId, externalUserId: record.externalUserId };
  }

  /**
   * 添加半程外部联系人
   */
  /**
   * 添加半程外部联系人
   * 关键字段: UserID, ExternalUserId, HalfAuthChangeType
   */
  async handleAddHalfExternalContact(event, record) {
    record.userId = event.UserID || event.userid || '';
    record.externalUserId = event.ExternalUserId || event.external_userid || '';
    record.halfAuthChangeType = event.HalfAuthChangeType || event.half_auth_change_type || 0;
    console.log('[Callback] 添加半程外部联系人: UserId=' + record.userId + ' ExternalUserId=' + record.externalUserId);
    return { handled: true, userId: record.userId, externalUserId: record.externalUserId };
  }

  /**
   * 删除跟进成员
   * 关键字段: UserID, ExternalUserId
   */
  async handleDelFollowUser(event, record) {
    record.userId = event.UserID || event.userid || '';
    record.externalUserId = event.ExternalUserId || event.external_userid || '';
    console.log('[Callback] 删除跟进成员: UserId=' + record.userId + ' ExternalUserId=' + record.externalUserId);
    return { handled: true, userId: record.userId, externalUserId: record.externalUserId };
  }

  /**
   * 客户接替失败
   * 事件Key: transfer_fail
   * 关键字段: UserID, ExternalUserId, FailReason
   */
  async handleTransferFail(event, record) {
    record.userId = event.UserID || event.userid || '';
    record.externalUserId = event.ExternalUserId || event.external_userid || '';
    record.failReason = event.FailReason || event.fail_reason || '';
    console.log('[Callback] 客户接替失败: UserId=' + record.userId + ' ExternalUserId=' + record.externalUserId + ' Reason=' + record.failReason);
    return { handled: true, userId: record.userId, failReason: record.failReason };
  }

  /**
   * 客户群创建
   * 关键字段: ChatId, Creator, CreateTime, MemberCount
   */
  async handleCreateChat(event, record) {
    record.chatId = event.ChatId || event.chat_id || '';
    record.creator = event.Creator || event.creator || '';
    record.createTime = event.CreateTime || event.create_time || 0;
    record.memberCount = event.MemberCount || event.member_count || 0;
    console.log('[Callback] 客户群创建: ChatId=' + record.chatId + ' Creator=' + record.creator);
    this.emit('group_chat:create', event, record);
    return { handled: true, chatId: record.chatId, creator: record.creator };
  }

  /**
   * 客户群变更
   * 关键字段: ChatId, UpdateType, UpdateDetail
   */
  async handleUpdateChat(event, record) {
    record.chatId = event.ChatId || event.chat_id || '';
    record.updateType = event.UpdateType || event.update_type || '';
    record.updateDetail = event.UpdateDetail || event.update_detail || '';
    console.log('[Callback] 客户群变更: ChatId=' + record.chatId + ' UpdateType=' + record.updateType);
    this.emit('group_chat:update', event, record);
    return { handled: true, chatId: record.chatId, updateType: record.updateType };
  }

  /**
   * 客户群解散
   * 关键字段: ChatId, Creator, CreateTime
   */
  async handleDismissChat(event, record) {
    record.chatId = event.ChatId || event.chat_id || '';
    record.creator = event.Creator || event.creator || '';
    record.createTime = event.CreateTime || event.create_time || 0;
    console.log('[Callback] 客户群解散: ChatId=' + record.chatId + ' Creator=' + record.creator);
    this.emit('group_chat:dismiss', event, record);
    return { handled: true, chatId: record.chatId };
  }

  /**
   * 用户点击菜单
   */
  /**
   * 审批事件(提交)
   */
  /**
   * 审批提交事件
   * 事件Key: approval_submit
   * 关键字段: ApprovalId, SpStatus, SubmitterUserid, TaskId, UniqueId
   */
  async handleSubmitApproval(event, record) {
    const approvalId = event.ApprovalId || event.approval_id || '';
    const spStatus = event.SpStatus || event.sp_status || 0;
    const submitter = event.SubmitterUserid || event.submitter_userid || '';
    const taskId = event.TaskId || event.task_id || '';
    const uniqueId = event.UniqueId || event.unique_id || '';
    record.approvalId = approvalId;
    record.spStatus = spStatus;
    record.submitter = submitter;
    record.taskId = taskId;
    record.uniqueId = uniqueId;
    record.statusText = this._getApprovalStatusText(spStatus);
    console.log('[Callback] 审批提交: ApprovalId=' + approvalId + ' Status=' + record.statusText + ' Submitter=' + submitter);
    await this._fetchAndSaveApprovalDetail(event, record, 'submit');
    this.emit('approval:submit', event, record);
    return { handled: true, approvalId, spStatus: record.statusText };
  }

  /**
   * 审批变更事件(官方 key: sys_approval_change)
   * 关键字段: ApprovalId, SpStatus, OpenSpid
   */
  async handleSysApprovalChange(event, record) {
    const approvalId = event.ApprovalId || event.approval_id || '';
    const spStatus = event.SpStatus || event.sp_status || 0;
    const openSpid = event.OpenSpid || event.open_spid || '';
    record.approvalId = approvalId;
    record.spStatus = spStatus;
    record.openSpid = openSpid;
    record.statusText = this._getApprovalStatusText(spStatus);
    console.log('[Callback] 审批变更: ApprovalId=' + approvalId + ' Status=' + record.statusText);
    await this._fetchAndSaveApprovalDetail(event, record, 'change');
    this.emit('approval:change', event, record);
    return { handled: true, approvalId, spStatus: record.statusText };
  }

  /**
   * 审批通过/变更事件(兼容旧 key: Approval)
   */
  async handleApproval(event, record) {
    const approvalId = event.ApprovalId || event.approval_id || '';
    const spStatus = event.SpStatus || event.sp_status || 0;
    record.approvalId = approvalId;
    record.spStatus = spStatus;
    record.statusText = this._getApprovalStatusText(spStatus);
    console.log('[Callback] 审批变更(Approval): ApprovalId=' + approvalId + ' Status=' + record.statusText);
    await this._fetchAndSaveApprovalDetail(event, record, 'change');
    this.emit('approval:pass', event, record);
    return { handled: true, approvalId, spStatus: record.statusText };
  }

  /** 审批状态码转文本 */
  _getApprovalStatusText(spStatus) {
    const map = { 1:'审批中', 2:'已通过', 3:'已驳回', 4:'已撤回', 5:'未提交', 6:'已通过', 7:'已驳回', 8:'已转交', 10:'已完成', 11:'已取消' };
    return map[spStatus] || '状态'+spStatus;
  }


  /**
   * 审批通过/变更事件
   */
  async handleApproval(event, record) {
    console.log('[Callback] 审批变更:', event);
    // 获取审批详情并保存
    await this._fetchAndSaveApprovalDetail(event, record, 'change');
    this.emit('approval:pass', event, record);
    return { handled: true };
  }

  /**
   * 根据回调时间拉取审批详情并保存
   * @param {object} event 事件对象
   * @param {object} record 记录对象
   * @param {string} trigger 触发类型 submit|change
   */
  async _fetchAndSaveApprovalDetail(event, record, trigger) {
    try {
      const callbackTime = (event.CreateTime || record.createTime || 0) * 1000;
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - 600;

      const idListRes = await this.approval.getApprovalIds(startTime, endTime);
      const spNoList = idListRes?.sp_no_list || [];

      if (spNoList.length === 0) {
        console.log('[Callback] 未找到审批单(' + trigger + ')');
        return;
      }

      const matchedSpNo = spNoList[0];
      const detail = await this.approval.getApprovalDetail(matchedSpNo);
      if (detail?.errcode === 0 || detail?.sp_detail) {
        record.spNo = matchedSpNo;
        record.approvalDetail = detail.sp_detail || detail;
        record.fetchTime = new Date().toISOString();
        this._appendToFile('approval_detail.jsonl', {
          sp_no: matchedSpNo, trigger,
          callback_time: new Date(callbackTime).toISOString(),
          fetch_time: record.fetchTime,
          detail: record.approvalDetail, raw: event
        });
        console.log('[Callback] 审批详情已保存: ' + matchedSpNo);
      } else {
        console.log('[Callback] 获取审批详情失败: ' + (detail?.errmsg || JSON.stringify(detail).slice(0, 100)));
      }
    } catch (e) {
      console.log('[Callback] _fetchAndSaveApprovalDetail 异常: ' + e.message);
    }
  }


  /**
   * 打卡事件
   */
  async handleCheckin(event, record) {
    console.log('[Callback] 打卡:', event);
    return { handled: true };
  }

  /**
   * 会议开始
   */
  /**
   * 会议开始
   * 关键字段: MeetingId, RoomId, Topic, StartTime, EndTime, JoinUrl, HostUserId
   */
  async handleMeetingStart(event, record) {
    record.meetingId = event.MeetingId || event.meeting_id || '';
    record.roomId = event.RoomId || event.room_id || '';
    record.topic = event.Topic || event.topic || '';
    record.startTime = event.StartTime || event.start_time || 0;
    record.endTime = event.EndTime || event.end_time || 0;
    record.joinUrl = event.JoinUrl || event.join_url || '';
    record.hostUserId = event.HostUserId || event.host_user_id || '';
    console.log('[Callback] 会议开始: MeetingId=' + record.meetingId + ' Topic=' + record.topic + ' Host=' + record.hostUserId);
    this.emit('meeting:start', event, record);
    return { handled: true, meetingId: record.meetingId, topic: record.topic };
  }


  /**
   * 会议结束
   */
  /**
   * 会议结束
   * 关键字段: MeetingId, RoomId, Topic, StartTime, EndTime, HostUserId, RemainDuration
   */
  async handleMeetingEnd(event, record) {
    record.meetingId = event.MeetingId || event.meeting_id || '';
    record.roomId = event.RoomId || event.room_id || '';
    record.topic = event.Topic || event.topic || '';
    record.startTime = event.StartTime || event.start_time || 0;
    record.endTime = event.EndTime || event.end_time || 0;
    record.hostUserId = event.HostUserId || event.host_user_id || '';
    record.remainDuration = event.RemainDuration || event.remain_duration || 0;
    console.log('[Callback] 会议结束: MeetingId=' + record.meetingId + ' Topic=' + record.topic);
    this.emit('meeting:end', event, record);
    return { handled: true, meetingId: record.meetingId, topic: record.topic };
  }


  // ========== 新增的回调处理器实现 ==========

  /**
   * 添加联系我
   */
  async handleAddContactWay(event, record) {
    console.log('[Callback] 添加联系我:', event);
    this.emit('contact_way:add', event, record);
    return { handled: true };
  }

  /**
   * 删除联系我
   */
  async handleDelContactWay(event, record) {
    console.log('[Callback] 删除联系我:', event);
    this.emit('contact_way:del', event, record);
    return { handled: true };
  }

  /**
   * 添加加入群聊方式
   */
  async handleAddJoinWay(event, record) {
    console.log('[Callback] 添加加入群聊方式:', event);
    this.emit('join_way:add', event, record);
    return { handled: true };
  }

  /**
   * 删除加入群聊方式
   */
  async handleDelJoinWay(event, record) {
    console.log('[Callback] 删除加入群聊方式:', event);
    this.emit('join_way:del', event, record);
    return { handled: true };
  }

  /**
   * 客服消息推送
   */
  async handleKfMsgPush(event, record) {
    console.log('[Callback] 客服消息推送:', event);
    this.emit('kf_msg:push', event, record);
    return { handled: true };
  }

  /**
   * 客服消息发送
   */
  async handleKfMsgSend(event, record) {
    console.log('[Callback] 客服消息发送:', event);
    this.emit('kf_msg:send', event, record);
    return { handled: true };
  }

  /**
   * 消息确认
   */
  async handleMsgDialogiceSend(event, record) {
    console.log('[Callback] 消息确认:', event);
    this.emit('msg:confirm', event, record);
    return { handled: true };
  }

  /**
   * 成员变更通知
   */
  /**
   * 成员变更事件
   * 关键字段: ChangeType, UserID, NewUserID, Name, Department, Position
   */
  async handleChangeMember(event, record) {
    const ct = event.ChangeType || event.change_type || 0;
    record.changeType = ct;
    record.userId = event.UserID || event.userid || '';
    record.newUserId = event.NewUserID || event.new_userid || '';
    record.name = event.Name || event.name || '';
    record.department = event.Department || event.department || [];
    record.position = event.Position || event.position || '';
    const ctMap = {1:'新增', 2:'更新', 3:'删除'};
    record.changeTypeText = ctMap[ct] || '变更('+ct+')';
    console.log('[Callback] 成员变更: ' + record.changeTypeText + ' UserId=' + record.userId + ' Name=' + record.name);
    this.emit('contact:member_change', event, record);
    return { handled: true, changeType: record.changeTypeText, userId: record.userId };
  }


  /**
   * 部门变更通知
   */
  /**
   * 部门变更事件
   * 关键字段: ChangeType, Id, Name, ParentId, Order
   */
  async handleChangeDepartment(event, record) {
    const ct = event.ChangeType || event.change_type || 0;
    record.changeType = ct;
    record.deptId = event.Id || event.id || '';
    record.name = event.Name || event.name || '';
    record.parentId = event.ParentId || event.parentid || '';
    record.order = event.Order || event.order || 0;
    const ctMap = {1:'新增', 2:'更新', 3:'删除'};
    record.changeTypeText = ctMap[ct] || '变更('+ct+')';
    console.log('[Callback] 部门变更: ' + record.changeTypeText + ' DeptId=' + record.deptId + ' Name=' + record.name);
    this.emit('contact:department_change', event, record);
    return { handled: true, changeType: record.changeTypeText, deptId: record.deptId };
  }


  /**
   * 标签变更通知
   */
  /**
   * 标签变更事件
   * 关键字段: ChangeType, TagId, TagName, AddUserIds, DelUserIds
   */
  async handleChangeTag(event, record) {
    const ct = event.ChangeType || event.change_type || 0;
    record.changeType = ct;
    record.tagId = event.TagId || event.tagid || '';
    record.tagName = event.TagName || event.tagname || '';
    record.addUserIds = event.AddUserIds || event.add_userids || [];
    record.delUserIds = event.DelUserIds || event.del_userids || [];
    const ctMap = {1:'新增', 2:'更新', 3:'删除'};
    record.changeTypeText = ctMap[ct] || '变更('+ct+')';
    console.log('[Callback] 标签变更: ' + record.changeTypeText + ' TagId=' + record.tagId + ' TagName=' + record.tagName);
    this.emit('contact:tag_change', event, record);
    return { handled: true, changeType: record.changeTypeText, tagId: record.tagId };
  }


  /**
   * 会议真正结束(历史记录生成后)
   */
  async handleMeetingEnded(event, record) {
    console.log('[Callback] 会议结束(历史记录):', event);
    this.emit('meeting:ended', event, record);
    return { handled: true };
  }

  /**
   * 参会成员加入
   */
  /**
   * 参会成员加入
   * 关键字段: MeetingId, RoomId, ParticipantUserId, JoinTime
   */
  async handleMeetingParticipantJoin(event, record) {
    record.meetingId = event.MeetingId || event.meeting_id || '';
    record.roomId = event.RoomId || event.room_id || '';
    record.participantUserId = event.ParticipantUserId || event.participant_userid || event.UserId || '';
    record.joinTime = event.JoinTime || event.join_time || 0;
    console.log('[Callback] 参会成员加入: MeetingId=' + record.meetingId + ' User=' + record.participantUserId);
    this.emit('meeting:participant_join', event, record);
    return { handled: true, meetingId: record.meetingId, participantUserId: record.participantUserId };
  }


  /**
   * 参会成员离开
   */
  /**
   * 参会成员离开
   * 关键字段: MeetingId, RoomId, ParticipantUserId, LeaveTime
   */
  async handleMeetingParticipantLeave(event, record) {
    record.meetingId = event.MeetingId || event.meeting_id || '';
    record.roomId = event.RoomId || event.room_id || '';
    record.participantUserId = event.ParticipantUserId || event.participant_userid || event.UserId || '';
    record.leaveTime = event.LeaveTime || event.leave_time || 0;
    console.log('[Callback] 参会成员离开: MeetingId=' + record.meetingId + ' User=' + record.participantUserId);
    this.emit('meeting:participant_leave', event, record);
    return { handled: true, meetingId: record.meetingId, participantUserId: record.participantUserId };
  }


  /**
   * 直播状态变更
   */
  async handleLivingStatus(event, record) {
    console.log('[Callback] 直播状态变更:', event);
    this.emit('living:status_change', event, record);
    return { handled: true };
  }

  /**
   * 微盘容量变更
   */
  async handleChangePsm(event, record) {
    console.log('[Callback] 微盘容量变更:', event);
    this.emit('disk:psm_change', event, record);
    return { handled: true };
  }

  /**
   * 微盘文件变更
   */
  async handleChangeDisk(event, record) {
    console.log('[Callback] 微盘文件变更:', event);
    this.emit('disk:file_change', event, record);
    return { handled: true };
  }

  // ========== 消息构建 ==========

  /**
   * 构建文本回复
   */
  buildTextReply(toUser, fromUser, content) {
    return this._buildReply(toUser, fromUser, 'text', { content });
  }

  /**
   * 构建图片回复
   */
  buildImageReply(toUser, fromUser, mediaId) {
    return this._buildReply(toUser, fromUser, 'image', { mediaId });
  }

  /**
   * 构建通用回复
   */
  _buildReply(toUser, fromUser, msgType, content) {
    let contentXml = '';

    switch (msgType) {
      case 'text':
        contentXml = `<Content><![CDATA[${content.content}]]></Content>`;
        break;
      case 'image':
        contentXml = `<Image><MediaId><![CDATA[${content.mediaId}]]></MediaId></Image>`;
        break;
    }

    return `<xml>
      <ToUserName><![CDATA[${toUser}]]></ToUserName>
      <FromUserName><![CDATA[${fromUser}]]></FromUserName>
      <CreateTime>${Date.now()}</CreateTime>
      <MsgType><![CDATA[${msgType}]]></MsgType>
      ${contentXml}
    </xml>`;
  }

  // ========== 工具方法 ==========

  getSignature(timestamp, nonce, encrypt) {
    const arr = [this.token, timestamp, nonce, encrypt].sort();
    const str = arr.join('');
    return crypto.createHash('sha1').update(str).digest('hex');
  }

  generateRandomStr(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  intToBuffer(num) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(num, 0);
    return buffer;
  }

  _generateId() {
    return `evt_${Date.now()}_${this.generateRandomStr(8)}`;
  }
}

module.exports = Callback;
