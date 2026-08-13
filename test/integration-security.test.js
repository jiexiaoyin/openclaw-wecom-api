/**
 * Security 模块集成测试
 * 覆盖: 核心 8 个 async 方法 (v1.5.2 P1)
 *
 * 模式: 实例化 + 方法计数 + stub request → URL 锁定
 * 按 customer.test.js 范例, 按 2026-07-15 15:28 老板指令 P1
 *
 * @author openclaw-bot 2026-07-15
 */

const assert = require('assert');
const Security = require('../sdk/modules/security');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/4] 实例化 Security');
  const s = new Security({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(s instanceof Security, 'instance check');
  console.log('    ✓ Security instance created');

  console.log('\n[2/4] 验证全部 async 方法存在');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/security'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个: ${methodNames.join(', ')}`);
  for (const fn of methodNames) {
    assert.strictEqual(typeof s[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/4] Stub request + 验证 URL 锁定 (核心 read 方法)');
  const stubs = [];
  s.request = async (method, url, data) => {
    stubs.push({ method, url, data });
    return { errcode: 0, errmsg: 'ok' };
  };

  const tcs = [
    { name: 'getDlpRules', args: [0, 100], method: 'POST', url: '/dlp/rules/list' },
    { name: 'getDlpRuleDetail', args: ['rule_001'], method: 'POST', url: '/dlp/rules/get' },
    { name: 'getDeviceList', args: ['', 0, 100], method: 'POST', url: '/device/list' },
    { name: 'getDeviceDetail', args: ['dev_abc'], method: 'POST', url: '/device/get' },
    { name: 'getScreenCaptureRule', args: [], method: 'POST', url: '/device/screen_capture/get' },
    { name: 'getAdminOperationLog', args: [1700000000, 1800000000], method: 'POST', url: '/security/get_admin_operation_log' },
    { name: 'getCallbackIpList', args: [], method: 'GET', url: '/getcallbackip' },
    { name: 'getDomainIpList', args: [], method: 'POST', url: '/security/get_domain_ip_list' },
  ];

  for (const tc of tcs) {
    stubs.length = 0;
    await s[tc.name](...tc.args);
    assert.strictEqual(stubs[0].method, tc.method, `${tc.name} method 应为 ${tc.method}`);
    assert.strictEqual(stubs[0].url, tc.url, `${tc.name} URL 应为 ${tc.url}`);
    console.log(`    ✓ ${tc.name} → ${tc.method} ${tc.url}`);
  }

  console.log('\n[4/4] 验证 write 方法鉴权参数传递正确');
  stubs.length = 0;
  await s.setScreenCaptureRule(1, 'user1|user2', '');
  assert.strictEqual(stubs[0].url, '/device/screen_capture/set', 'setScreenCaptureRule URL');
  assert.strictEqual(stubs[0].data.status, 1, 'status 应该传出');
  console.log('    ✓ setScreenCaptureRule → POST /device/screen_capture/set status=1');

  stubs.length = 0;
  await s.createDlpRule({ name: 'test-rule', rule_type: 1 });
  assert.strictEqual(stubs[0].url, '/dlp/rules/add', 'createDlpRule URL');
  assert.strictEqual(stubs[0].data.name, 'test-rule', 'rule.name 应该传出');
  console.log('    ✓ createDlpRule → POST /dlp/rules/add name=test-rule');

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
