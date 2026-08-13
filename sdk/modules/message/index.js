/**
 * 消息收发模块
 * API 章节：八 - 消息接收与发送
 * 包含：发送消息、接收消息、群聊管理、智能机器人
 */

const WeComSDK = require('../../sdk');

class Message extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 应用消息 ==========

  /**
   * 发送应用消息
   * @param {string} toUser 接收成员
   * @param {number} agentId 应用 id
   * @param {object} content 消息内容
   * @param {string} msgType 消息类型
   */
  async sendMessage(toUser, agentId, content, msgType = 'text') {
    return this.post('/message/send', {
      touser: toUser,
      agentid: agentId,
      msgtype: msgType,
      [msgType]: content
    });
  }

  /**
   * 发送文本消息
   * @param {string} toUser 接收成员 (| 分隔)
   * @param {string} content 文本内容
   * @param {number} agentId 应用 id
   */
  async sendText(toUser, content, agentId) {
    return this.sendMessage(toUser, agentId, { content }, 'text');
  }

  /**
   * 发送图片消息
   * @param {string} toUser 接收成员
   * @param {string} mediaId 图片 media_id
   * @param {number} agentId 应用 id
   */
  async sendImage(toUser, mediaId, agentId) {
    return this.sendMessage(toUser, agentId, { media_id: mediaId }, 'image');
  }

  /**
   * 发送语音消息
   * @param {string} toUser 接收成员
   * @param {string} mediaId 语音 media_id
   * @param {number} agentId 应用 id
   */
  async sendVoice(toUser, mediaId, agentId) {
    return this.sendMessage(toUser, agentId, { media_id: mediaId }, 'voice');
  }

  /**
   * 发送视频消息
   * @param {string} toUser 接收成员
   * @param {string} mediaId 视频 media_id
   * @param {number} agentId 应用 id
   */
  async sendVideo(toUser, mediaId, agentId) {
    return this.sendMessage(toUser, agentId, { media_id: mediaId }, 'video');
  }

  /**
   * 发送文件消息
   * @param {string} toUser 接收成员
   * @param {string} mediaId 文件 media_id
   * @param {number} agentId 应用 id
   */
  async sendFile(toUser, mediaId, agentId) {
    return this.sendMessage(toUser, agentId, { media_id: mediaId }, 'file');
  }

  /**
   * 发送文本卡片消息
   * @param {string} toUser 接收成员
   * @param {object} content 卡片内容
   * @param {number} agentId 应用 id
   */
  async sendTextCard(toUser, content, agentId) {
    return this.sendMessage(toUser, agentId, content, 'textcard');
  }

  /**
   * 发送图文消息
   * @param {string} toUser 接收成员
   * @param {object} content 图文内容
   * @param {number} agentId 应用 id
   */
  async sendNews(toUser, content, agentId) {
    return this.sendMessage(toUser, agentId, { articles: content }, 'news');
  }

  /**
   * 发送 Markdown 消息
   * @param {string} toUser 接收成员
   * @param {string} content Markdown 内容
   * @param {number} agentId 应用 id
   */
  async sendMarkdown(toUser, content, agentId) {
    return this.sendMessage(toUser, agentId, { content }, 'markdown');
  }

  /**
   * 发送模板卡片消息
   * @param {string} toUser 接收成员
   * @param {object} content 卡片内容
   * @param {number} agentId 应用 id
   */
  async sendTemplateCard(toUser, content, agentId) {
    return this.sendMessage(toUser, agentId, content, 'template_card');
  }

  /**
   * 更新模板卡片消息
   * @param {string} userId 成员 id
   * @param {string} agentId 应用 id
   * @param {string} responseCode 回复代码
   * @param {object} cardData 卡片数据
   */
  async updateTemplateCard(userId, agentId, responseCode, cardData) {
    return this.post('/message/update_template_card', {
      userid: userId,
      agentid: agentId,
      response_code: responseCode,
      card_data: cardData
    });
  }

  /**
   * 撤回应用消息
   * @param {string} msgId 消息 id
   */
  async recallMessage(msgId) {
    return this.post('/message/recall', { msgid: msgId });
  }

  // ========== 群聊会话管理 ==========

  /**
   * 创建群聊会话
   * @param {string} name 群名称
   * @param {string} owner 群主 userid
   * @param {string[]} userList 成员列表
   */
  async createChat(name, owner, userList) {
    return this.post('/appchat/create', {
      name,
      owner,
      userlist: userList
    });
  }

  /**
   * 修改群聊会话
   * @param {string} chatId 群聊 id
   * @param {object} params 修改参数
   */
  async updateChat(chatId, { name, owner, addUserList, removeUserList }) {
    return this.post('/appchat/update', {
      chatid: chatId,
      name,
      owner,
      add_user_list: addUserList,
      remove_user_list: removeUserList
    });
  }

  /**
   * 获取群聊会话
   * @param {string} chatId 群聊 id
   */
  async getChat(chatId) {
    return this.post('/appchat/get', { chatid: chatId });
  }

  /**
   * 应用推送消息到群聊
   * @param {string} chatId 群聊 id
   * @param {object} content 消息内容
   * @param {string} msgType 消息类型
   */
  async sendChatMessage(chatId, content, msgType = 'text') {
    return this.post('/appchat/send', {
      chatid: chatId,
      msgtype: msgType,
      [msgType]: content
    });
  }

  // ========== 智能表格自动化创建的群聊 ==========

  /**
   * 获取群聊列表
   * @param {number} offset 偏移量
   * @param {number} size 每页数量
   */
  async getOpenChatList(offset = 0, size = 100) {
    return this.post('/openchat/list', { offset, limit: size });
  }

  /**
   * 获取群聊详情
   * @param {string} openChatId 群聊 id
   */
  async getOpenChatDetail(openChatId) {
    return this.post('/openchat/get', { open_chatid: openChatId });
  }

  /**
   * 修改群聊会话（智能表格）
   * @param {string} openChatId 群聊 id
   * @param {string} name 群名称
   * @param {string} owner 群主
   */
  async updateOpenChat(openChatId, name, owner) {
    return this.post('/openchat/update', {
      open_chatid: openChatId,
      name,
      owner
    });
  }

  // ========== 消息推送（群机器人） ==========

  /**
   * 机器人发送消息
   * @param {string} webhookKey webhook key
   * @param {object} content 消息内容
   * @param {string} msgType 消息类型
   */
  async sendRobotMessage(webhookKey, content, msgType = 'text') {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${webhookKey}`;
    return this.request({
      method: 'POST',
      url,
      data: {
        msgtype: msgType,
        [msgType]: content
      }
    });
  }

  /**
   * 机器人发送文本
   * @param {string} webhookKey webhook key
   * @param {string} content 文本内容
   * @param {string[]} mentionedList @成员列表
   */
  async sendRobotText(webhookKey, content, mentionedList = []) {
    return this.sendRobotMessage(webhookKey, {
      content,
      mentioned_list: mentionedList
    }, 'text');
  }

  /**
   * 机器人发送 Markdown
   * @param {string} webhookKey webhook key
   * @param {string} content Markdown 内容
   */
  async sendRobotMarkdown(webhookKey, content) {
    return this.sendRobotMessage(webhookKey, { content }, 'markdown');
  }

  /**
   * 机器人发送图片
   * @param {string} webhookKey webhook key
   * @param {string} base64 图片 base64
   * @param {string} md5 图片 md5
   */
  async sendRobotImage(webhookKey, base64, md5) {
    return this.sendRobotMessage(webhookKey, {
      base64,
      md5
    }, 'image');
  }

  /**
   * 机器人发送图文
   * @param {string} webhookKey webhook key
   * @param {object} news 图文内容
   */
  async sendRobotNews(webhookKey, news) {
    return this.sendRobotMessage(webhookKey, { articles: news }, 'news');
  }

  // ========== 被动回复消息 ==========

  /**
   * 被动回复文本消息
   * @param {string} toUser 接收者
   * @param {string} fromUser 发送者
   * @param {number} createTime 创建时间
   * @param {string} content 文本内容
   */
  replyText(toUser, fromUser, createTime, content) {
    return `<xml>
      <ToUserName><![CDATA[${toUser}]]></ToUserName>
      <FromUserName><![CDATA[${fromUser}]]></FromUserName>
      <CreateTime>${createTime}</CreateTime>
      <MsgType><![CDATA[text]]></MsgType>
      <Content><![CDATA[${content}]]></Content>
    </xml>`;
  }

  /**
   * 被动回复图片消息
   * @param {string} toUser 接收者
   * @param {string} fromUser 发送者
   * @param {number} createTime 创建时间
   * @param {string} mediaId 图片 media_id
   */
  replyImage(toUser, fromUser, createTime, mediaId) {
    return `<xml>
      <ToUserName><![CDATA[${toUser}]]></ToUserName>
      <FromUserName><![CDATA[${fromUser}]]></FromUserName>
      <CreateTime>${createTime}</CreateTime>
      <MsgType><![CDATA[image]]></MsgType>
      <Image>
        <MediaId><![CDATA[${mediaId}]]></MediaId>
      </Image>
    </xml>`;
  }

  /**
   * 被动回复语音消息
   * @param {string} toUser 接收者
   * @param {string} fromUser 发送者
   * @param {number} createTime 创建时间
   * @param {string} mediaId 语音 media_id
   */
  replyVoice(toUser, fromUser, createTime, mediaId) {
    return `<xml>
      <ToUserName><![CDATA[${toUser}]]></ToUserName>
      <FromUserName><![CDATA[${fromUser}]]></FromUserName>
      <CreateTime>${createTime}</CreateTime>
      <MsgType><![CDATA[voice]]></MsgType>
      <Voice>
        <MediaId><![CDATA[${mediaId}]]></MediaId>
      </Voice>
    </xml>`;
  }

  /**
   * 被动回复视频消息
   * @param {string} toUser 接收者
   * @param {string} fromUser 发送者
   * @param {number} createTime 创建时间
   * @param {object} video 视频信息
   */
  replyVideo(toUser, fromUser, createTime, video) {
    return `<xml>
      <ToUserName><![CDATA[${toUser}]]></ToUserName>
      <FromUserName><![CDATA[${fromUser}]]></FromUserName>
      <CreateTime>${createTime}</CreateTime>
      <MsgType><![CDATA[video]]></MsgType>
      <Video>
        <MediaId><![CDATA[${video.mediaId}]]></MediaId>
        <Title><![CDATA[${video.title || ''}]]></Title>
        <Description><![CDATA[${video.description || ''}]]></Description>
      </Video>
    </xml>`;
  }

  /**
   * 被动回复图文消息
   * @param {string} toUser 接收者
   * @param {string} fromUser 发送者
   * @param {number} createTime 创建时间
   * @param {object[]} articles 图文列表
   */
  replyNews(toUser, fromUser, createTime, articles) {
    const items = articles.map(item => `
      <item>
        <Title><![CDATA[${item.title}]]></Title>
        <Description><![CDATA[${item.description || ''}]]></Description>
        <PicUrl><![CDATA[${item.picUrl || ''}]]></PicUrl>
        <Url><![CDATA[${item.url}]]></Url>
      </item>
    `).join('');

    return `<xml>
      <ToUserName><![CDATA[${toUser}]]></ToUserName>
      <FromUserName><![CDATA[${fromUser}]]></FromUserName>
      <CreateTime>${createTime}</CreateTime>
      <MsgType><![CDATA[news]]></MsgType>
      <ArticleCount>${articles.length}</ArticleCount>
      <Articles>${items}</Articles>
    </xml>`;
  }
}

module.exports = Message;
