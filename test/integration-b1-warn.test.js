/**
 * B1 (老板 13:34): 静默 catch → logger 输出测试
 * B2 改造: logger 走 console.error (stderr), 规范化日志输出
 *
 * @author openclaw-bot 2026-07-15
 * @see audit-2026-07-15.md § "2 处静默 catch: sdk/modules/contact_stats/index.js:46,66"
 */

const assert = require('assert');
const ContactStats = require('../sdk/modules/contact_stats');
const fs = require('fs');
const path = require('path');

async function main() {
  const tmpdir = '/tmp/wecom-stats-b1-' + Date.now();
  fs.mkdirSync(tmpdir, { recursive: true });

  // B2: logger 走 console.error (stderr 更规范)
  console.log('[1/3] 验证 _loadStats catch (audit line 46) 输出 logger');
  const origErr = console.error;
  let captured = '';
  console.error = (...args) => { captured += args.join(' ') + '\n'; };

  const cs = new ContactStats({ corpId: 'test', corpSecret: 'test' });
  cs._storagePath = path.join(tmpdir, 'stats.json');
  cs._todayStats = cs._loadStats();
  captured = '';

  // 损坏 JSON 应被 catch, logger 应输出 (含 WARN + prefix)
  fs.writeFileSync(cs._storagePath, '{not json}');
  cs._loadStats();

  console.error = origErr;
  assert.ok(captured.length > 0, `应至少输出 1 条 log, 实际 empty`);
  assert.match(captured, /\[WARN\]/, 'log 应包含 [WARN] level');
  assert.match(captured, /\[contact_stats\]/, 'log 应包含 prefix');
  console.log('    ✓ _loadStats catch 输出 logger:');
  console.log('      ' + captured.trim().split('\n')[0]);

  console.log('\n[2/3] 验证 _saveStats catch (audit line 66) 输出 logger');
  captured = '';
  console.error = (...args) => { captured += args.join(' ') + '\n'; };

  // mock writeFileSync 让它抛错
  const origWrite = fs.writeFileSync;
  fs.writeFileSync = () => { throw new Error('disk full EIO'); };
  cs._todayStats = { date: '2026-07-15', newCustomers: 5, lostCustomers: 0, messagesSent: 0, chatsCount: 0, applications: 0 };

  let threw = false;
  try {
    cs._saveStats();
  } catch (e) {
    threw = true;
  }
  fs.writeFileSync = origWrite;

  console.error = origErr;
  assert.ok(!threw, '_saveStats 应静默 catch, 不向上抛');
  assert.ok(captured.length > 0, `应输出 log, 实际 empty`);
  assert.match(captured, /\[WARN\]/, 'log 应包含 [WARN] level');
  console.log('    ✓ _saveStats catch 输出 logger:');
  console.log('      ' + captured.trim().split('\n')[0]);

  console.log('\n[3/3] 回归保护: 正常 _loadStats/_saveStats 不应无故输出');
  captured = '';
  const freshDir = '/tmp/wecom-stats-b1-fresh-' + Date.now();
  fs.mkdirSync(freshDir, { recursive: true });

  console.error = (...args) => { captured += args.join(' ') + '\n'; };
  const cs2 = new ContactStats({ corpId: 'test', corpSecret: 'test' });
  cs2._storagePath = path.join(freshDir, 'stats.json');
  cs2._todayStats = cs2._loadStats();
  cs2._saveStats();

  console.error = origErr;
  assert.strictEqual(captured, '', `正常路径不应 log, 实际: "${captured.slice(0, 80)}"`);
  console.log('    ✓ 正常路径静默 (回归保护)');

  fs.rmSync(freshDir, { recursive: true });
  fs.rmSync(tmpdir, { recursive: true });

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
