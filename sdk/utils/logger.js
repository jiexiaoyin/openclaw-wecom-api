/**
 * 统一日志模块 v1.1 (P3 升级: setEnabled / setLevel API)
 * 
 * 设计:
 * - debug/info/warn/error 4 个 level (对齐 05-21 implicit "**日志分级输出**")
 * - 支持 module prefix: logger('contact_stats').warn(...)
 * - 兼容 console.* 签名 (同一 interface, 易替换)
 * - 0 依赖, 纯 node 实现
 * 
 * 用法:
 *   const logger = require('../utils/logger');
 *   const log = logger('contact_stats');
 *   log.warn('message');
 *   log.error('failed', err);
 * 
 * P3 新增 API (2026-07-26):
 *   logger.setEnabled(false)  // 全局静默 (用于 JSON 模式抑制)
 *   logger.setLevel('debug')  // 全局改级别 (env WECOM_LOG_LEVEL 同效)
 *   logger.isEnabled()        // 查询当前状态
 * 
 * 环境变量:
 *   WECOM_LOG_LEVEL=debug|info|warn|error  (默认 info)
 *   WECOM_LOG_ENABLED=0|1                  (默认 1, 用于 systemd quiet mode)
 * 
 * @author openclaw-bot 2026-07-15
 * @see audit-2026-07-15.md § "85 处 console.* 应抽 logger.js"
 * @see P3-upgrade-2026-07-26 (setEnabled/setLevel API)
 */

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// 默认从环境变量读取 (WECOM_LOG_LEVEL = info, WECOM_LOG_ENABLED = true)
// 可在运行时通过 setLevel/setEnabled 覆盖
let ACTIVE_LEVEL = LEVELS[(process.env.WECOM_LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;
let ENABLED = process.env.WECOM_LOG_ENABLED !== '0';

function shouldLog(level) {
  if (!ENABLED) return false;
  return (LEVELS[level] || 0) >= ACTIVE_LEVEL;
}

function format(prefix, level, args) {
  const ts = new Date().toISOString();
  const msg = args.map(a => {
    if (a instanceof Error) return `${a.message}`;
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }).join(' ');
  return `${ts} [${level.toUpperCase()}] [${prefix}] ${msg}`;
}

function createLogger(prefix) {
  return {
    debug: (...args) => { if (shouldLog('debug')) console.error(format(prefix, 'debug', args)); },
    info: (...args) => { if (shouldLog('info')) console.error(format(prefix, 'info', args)); },
    warn: (...args) => { if (shouldLog('warn')) console.error(format(prefix, 'warn', args)); },
    error: (...args) => { if (shouldLog('error')) console.error(format(prefix, 'error', args)); },
  };
}

// P3 新增: 全局开关 (用于 JSON 模式 / systemd quiet mode)
function setEnabled(enabled) {
  ENABLED = !!enabled;
}

// P3 新增: 全局级别
function setLevel(level) {
  const l = (level || '').toLowerCase();
  if (LEVELS[l] !== undefined) {
    ACTIVE_LEVEL = LEVELS[l];
    return true;
  }
  return false;
}

function isEnabled() {
  return ENABLED;
}

// 默认导出 (支持 default 调用)
module.exports = createLogger;
// 也支持 named export (兼容 logger.info 等用法)
module.exports.createLogger = createLogger;
module.exports.LEVELS = LEVELS;
module.exports.shouldLog = shouldLog;
// P3 新增 exports
module.exports.setEnabled = setEnabled;
module.exports.setLevel = setLevel;
module.exports.isEnabled = isEnabled;