/**
 * Meeting 模块集成测试 (v3 - 修 super 误判)
 */

const assert = require('assert');
const Meeting = require('../sdk/modules/meeting');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/3] 实例化 Meeting');
  const m = new Meeting({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(m instanceof Meeting, 'instance check');
  console.log('    ✓ Meeting instance created');

  console.log('\n[2/3] 自动统计所有 async 对外方法');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/meeting'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个 async 方法: ${methodNames.join(', ')}`);
  
  for (const fn of methodNames) {
    assert.strictEqual(typeof m[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/3] 锁定 URL 防止悄悄改');
  const stubs = [];
  m.request = async (method, url, data) => { stubs.push({ method, url, data }); return { errcode: 0 }; };

  // 3 个关键 URL 锁定
  await m.createMeeting({ topic: 'T', startTime: '2026-07-15T10:00:00Z', endTime: '2026-07-15T11:00:00Z' });
  assert.strictEqual(stubs[0].url, '/meeting/create', 'createMeeting URL');
  console.log('    ✓ createMeeting → /meeting/create');

  await m.cancelMeeting('MT123');
  assert.strictEqual(stubs[1].url, '/meeting/cancel', 'cancelMeeting URL');
  console.log('    ✓ cancelMeeting → /meeting/cancel');

  await m.muteMember('MT123', ['u1', 'u2'], true);
  assert.strictEqual(stubs[2].url, '/meeting/realcontrol/mute_user', 'muteMember URL');
  assert.strictEqual(stubs[2].data.mute_all, true, 'muteAll 透传');
  console.log('    ✓ muteMember → /meeting/realcontrol/mute_user (含 realcontrol 子路径)');

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
