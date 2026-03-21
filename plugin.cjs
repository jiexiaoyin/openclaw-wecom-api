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

// 导入回调工具函数
const { createStandardHandler } = require('./src/utils/callback-helper.js');

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

    // 创建回调处理器
    callbackHandler = createStandardHandler(callbackInstance, (message, info) => {
      // 事件记录
      const eventType = message.Event || message.MsgType || 'unknown';
      const fromUser = message.FromUserName || 'unknown';
      
      if (callbackInstance && callbackInstance._recordEvent) {
        callbackInstance._recordEvent({
          type: eventType,
          fromUserName: fromUser,
          raw: message,
          timestamp: Date.now(),
          encrypted: info.encrypted,
        });
      }
      
      console.log(`[wecomtool] 事件: ${eventType} from ${fromUser}`);
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
