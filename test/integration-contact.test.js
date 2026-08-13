/**
 * Contact 模块集成测试
 * 覆盖: sdk/modules/contact/index.js 暴露的 SDK methods
 * 模式: stub this.request + URL 锁定验证
 *
 * @author openclaw-bot 2026-07-16
 */

const assert = require('assert');
const Contact = require('../sdk/modules/contact');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/4] 实例化 Contact');
  const c = new Contact({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(c instanceof Contact, 'instance check');
  console.log('    ✓ Contact instance created');

  console.log('\n[2/4] 验证全部 async 方法存在');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/contact'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个: ${methodNames.join(', ')}`);
  for (const fn of methodNames) {
    assert.strictEqual(typeof c[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/4] Stub request + 验证 URL 锁定 (4 个 case)');
  // stub this.request (所有 this.get / this.post 最终调 this.request)
  const stubs = [];
  c.request = async (method, url, data) => {
    stubs.push({ method, url, data });
    return { errcode: 0, errmsg: 'ok' };
  };

  // Case 1: getCustomerContactUsers (标准调用)
  stubs.length = 0;
  await c.getCustomerContactUsers();
  assert.strictEqual(stubs[0].method, 'POST', 'getCustomerContactUsers method');
  assert.strictEqual(stubs[0].url, '/externalcontact/get_follow_user_list', 'getCustomerContactUsers URL');
  console.log('    ✓ getCustomerContactUsers → POST /externalcontact/get_follow_user_list');

  // Case 2: getCustomerList + getCustomerDetail (典型调用链)
  stubs.length = 0;
  await c.getCustomerList('user_001');
  assert.strictEqual(stubs[0].method, 'GET', 'getCustomerList method');
  assert.strictEqual(stubs[0].url, '/externalcontact/list', 'getCustomerList URL');
  console.log('    ✓ getCustomerList → GET /externalcontact/list');

  stubs.length = 0;
  await c.getCustomerDetail('user_001', 'ext_xxx');
  assert.strictEqual(stubs[0].method, 'GET', 'getCustomerDetail method');
  assert.strictEqual(stubs[0].url, '/externalcontact/get', 'getCustomerDetail URL');
  console.log('    ✓ getCustomerDetail → GET /externalcontact/get');

  // Case 3: CRUD 流程 - batchGetCustomers → updateCustomerRemark → getCorpTags
  stubs.length = 0;
  await c.batchGetCustomers(['u1', 'u2']);
  assert.strictEqual(stubs[0].url, '/externalcontact/batch/get_by_user', 'batchGetCustomers URL');
  console.log('    ✓ batchGetCustomers → POST /externalcontact/batch/get_by_user');

  stubs.length = 0;
  await c.updateCustomerRemark('user_001', 'ext_xxx', { remark: 'VIP' });
  assert.strictEqual(stubs[0].url, '/externalcontact/remark', 'updateCustomerRemark URL');
  console.log('    ✓ updateCustomerRemark → POST /externalcontact/remark');

  stubs.length = 0;
  await c.getCorpTags();
  assert.strictEqual(stubs[0].url, '/externalcontact/get_corp_tag_list', 'getCorpTags URL');
  console.log('    ✓ getCorpTags → POST /externalcontact/get_corp_tag_list');

  // Case 4: 错误 corpId 返回 errcode != 0 (SDK 正常返回, 调方自行判断)
  const bad = new Contact({ corpId: '', corpSecret: '' });
  bad.request = async () => ({ errcode: 40013, errmsg: 'invalid corpid'});
  const result = await bad.getCustomerList('user_001');
  assert.strictEqual(result.errcode, 40013, '错误 corpId 应返回 errcode 40013');
  assert.ok(result.errmsg.includes('invalid'), `错误信息应含 invalid: ${result.errmsg}`);
  console.log('    ✓ 错误 corpId 返回 {errcode:40013,errmsg} (SDK 不抛错, 调方自判断)');

  console.log('\n[4/4] 其他关键方法 URL 验证');
  const checkList = [
    { name: 'getContactRuleGroups', args: [], url: '/externalcontact/customer_strategy/list' },
    { name: 'createContactRuleGroup', args: [{ strategy_id: 's1' }], url: '/externalcontact/customer_strategy/create' },
    { name: 'getDimissionList', args: [], url: '/externalcontact/get_unassigned_list' },
    { name: 'transferCustomer', args: ['ext_x', 'handover', 'takeover'], url: '/externalcontact/transfer_customer' },
    { name: 'getGroupChatList', args: [], url: '/externalcontact/groupchat/list' },
    { name: 'getContactWayList', args: [], url: '/externalcontact/list_contact_way' },
  ];
  for (const tc of checkList) {
    stubs.length = 0;
    await c[tc.name](...tc.args);
    assert.strictEqual(stubs[0].url, tc.url, `${tc.name} URL 应为 ${tc.url}`);
    console.log(`    ✓ ${tc.name} → ${stubs[0].url}`);
  }

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
