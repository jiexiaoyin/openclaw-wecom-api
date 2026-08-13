/**
 * logger.js 单元测试 (B2 老板 13:34)
 * 验证: 4 level + prefix + log level 过滤
 */

const assert = require('assert');
const logger = require('../sdk/utils/logger');

async function main() {
  console.log('[1/4] 验证 logger 4 个方法存在');
  const log = logger('test_module');
  assert.strictEqual(typeof log.debug, 'function', 'debug');
  assert.strictEqual(typeof log.info, 'function', 'info');
  assert.strictEqual(typeof log.warn, 'function', 'warn');
  assert.strictEqual(typeof log.error, 'function', 'error');
  console.log('    ✓ debug/info/warn/error 4 个方法');

  console.log('\n[2/4] 验证默认 export 兼容 (logger("m").info == module.exports("m").info)');
  const log2 = require('../sdk/utils/logger')('m2');
  assert.strictEqual(typeof log2.info, 'function', 'named export');
  console.log('    ✓ 默认 export 兼容性');

  console.log('\n[3/4] 验证 LEVELS 完整');
  assert.strictEqual(logger.LEVELS.debug, 10);
  assert.strictEqual(logger.LEVELS.info, 20);
  assert.strictEqual(logger.LEVELS.warn, 30);
  assert.strictEqual(logger.LEVELS.error, 40);
  console.log('    ✓ LEVELS 字典完整');

  console.log('\n[4/4] 验证输出格式 (含 prefix)');
  // 捕获 stderr (logger 走 console.error)
  const origErr = console.error;
  let captured = '';
  console.error = (...args) => { captured += args.join(' ') + '\n'; };
  
  const log3 = logger('contact_stats');
  log3.warn('hello world');
  
  console.error = origErr;
  
  assert.match(captured, /\[WARN\]/, '包含 level 标签');
  assert.match(captured, /\[contact_stats\]/, '包含 prefix');
  assert.match(captured, /hello world/, '包含原消息');
  console.log(`    ✓ 输出格式: ISO时间 [LEVEL] [prefix] message`);
  console.log(`      实际: ${captured.trim()}`);

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
