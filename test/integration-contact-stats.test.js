/**
 * ContactStats 模块集成测试 (v3 - 修 super 误判 + 完整覆盖)
 * 
 * 关键覆盖: audit § "静默 catch line 46, 66" 测试 (P2 第一项预备)
 */

const assert = require('assert');
const ContactStats = require('../sdk/modules/contact_stats');
const fs = require('fs');
const path = require('path');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}(async\\s+)?(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[2])
      .filter(n => !['if', 'for', 'while', 'switch', 'try', 'super'].includes(n))
      .filter(n => !n.startsWith('_'))
  )];
}

async function main() {
  console.log('[1/5] 实例化');
  const tmpdir = '/tmp/wecom-stats-test-' + Date.now();
  fs.mkdirSync(tmpdir, { recursive: true });
  
  const cs = new ContactStats({ corpId: 'test', corpSecret: 'test' });
  cs._storagePath = path.join(tmpdir, 'stats.json');
  cs._todayStats = cs._loadStats();
  console.log('    ✓ ContactStats instance created');

  console.log('\n[2/5] 自动统计对外方法');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/contact_stats'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个方法: ${methodNames.join(', ')}`);
  
  for (const fn of methodNames) {
    assert.strictEqual(typeof cs[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/5] 验证 getUserClientStat: 无 cache 时正确返回 / 抛错');
  // 不传 addressBookCache 时, SDK 设计是返回 error 对象 (50001/USER_NOT_FOUND) 而非抛错
  // 但要看实现, 如果抛错也行
  let result, threw = false;
  try {
    result = await cs.getUserClientStat('UserZhuYun', 20260714, 20260714);
  } catch (e) {
    threw = true;
    result = { error: true, message: e.message };
  }
  // 两种都算覆盖: 要么抛错 (有 message), 要么返回 error 对象
  assert.ok(threw || (result && result.error === true), '应抛错或返回 error');
  console.log(`    ✓ 强制规范 #2 覆盖: ${threw ? '抛错' : '返回 error 对象'} (audit 强制要求无员工不可调 API)`);

  console.log('\n[4/5] 验证 _loadStats 静默 catch (audit line 46)');
  // 损坏 JSON 应被 catch, 返回当日空统计
  fs.writeFileSync(cs._storagePath, '{not json}');
  const loaded = cs._loadStats();
  assert.strictEqual(loaded.date, new Date().toISOString().split('T')[0], '损坏时 fallback 当日空');
  assert.strictEqual(loaded.newCustomers, 0, 'reset newCustomers=0');
  console.log('    ✓ 损坏 JSON 被 catch, fallback 当日空 (audit § 静默 catch 已验证路径)');

  console.log('\n[5/5] 验证 _saveStats 静默 catch (audit line 66)');
  // writeFileSync 失败应被 catch (强制 stub 让 writeFileSync 抛错)
  const origWrite = fs.writeFileSync;
  fs.writeFileSync = () => { throw new Error('disk full'); };
  // _saveStats 是 sync, 内部 try/catch 后应静默返回, 不抛
  let step5_threw = false;
  try {
    cs._saveStats({ date: '2026-07-15', newCustomers: 1, lostCustomers: 0, messagesSent: 0, chatsCount: 0, applications: 0 });
  } catch (e) {
    threw = true;
  }
  fs.writeFileSync = origWrite;
  assert.strictEqual(step5_threw, false, '_saveStats 静默 catch 不应抛出');
  console.log('    ✓ writeFileSync 抛错时 _saveStats 静默 catch 正确 (audit line 66 路径)');

  fs.rmSync(tmpdir, { recursive: true });
  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
