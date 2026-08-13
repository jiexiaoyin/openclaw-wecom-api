/**
 * Messenger 模块集成测试
 * 覆盖: 12 个 async 方法 (群发/欢迎语场景, 上传类走 form-data 不测)
 *
 * 模式: 实例化 + 方法计数 + stub URL 锁定
 * 按 customer.test.js 范例, 按 2026-07-15 15:31 老板指令 P2
 *
 * @author openclaw-bot 2026-07-15
 */

const assert = require('assert');
const Messenger = require('../sdk/modules/messenger');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/3] 实例化 Messenger');
  const m = new Messenger({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(m instanceof Messenger, 'instance check');
  console.log('    ✓ Messenger instance created');

  console.log('\n[2/3] 验证全部 async 方法存在');
  const fs = require('fs');
  const path = require('path');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/messenger'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个: ${methodNames.join(', ')}`);
  for (const fn of methodNames) {
    assert.strictEqual(typeof m[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/3] Stub request + 验证 URL 锁定');
  const stubs = [];
  m.request = async function (...args) {
    // 适配 (method,url,data) 和 (url,data)
    let entry;
    if (args.length === 3 && typeof args[0] === 'string') {
      entry = { method: args[0], url: args[1], data: args[2] };
    } else if (args.length === 2) {
      entry = { method: 'POST', url: args[0], data: args[1] };
    } else {
      entry = args[0];
    }
    stubs.push(entry);
    return { errcode: 0, errmsg: 'ok' };
  };
  // messenger 内部 this.post 自动走 this.request, 多包一层
  m.post = async function (url, data) {
    return this.request('POST', url, data);
  };

  const tcs = [
    { name: 'createMassMessage', args: ['user_a', { text: 'hello', msgType: 'text' }], method: 'POST', url: '/externalcontact/add_msg_template' },
    { name: 'getMassMessageList', args: [1700000000, 1800000000], method: 'POST', url: '/externalcontact/get' },
    { name: 'getMassMessageResult', args: ['msg_001'], method: 'POST', url: '/externalcontact/get_groupmsg_send_result' },
    { name: 'cancelMassMessage', args: ['msg_001'], method: 'POST', url: '/externalcontact/cancel_groupmsg_send' },
    { name: 'remindMassMessage', args: ['user_a', 'msg_001'], method: 'POST', url: '/externalcontact/remind_groupmsg_send' },
    { name: 'sendWelcomeMessage', args: ['welcome_code_abc', { text: 'welcome' }], method: 'POST', url: '/externalcontact/send_welcome_msg' },
    { name: 'getGroupWelcomeMedia', args: ['scene_001'], method: 'POST', url: '/externalcontact/group_welcome_template/get' },
    { name: 'setGroupWelcomeMedia', args: [{ scene_id: 'scene_001' }], method: 'POST', url: '/externalcontact/group_welcome_template/add' },
    { name: 'deleteGroupWelcomeMedia', args: ['scene_001'], method: 'POST', url: '/externalcontact/group_welcome_template/del' },
    { name: 'getMassMessageUsers', args: ['msg_001'], method: 'POST', url: '/externalcontact/get_groupmsg_task' },
  ];

  for (const tc of tcs) {
    stubs.length = 0;
    await m[tc.name](...tc.args);
    assert.strictEqual(stubs[0].method, tc.method, `${tc.name} method 应为 ${tc.method}`);
    assert.ok(stubs[0].url.includes(tc.url) || stubs[0].url === tc.url, `${tc.name} URL 应含 ${tc.url}, 实际=${stubs[0].url}`);
    console.log(`    ✓ ${tc.name} → ${stubs[0].method} ${stubs[0].url}`);
  }

  // 注意: messenger 有 2 个方法没测全 (uploadWelcomeMedia 需要 form-data)
  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
