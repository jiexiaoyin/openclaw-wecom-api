/**
 * 回调处理模块
 * 企业微信回调消息处理框架
 * 
 * 功能：
 * 1. 统一回调入口 - 处理所有企业微信回调事件
 * 2. 事件记录 - 自动记录所有回调事件
 * 3. 事件分发 - 根据事件类型自动调用对应处理器
 * 4. 响应生成 - 自动生成响应消息
 * 
 * 使用方式：
 * const callback = new Callback(config);
 * callback.on('change_contact', async (event) => { ... });
 * callback.handle(req, res);
 */

const crypto = require('crypto');
const xml2js = require('xml2js');
const EventEmitter = require('events');

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
    
    // 初始化默认处理器
    this._initDefaultHandlers();
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
    
    // 消息事件
    this.handlers['user_click'] = 'handleUserClick';
    this.handlers['view'] = 'handleUserView';
    this.handlers['scancode_push'] = 'handleScanCodePush';
    this.handlers['scancode_waitmsg'] = 'handleScanCodeWaitMsg';
    this.handlers['pic_sysphoto'] = 'handlePicSysPhoto';
    this.handlers['pic_photo_or_album'] = 'handlePicPhotoOrAlbum';
    this.handlers['pic_weixin'] = 'handlePicWeixin';
    this.handlers['location_select'] = 'handleLocationSelect';
    this.handlers['enter_agent'] = 'handleEnterAgent';
    this.handlers['message'] = 'handleMessage';
    
    // 审批事件
    this.handlers['submit_approval'] = 'handleSubmitApproval';
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
    
    // ========== 客户联系回调（新增）==========
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
    
    // ========== 通讯录变更回调（新增）==========
    this.handlers['change_member'] = 'handleChangeMember';
    this.handlers['change_department'] = 'handleChangeDepartment';
    this.handlers['change_tag'] = 'handleChangeTag';
    
    // ========== 会议回调（补充）==========
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
   * 验证 URL（用于首次配置回调）
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
    const signature = this.getSignature(timestamp, nonce, encrypt);
    return signature === msgSignature;
  }

  // ========== 消息解密 ==========

  decrypt(encrypt) {
    try {
      const aesKey = Buffer.from(this.encodingAESKey + '=', 'base64');
      const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, aesKey.slice(0, 16));
      decipher.setAutoPadding(false);  // 关键：禁用自动填充，手动处理 PKCS#7
      
      let decryptedPadded = Buffer.concat([
        decipher.update(encrypt, 'base64'),
        decipher.final()
      ]);

      // WeCom uses PKCS#7 with block size 32 (not 16 which is standard AES)
      const WECOM_PKCS7_BLOCK_SIZE = 32;
      const pad = decryptedPadded[decryptedPadded.length - 1];
      if (pad < 1 || pad > WECOM_PKCS7_BLOCK_SIZE) {
        throw new Error('invalid pkcs7 padding');
      }
      const decrypted = decryptedPadded.subarray(0, decryptedPadded.length - pad);

      // 去除前 20 字节 (random 16 bytes + msgLen 4 bytes)
      const msgLen = decrypted.readUInt32BE(16);
      const msgStart = 20;
      const msgEnd = msgStart + msgLen;
      
      if (msgEnd > decrypted.length) {
        throw new Error('invalid decrypted msg length');
      }
      
      const result = decrypted.subarray(msgStart, msgEnd).toString('utf8');
      return result;
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
      const randomStr = this.generateRandomStr(16);
      const text = Buffer.from(content, 'utf8');
      const pad = 32 - (text.length % 32);
      const padding = Buffer.alloc(pad, pad);
      
      const raw = Buffer.concat([randomStr, this.intToBuffer(text.length), text, padding, Buffer.from(this.corpId, 'utf8')]);
      
      const aesKey = Buffer.from(this.encodingAESKey + '=', 'base64');
      const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, aesKey.slice(0, 16));
      
      let encrypted = cipher.update(raw, null, 'base64');
      encrypted += cipher.final('base64');

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
    
    const message = {
      toUserName: xml.ToUserName,
      fromUserName: xml.FromUserName,
      createTime: parseInt(xml.CreateTime),
      msgType: xml.MsgType,
      content: xml.Content,
      msgId: xml.MsgId,
      event: xml.Event,
      eventKey: xml.EventKey,
      agentID: xml.AgentID,
      // 媒体相关
      mediaId: xml.MediaId,
      picUrl: xml.PicUrl,
      format: xml.Format,
      thumbMediaId: xml.ThumbMediaId,
      // 位置相关
      locationX: xml.Location_X,
      locationY: xml.Location_Y,
      scale: xml.Scale,
      label: xml.Label,
      // 链接相关
      title: xml.Title,
      description: xml.Description,
      url: xml.Url,
      // 加密消息
      encrypt: xml.Encrypt
    };

    return message;
  }

  // ========== 统一回调入口 ==========

  /**
   * 处理企业微信回调请求（统一入口）
   * @param {object} params 请求参数
   * @param {string} params.msgSignature 签名
   * @param {string} params.timestamp 时间戳
   * @param {string} params.nonce 随机字符串
   * @param {string} params.echostr 加密字符串（验证URL时）
   * @param {string} params.xmlBody XML请求体
   * @returns {Promise<object>} 处理结果
   */
  async handle(params) {
    const { msgSignature, timestamp, nonce, echostr, xmlBody } = params;
    
    // URL验证模式（首次配置回调）
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
   */
  async _handleMessage(msgSignature, timestamp, nonce, xmlBody) {
    console.log('[wecomtool] _handleMessage called');
    console.log('[wecomtool] xmlBody preview:', xmlBody ? xmlBody.substring(0, 300) : 'missing');
    const xml = await this.parseXML(xmlBody);
    console.log('[wecomtool] parsed xml Encrypt length:', xml.Encrypt ? xml.Encrypt.length : 'null');
    const encrypt = xml.Encrypt;
    
    // 验证签名
    console.log('[wecomtool] verifying signature...');
    if (!this.verifyMessage(msgSignature, timestamp, nonce, encrypt)) {
      throw new Error('签名验证失败');
    }
    
    // 解密消息
    console.log('[wecomtool] decrypting...');
    const decryptedXml = this.decrypt(encrypt);
    const message = await this.parseMessage(decryptedXml);
    
    // 记录事件
    const eventRecord = this._recordEvent({
      type: message.event || message.msgType,
      msgType: message.msgType,
      fromUserName: message.fromUserName,
      createTime: message.createTime,
      event: message.event,
      eventKey: message.eventKey,
      agentID: message.agentID,
      raw: message,
      timestamp: Date.now()
    });
    
    // 触发事件
    this.emit(message.event || message.msgType, message, eventRecord);
    
    // 调用对应处理器
    const handlerName = this.handlers[message.event || message.msgType];
    if (handlerName && typeof this[handlerName] === 'function') {
      await this[handlerName](message, eventRecord);
    }
    
    // 返回成功响应
    return {
      type: 'success',
      body: 'success'
    };
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

  // ========== 事件处理器 ==========

  /**
   * 通讯录变更事件
   */
  async handleContactChange(event, record) {
    console.log('[Callback] 通讯录变更:', event);
    return { handled: true };
  }

  /**
   * 外部联系人变更事件
   */
  async handleExternalContactChange(event, record) {
    console.log('[Callback] 外部联系人变更:', event);
    return { handled: true };
  }

  /**
   * 添加外部联系人
   */
  async handleAddExternalContact(event, record) {
    console.log('[Callback] 添加外部联系人:', event);
    this.emit('external_contact:add', event, record);
    return { handled: true };
  }

  /**
   * 删除外部联系人
   */
  async handleDelExternalContact(event, record) {
    console.log('[Callback] 删除外部联系人:', event);
    this.emit('external_contact:del', event, record);
    return { handled: true };
  }

  /**
   * 编辑外部联系人
   */
  async handleEditExternalContact(event, record) {
    console.log('[Callback] 编辑外部联系人:', event);
    return { handled: true };
  }

  /**
   * 添加半程外部联系人
   */
  async handleAddHalfExternalContact(event, record) {
    console.log('[Callback] 添加半程外部联系人:', event);
    return { handled: true };
  }

  /**
   * 删除跟进成员
   */
  async handleDelFollowUser(event, record) {
    console.log('[Callback] 删除跟进成员:', event);
    return { handled: true };
  }

  /**
   * 客户群创建
   */
  async handleCreateChat(event, record) {
    console.log('[Callback] 客户群创建:', event);
    this.emit('group_chat:create', event, record);
    return { handled: true };
  }

  /**
   * 客户群变更
   */
  async handleUpdateChat(event, record) {
    console.log('[Callback] 客户群变更:', event);
    this.emit('group_chat:update', event, record);
    return { handled: true };
  }

  /**
   * 客户群解散
   */
  async handleDismissChat(event, record) {
    console.log('[Callback] 客户群解散:', event);
    this.emit('group_chat:dismiss', event, record);
    return { handled: true };
  }

  /**
   * 用户点击菜单
   */
  async handleUserClick(event, record) {
    console.log('[Callback] 用户点击:', event);
    this.emit('menu:click', event, record);
    return { handled: true };
  }

  /**
   * 用户点击链接
   */
  async handleUserView(event, record) {
    console.log('[Callback] 用户点击链接:', event);
    return { handled: true };
  }

  /**
   * 扫码事件
   */
  async handleScanCodePush(event, record) {
    console.log('[Callback] 扫码:', event);
    return { handled: true };
  }

  /**
   * 审批事件
   */
  async handleSubmitApproval(event, record) {
    console.log('[Callback] 提交审批:', event);
    this.emit('approval:submit', event, record);
    return { handled: true };
  }

  /**
   * 审批通过事件
   */
  async handleApproval(event, record) {
    console.log('[Callback] 审批通过:', event);
    this.emit('approval:pass', event, record);
    return { handled: true };
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
  async handleMeetingStart(event, record) {
    console.log('[Callback] 会议开始:', event);
    this.emit('meeting:start', event, record);
    return { handled: true };
  }

  /**
   * 会议结束
   */
  async handleMeetingEnd(event, record) {
    console.log('[Callback] 会议结束:', event);
    this.emit('meeting:end', event, record);
    return { handled: true };
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
  async handleChangeMember(event, record) {
    console.log('[Callback] 成员变更:', event);
    this.emit('contact:member_change', event, record);
    return { handled: true };
  }

  /**
   * 部门变更通知
   */
  async handleChangeDepartment(event, record) {
    console.log('[Callback] 部门变更:', event);
    this.emit('contact:department_change', event, record);
    return { handled: true };
  }

  /**
   * 标签变更通知
   */
  async handleChangeTag(event, record) {
    console.log('[Callback] 标签变更:', event);
    this.emit('contact:tag_change', event, record);
    return { handled: true };
  }

  /**
   * 会议真正结束（历史记录生成后）
   */
  async handleMeetingEnded(event, record) {
    console.log('[Callback] 会议结束(历史记录):', event);
    this.emit('meeting:ended', event, record);
    return { handled: true };
  }

  /**
   * 参会成员加入
   */
  async handleMeetingParticipantJoin(event, record) {
    console.log('[Callback] 参会成员加入:', event);
    this.emit('meeting:participant_join', event, record);
    return { handled: true };
  }

  /**
   * 参会成员离开
   */
  async handleMeetingParticipantLeave(event, record) {
    console.log('[Callback] 参会成员离开:', event);
    this.emit('meeting:participant_leave', event, record);
    return { handled: true };
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
