/**
 * 企业微信插件 - 配置加载器
 * 
 * 使用方法：
 * 1. 编辑 config.json 填入配置
 * 2. const wecom = require('./config').createWecom();
 */

const fs = require('fs');
const path = require('path');

// 读取配置文件
const configPath = path.join(__dirname, 'config.json');
let fileConfig = {};

if (fs.existsSync(configPath)) {
  try {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('配置文件读取失败:', e.message);
  }
}

/**
 * 创建企业微信插件实例
 * @param {object} overrideConfig 覆盖配置
 * @returns {WeComPlugin}
 */
function createWecom(overrideConfig = {}) {
  const WeComPlugin = require('./src/index');
  
  // 合并配置：文件配置 < 环境变量 < 代码传入
  const config = {
    ...fileConfig,
    ...overrideConfig,
    // 环境变量优先
    corpId: process.env.WECOM_CORP_ID || fileConfig.corpId || overrideConfig.corpId,
    corpSecret: process.env.WECOM_CORP_SECRET || fileConfig.corpSecret || overrideConfig.corpSecret,
    agentId: process.env.WECOM_AGENT_ID || fileConfig.agentId || overrideConfig.agentId,
    token: process.env.WECOM_TOKEN || fileConfig.token || overrideConfig.token,
    encodingAESKey: process.env.WECOM_ENCODING_AES_KEY || fileConfig.encodingAESKey || overrideConfig.encodingAESKey,
  };
  
  // 验证必填配置
  if (!config.corpId || config.corpId === 'YOUR_CORP_ID') {
    throw new Error('请先在 config.json 中配置 corpId（企业ID）');
  }
  if (!config.corpSecret || config.corpSecret === 'YOUR_CORP_SECRET') {
    throw new Error('请先在 config.json 中配置 corpSecret（应用Secret）');
  }
  if (!config.agentId || config.agentId === 'YOUR_AGENT_ID') {
    throw new Error('请先在 config.json 中配置 agentId（应用AgentID）');
  }
  
  return new WeComPlugin(config);
}

/**
 * 获取配置（完整版，供插件使用）
 */
function getConfig() {
  return {
    ...fileConfig,
    corpId: process.env.WECOM_CORP_ID || fileConfig.corpId,
    corpSecret: process.env.WECOM_CORP_SECRET || fileConfig.corpSecret,
    agentId: process.env.WECOM_AGENT_ID || fileConfig.agentId,
    token: process.env.WECOM_TOKEN || fileConfig.token,
    encodingAESKey: process.env.WECOM_ENCODING_AES_KEY || fileConfig.encodingAESKey,
  };
}

module.exports = {
  createWecom,
  getConfig,
  config: fileConfig
};
