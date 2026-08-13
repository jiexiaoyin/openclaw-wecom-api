/**
 * AddressBook 模块集成测试
 * 覆盖: 核心 cache 方法 (本轮 v1.5.2 P0-cache-extend 新加 cache 验证)
 *
 * 模式: 实例化 + 方法计数 + cache 命中率 + stub URL 锁定
 * 按 customer.test.js 范例, 按 2026-07-15 15:28 老板指令 P1
 *
 * @author openclaw-bot 2026-07-15
 */

const assert = require('assert');
const AddressBook = require('../sdk/modules/addressbook');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/5] 实例化 AddressBook');
  const ab = new AddressBook({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(ab instanceof AddressBook, 'instance check');
  console.log('    ✓ AddressBook instance created');

  console.log('\n[2/5] 验证全部 async 方法存在');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/addressbook'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个`);
  for (const fn of methodNames) {
    assert.strictEqual(typeof ab[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/5] cache 实例验证 (v1.5.2 P0-cache-extend)');
  assert.ok(ab._userCache instanceof Map, '_userCache 应该是 Map');
  assert.ok(ab._userDetailCache instanceof Map, '_userDetailCache 应该是 Map');
  assert.ok(ab._deptCache instanceof Map, '_deptCache 应该是 Map');
  console.log('    ✓ _userCache: Map, _userDetailCache: Map, _deptCache: Map');

  console.log('\n[4/5] Stub request + 验证 cache 行为 (5 个本轮加 cache 的方法)');
  const stubs = [];
  let callCount = 0;
  ab.request = async (method, url, data) => {
    callCount += 1;
    stubs.push({ method, url, data });
    return { errcode: 0, errmsg: 'ok', userlist: [{ userid: 'u1' }], department: { id: 1, name: 'IT' } };
  };

  // 第一次: 不应命中 cache, 应走网络
  stubs.length = 0;
  callCount = 0;
  await ab.getDepartmentUsers(1);
  assert.strictEqual(callCount, 1, '首次 getDepartmentUsers 应走 1 次网络');
  assert.strictEqual(stubs[0].url, '/user/simplelist', 'getDepartmentUsers URL');
  console.log('    ✓ getDepartmentUsers 首次 → POST /user/simplelist');

  // 第二次: 应命中 cache, 不走网络
  stubs.length = 0;
  callCount = 0;
  await ab.getDepartmentUsers(1);
  assert.strictEqual(callCount, 0, '第二次 getDepartmentUsers 应命中 cache, 0 次网络');
  console.log('    ✓ getDepartmentUsers 二次 → cache hit (0 network calls)');

  // 验证 4 个新 cache 方法 URL
  stubs.length = 0;
  await ab.getUser('ZhuYun');
  assert.strictEqual(stubs[0].method, 'GET', 'getUser method');
  assert.strictEqual(stubs[0].url, '/user/get', 'getUser URL');
  console.log('    ✓ getUser → GET /user/get');

  stubs.length = 0;
  await ab.getDepartmentUsersDetail(1);
  assert.strictEqual(stubs[0].url, '/user/list', 'getDepartmentUsersDetail URL');
  console.log('    ✓ getDepartmentUsersDetail → GET /user/list');

  stubs.length = 0;
  await ab.getUserIdList(1);
  assert.strictEqual(stubs[0].url, '/user/list_id', 'getUserIdList URL');
  console.log('    ✓ getUserIdList → GET /user/list_id');

  stubs.length = 0;
  await ab.getDepartmentDetail(1);
  assert.strictEqual(stubs[0].url, '/department/get', 'getDepartmentDetail URL');
  console.log('    ✓ getDepartmentDetail → GET /department/get');

  console.log('\n[5/5] flushCache 行为验证 (事件路由: change_type → flush)');
  // 先 flush 保证起点干净
  ab.flushCache();
  assert.strictEqual(ab._userCache.size, 0, 'flush 后起点应为 0');
  assert.strictEqual(ab._userDetailCache.size, 0, 'flush 后起点应为 0');

  // 加载 2 个不同 cache
  await ab.getDepartmentUsers(1);
  await ab.getUser('test_user');
  assert.strictEqual(ab._userCache.size, 1, '应有 1 条 _userCache (cacheKey=1_0)');
  assert.strictEqual(ab._userDetailCache.size, 1, '应有 1 条 _userDetailCache (cacheKey=test_user)');
  console.log(`    cache 状态: _userCache.size=${ab._userCache.size}, _userDetailCache.size=${ab._userDetailCache.size}`);

  // flush
  const r = ab.flushCache();
  assert.strictEqual(r.flushed, true, 'flushCache 应返回 flushed=true');
  assert.strictEqual(ab._userCache.size, 0, 'flush 后 _userCache 应清空');
  assert.strictEqual(ab._userDetailCache.size, 0, 'flush 后 _userDetailCache 应清空');
  console.log(`    ✓ flushCache → before=${JSON.stringify(r.before)} → after=cleared`);

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
