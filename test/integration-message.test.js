/**
 * Message 模块集成测试
 * 覆盖: sdk/modules/message/index.js 暴露的 SDK methods
 * 模式: stub this.request + URL 锁定验证
 *
 * @author openclaw-bot 2026-07-16
 */

const assert = require('assert');
const Message = require('../sdk/modules/message');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/4] 实例化 Message');
  const m = new Message({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(m instanceof Message, 'instance check');
  console.log('    ✓ Message instance created');

  console.log('\n[2/4] 验证全部 async 方法存在');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/message'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个: ${methodNames.join(', ')}`);
  for (const fn of methodNames) {
    assert.strictEqual(typeof m[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/4] Stub request + 验证 URL 锁定 (4 个 case)');
  const stubs = [];
  m.request = async (method, url, data) => {
    stubs.push({ method, url, data });
    return { errcode: 0, errmsg: 'ok' };
  };

  // Case 1: sendTextMessage / sendImageMessage
  stubs.length = 0;
  await m.sendText('user_001', 'Hello', 1000001);
  assert.strictEqual(stubs[0].method, 'POST', 'sendText method');
  assert.strictEqual(stubs[0].url, '/message/send', 'sendText URL');
  assert.deepStrictEqual(stubs[0].data, {
    touser: 'user_001', agentid: 1000001, msgtype: 'text', text: { content: 'Hello' }
  });
  console.log('    ✓ sendText → POST /message/send {text:{content}}');

  stubs.length = 0;
  await m.sendImage('user_002', 'media_id_xxx', 1000001);
  assert.strictEqual(stubs[0].url, '/message/send', 'sendImage URL');
  assert.strictEqual(stubs[0].data.msgtype, 'image', 'sendImage msgtype');
  assert.strictEqual(stubs[0].data.image.media_id, 'media_id_xxx', 'sendImage media_id');
  console.log('    ✓ sendImage → POST /message/send {image:{media_id}}');

  // Case 2: getMessagesHistory (拉取消息历史)
  stubs.length = 0;
  await m.getChat('chat_id_abc');
  assert.strictEqual(stubs[0].method, 'POST', 'getChat method');
  assert.strictEqual(stubs[0].url, '/appchat/get', 'getChat URL');
  assert.strictEqual(stubs[0].data.chatid, 'chat_id_abc', 'getChat chatid');
  console.log('    ✓ getChat → POST /appchat/get');

  // Case 3: recallMessage
  stubs.length = 0;
  await m.recallMessage('msgid_xyz_123');
  assert.strictEqual(stubs[0].method, 'POST', 'recallMessage method');
  assert.strictEqual(stubs[0].url, '/message/recall', 'recallMessage URL');
  assert.strictEqual(stubs[0].data.msgid, 'msgid_xyz_123', 'recallMessage msgid');
  console.log('    ✓ recallMessage → POST /message/recall');

  // Case 4: createChat + sendChatMessage
  stubs.length = 0;
  await m.createChat('测试群', 'user_leader', ['u1', 'u2']);
  assert.strictEqual(stubs[0].url, '/appchat/create', 'createChat URL');
  assert.strictEqual(stubs[0].data.name, '测试群', 'createChat name');
  assert.deepStrictEqual(stubs[0].data.userlist, ['u1', 'u2'], 'createChat userlist');
  console.log('    ✓ createChat → POST /appchat/create');

  stubs.length = 0;
  await m.sendChatMessage('chat_id_abc', { content: 'hi' }, 'text');
  assert.strictEqual(stubs[0].url, '/appchat/send', 'sendChatMessage URL');
  assert.strictEqual(stubs[0].data.chatid, 'chat_id_abc', 'sendChatMessage chatid');
  console.log('    ✓ sendChatMessage → POST /appchat/send');

  console.log('\n[4/4] 其他关键方法 URL 验证');
  const checkList = [
    { name: 'sendVoice', args: ['user_001', 'voice_media', 1], url: '/message/send', check: d => d.msgtype === 'voice' },
    { name: 'sendVideo', args: ['user_001', 'video_media', 1], url: '/message/send', check: d => d.msgtype === 'video' },
    { name: 'sendFile', args: ['user_001', 'file_media', 1], url: '/message/send', check: d => d.msgtype === 'file' },
    { name: 'sendMarkdown', args: ['user_001', '**bold**', 1], url: '/message/send', check: d => d.msgtype === 'markdown' },
    { name: 'updateTemplateCard', args: ['u1', 1, 'resp_code', {}], url: '/message/update_template_card' },
    { name: 'getOpenChatList', args: [], url: '/openchat/list' },
    { name: 'updateChat', args: ['chat_xyz', { name: '新群名' }], url: '/appchat/update' },
    { name: 'getOpenChatDetail', args: ['open_chat_xyz'], url: '/openchat/get' },
  ];
  for (const tc of checkList) {
    stubs.length = 0;
    await m[tc.name](...tc.args);
    const hit = stubs.find(s => s.url.includes(tc.url));
    assert.ok(hit, `${tc.name} 未命中 URL=${tc.url}, stubs=${stubs.map(s => s.url).join(',')}`);
    if (tc.check) assert.ok(tc.check(hit.data), `${tc.name} data check failed`);
    const urlOk = tc.fullUrl ? hit.url.includes(tc.url) : hit.url.endsWith(tc.url);
    assert.ok(urlOk, `${tc.name}: expected ${tc.url} but got ${hit.url}`);
    console.log(`    ✓ ${tc.name} → ${hit.method} ${hit.url}`);
  }

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
