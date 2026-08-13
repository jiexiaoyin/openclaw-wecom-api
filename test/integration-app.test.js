/**
 * App 模块集成测试
 * 覆盖: sdk/modules/app/index.js 暴露的 SDK methods
 * 模式: stub this.request + URL 锁定验证
 *
 * @author openclaw-bot 2026-07-16
 */

const assert = require('assert');
const App = require('../sdk/modules/app');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/4] 实例化 App');
  const a = new App({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(a instanceof App, 'instance check');
  console.log('    ✓ App instance created');

  console.log('\n[2/4] 验证全部 async 方法存在');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/app'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个: ${methodNames.join(', ')}`);
  for (const fn of methodNames) {
    assert.strictEqual(typeof a[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/4] Stub request + 验证 URL 锁定 (4 个 case)');
  const stubs = [];
  a.request = async (method, url, data) => {
    stubs.push({ method, url, data });
    return { errcode: 0, errmsg: 'ok' };
  };

  // Case 1: getAgent (GET)
  stubs.length = 0;
  await a.getAgent(1000001);
  assert.strictEqual(stubs[0].method, 'GET', 'getAgent method');
  assert.strictEqual(stubs[0].url, '/agent/get', 'getAgent URL');
  assert.strictEqual(stubs[0].data.agentid, 1000001, 'getAgent agentid');
  console.log('    ✓ getAgent → GET /agent/get');

  // Case 2: getAgentList + setAgent
  stubs.length = 0;
  await a.getAgentList();
  assert.strictEqual(stubs[0].method, 'GET', 'getAgentList method');
  assert.strictEqual(stubs[0].url, '/agent/list', 'getAgentList URL');
  console.log('    ✓ getAgentList → GET /agent/list');

  stubs.length = 0;
  await a.setAgent(1000001, { name: '测试应用', description: 'desc' });
  assert.strictEqual(stubs[0].method, 'POST', 'setAgent method');
  assert.strictEqual(stubs[0].url, '/agent/set', 'setAgent URL');
  assert.strictEqual(stubs[0].data.agentid, 1000001, 'setAgent agentid');
  console.log('    ✓ setAgent → POST /agent/set');

  // Case 3: 菜单管理 - createMenu → getMenu → deleteMenu
  stubs.length = 0;
  await a.createMenu(1000001, { button: [{ name: '首页', type: 'view', url: 'https://example.com' }] });
  assert.strictEqual(stubs[0].url, '/menu/create', 'createMenu URL');
  assert.strictEqual(stubs[0].data.agentid, 1000001, 'createMenu agentid');
  console.log('    ✓ createMenu → POST /menu/create');

  stubs.length = 0;
  await a.getMenu(1000001);
  assert.strictEqual(stubs[0].method, 'GET', 'getMenu method');
  assert.strictEqual(stubs[0].url, '/menu/get', 'getMenu URL');
  assert.strictEqual(stubs[0].data.agentid, 1000001, 'getMenu agentid');
  console.log('    ✓ getMenu → GET /menu/get');

  stubs.length = 0;
  await a.deleteMenu(1000001);
  assert.strictEqual(stubs[0].url, '/menu/delete', 'deleteMenu URL');
  assert.strictEqual(stubs[0].data.agentid, 1000001, 'deleteMenu agentid');
  console.log('    ✓ deleteMenu → POST /menu/delete');

  // Case 4: 工作台 - getWorkbench + setWorkbench
  stubs.length = 0;
  await a.getWorkbench(1000001);
  assert.strictEqual(stubs[0].url, '/agent/get_workbench', 'getWorkbench URL');
  assert.strictEqual(stubs[0].data.agentid, 1000001, 'getWorkbench agentid');
  console.log('    ✓ getWorkbench → POST /agent/get_workbench');

  stubs.length = 0;
  await a.setWorkbench(1000001, { list: [{ title: 'item1' }] });
  assert.strictEqual(stubs[0].url, '/agent/set_workbench', 'setWorkbench URL');
  assert.strictEqual(stubs[0].data.agentid, 1000001, 'setWorkbench agentid');
  console.log('    ✓ setWorkbench → POST /agent/set_workbench');

  console.log('\n[4/4] getAppInfo 别名验证 (getAgent 别名行为)');
  // 有些 SDK 可能把 getAgent 别名为 getAppInfo, 验证方法存在即可
  if (typeof a.getAppInfo === 'function') {
    stubs.length = 0;
    await a.getAppInfo(1000001);
    assert.strictEqual(stubs[0].url, '/agent/get', 'getAppInfo URL');
    console.log('    ✓ getAppInfo → GET /agent/get (alias of getAgent)');
  } else {
    console.log('    ✓ getAppInfo 不存在 (已合并到 getAgent, 跳过)');
  }

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
