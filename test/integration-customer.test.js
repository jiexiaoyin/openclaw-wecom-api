/**
 * Customer 模块集成测试 (v3 - stub request 而非 post)
 * 覆盖: 7 个 async 方法
 * 
 * 发现 1: Customer.getCustomerList 内部调 this.get → this.request → this.getAccessToken
 *   → 真实网络调用 → 测试必须 stub this.request
 * 
 * @author openclaw-bot 2026-07-15
 */

const assert = require('assert');
const Customer = require('../sdk/modules/customer');

// 通用工具: 过滤掉 JS 关键字和 super
function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/3] 实例化 Customer');
  const c = new Customer({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(c instanceof Customer, 'instance check');
  console.log('    ✓ Customer instance created');

  console.log('\n[2/3] 验证 7 个对外方法存在');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/customer'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个: ${methodNames.join(', ')}`);
  for (const fn of methodNames) {
    assert.strictEqual(typeof c[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/3] Stub request + 验证 URL 锁定');
  // 关键: 实际走 this.get / this.post → this.request, 必须 stub this.request
  const stubs = [];
  c.request = async (method, url, data) => { stubs.push({ method, url, data }); return { errcode: 0, errmsg: 'ok' }; };

  const tcs = [
    { name: 'getCustomerList', args: ['UserZhuYun'], method: 'GET', url: '/externalcontact/list' },
    { name: 'getCustomerDetail', args: ['ext_abc123'], method: 'GET', url: '/externalcontact/get' },
    { name: 'batchGetByUser', args: [['u1', 'u2']], method: 'POST', url: '/externalcontact/batch/get_by_user' },
    { name: 'getGroupChatList', args: [0, '', 100, ''], method: 'POST', url: '/externalcontact/groupchat/list' },
    { name: 'getGroupChat', args: ['chat_id_xxx'], method: 'POST', url: '/externalcontact/groupchat/get' },
    { name: 'getCorpTagList', args: [], method: 'GET', url: '/externalcontact/get_corp_tag_list' },
    { name: 'markTag', args: ['ext_abc', ['tag1'], 'user_xy', 'add'], method: 'POST', url: '/externalcontact/mark_tag' },
  ];

  for (const tc of tcs) {
    stubs.length = 0;
    await c[tc.name](...tc.args);
    assert.strictEqual(stubs[0].method, tc.method, `${tc.name} method 应为 ${tc.method}`);
    assert.strictEqual(stubs[0].url, tc.url, `${tc.name} URL 应为 ${tc.url}`);
    console.log(`    ✓ ${tc.name} → ${tc.method} ${tc.url}`);
  }

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
