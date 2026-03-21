/**
 * OpenClaw 插件入口 - 企业微信工具
 * 
 * 继承 OpenClaw HTTP 服务，提供回调处理和 32 个 API 模块
 */

const path = require('path');

// 导入配置加载器
const { getConfig } = require('./config.js');

// 导入回调处理模块
const CallbackModule = require('./src/modules/callback/index.js');
const CallbackClass = CallbackModule.default || CallbackModule;

// 导入统计模块
const ContactStats = require('./src/modules/contact_stats/index.js');

// 导入通讯录缓存模块
const AddressBookCache = require('./src/modules/addressbook_cache/index.js');
const AddressBook = require('./src/modules/addressbook/index.js');

// 导入回调工具函数
const { createCallbackHandler } = require('./src/callback-helper.js');

let callbackInstance = null;
let callbackHandler = null;

const plugin = {
  id: "wecomtool",
  name: "WeCom Tool (企业微信工具)",
  description: "企业微信 API 工具集，支持回调处理和 32 个 API 模块",
  configSchema: {
    type: "object",
    properties: {
      corpId: { type: "string" },
      corpSecret: { type: "string" },
      agentId: { type: "string" },
      token: { type: "string" },
      encodingAESKey: { type: "string" },
    },
  },

  /**
   * 注册插件
   */
  register(api) {
    console.log('[wecomtool] 插件注册中...');

    // 加载配置
    const config = getConfig();
    
    // 初始化回调处理实例
    if (config.corpId && config.corpSecret && config.agentId) {
      callbackInstance = new CallbackClass(config);
      console.log('[wecomtool] 回调处理已初始化');
    } else {
      console.log('[wecomtool] 配置不完整，跳过回调初始化');
    }
    
    // 初始化统计模块
    let contactStats = null;
    if (config.corpId && config.corpSecret) {
      contactStats = new ContactStats(config);
      console.log('[wecomtool] 统计模块已初始化');
    }
    
    // 初始化通讯录缓存模块
    let addressBookCache = null;
    let addressBook = null;
    if (config.corpId && config.corpSecret) {
      addressBook = new AddressBook(config);
      addressBookCache = new AddressBookCache(config, {
        onConfirm: () => {
          // 用户确认后开始同步
          addressBookCache.syncFromAPI(addressBook);
        }
      });
      
      // 检查是否需要同步
      // 如果缓存文件已存在，标记为已同步（无需用户再确认）
      if (addressBookCache.getSyncStatus().lastSyncTime) {
        addressBookCache.syncConfirmed = true;
      }
      const syncStatus = addressBookCache.requestSync();
      
      if (syncStatus.needConfirm) {
        console.log('[wecomtool] 通讯录缓存未初始化，请回复"同步通讯录"开始同步');
        // 不自动同步，等待用户确认
      } else if (syncStatus.alreadySynced) {
        console.log('[wecomtool] 通讯录缓存已就绪');
      }
    }

    // 创建回调处理器
    callbackHandler = createCallbackHandler({
      callbackInstance,
      mode: config.callbackMode || 'independent',
      alwaysReturnSuccess: true,
      onMessage: (message, info) => {
        const eventType = message.Event || message.MsgType || 'unknown';
        const fromUser = message.FromUserName || 'unknown';
        
        if (callbackInstance && callbackInstance._recordEvent) {
          callbackInstance._recordEvent({
            type: eventType,
            fromUserName: fromUser,
            raw: message,
            timestamp: Date.now(),
            mode: info.mode,
          });
        }
        
        // 更新客户统计（从事件回调收集）
        if (contactStats && message.Event) {
          contactStats.updateTodayStats(message.Event, {
            userId: message.UserID || message.FromUserName,
            externalUserId: message.ExternalUserID || message.ExternalUserName,
            state: message.State,
          });
          
          // 记录统计日志
          if (['add_external_contact', 'del_external_contact', 'change_external_contact'].includes(message.Event)) {
            console.log(`[wecomtool] 客户统计: ${message.Event} - ${message.UserID || 'unknown'}`);
          }
        }
        
        // 更新通讯录缓存（事件驱动）
        if (addressBookCache && message.Event) {
          switch (message.Event) {
            case 'change_member':
              addressBookCache.onUserUpdate({
                userid: message.UserID,
                name: message.Name,
                // 其他字段
              });
              break;
            case 'change_department':
              addressBookCache.onDepartmentUpdate({
                id: message.Id,
                name: message.Name,
                parentid: message.ParentId,
              });
              break;
          }
        }
        
        console.log(`[wecomtool] 事件: ${eventType} from ${fromUser}`);
      },
    });

    // 注册 HTTP 路由
    api.registerHttpRoute({
      path: "/plugins/wecomtool/callback",
      handler: callbackHandler,
      auth: "plugin",
      match: "prefix",
    });

    // 兼容旧路径
    api.registerHttpRoute({
      path: "/wecomtool/callback",
      handler: callbackHandler,
      auth: "plugin",
      match: "prefix",
    });

    console.log('[wecomtool] 插件注册完成');
  },
};

module.exports = plugin;
