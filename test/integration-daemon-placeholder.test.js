/**
 * Daemon placeholder corpSecret 检测集成测试 (A3)
 * 验证: daemon 启动时检测 corpSecret.startsWith('__WAITING_FOR') 抛错 + exit 1
 * 
 * 风险: daemon 启动后无 token, 回调 401 刷屏, 老板手机收到 N 条告警
 * 修复: 与 CLI line 115 同步, 启动前主动检测
 * 
 * @author openclaw-bot 2026-07-15
 * @see audit-2026-07-15.md § "CLI --config 跳过 placeholder 抛错，但 daemon 没同样保护"
 */

const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DAEMON = path.join(__dirname, '..', 'bin', 'wecom-daemon.js');

function runDaemonWithConfig(config, env = {}) {
  return new Promise((resolve) => {
    const tmpConfig = path.join(os.tmpdir(), `daemon-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(tmpConfig, JSON.stringify(config));
    
    const child = spawn('node', [DAEMON], {
      env: { ...process.env, WECOM_CONFIG: tmpConfig, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    let stderr = '';
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    
    // 2 秒超时, 因为 daemon 正常启动后会持续运行
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, 2000);
    
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      fs.rmSync(tmpConfig, { force: true });
      resolve({ code, signal, stdout, stderr });
    });
  });
}

async function main() {
  console.log('[1/3] 测试 placeholder corpSecret → daemon 应 exit 1 + 提示信息');
  // 构造 __WAITING_FOR 占位 config
  const placeholderConfig = {
    corpId: 'wwYOUR_CORP_ID',
    agentId: '1000040',
    corpSecret: '__WAITING_FOR_BOSS_TO_FILL_REAL_VALUE',
    callback: {
      token: 'gg3vsDz8Er',
      encodingAESKey: 'bkHQ9uP',
    },
  };
  const r1 = await runDaemonWithConfig(placeholderConfig);
  assert.strictEqual(r1.code, 1, `应 exit(1), 实际: ${r1.code} (signal=${r1.signal})`);
  assert.match(r1.stderr, /corpSecret.*未下发|corpSecret 还未下发/, `应输出 placeholder 提示, 实际 stderr: ${r1.stderr}`);
  console.log(`    ✓ exit(1) + 提示信息到位`);

  console.log('\n[2/3] 测试真实 corpSecret → daemon 应能启动监听 (timeout kill → code=0 graceful)');
  // 用真实 corpSecret (不需要真 token 验证, 只需要 daemon 不被 placeholder 拦)
  const realConfig = {
    corpId: 'wwYOUR_CORP_ID',
    agentId: '1000040',
    corpSecret: 'g0m2_REAL_SECRET_PLACEHOLDER_FOR_TEST',  // 任意非 __WAITING_FOR 字符串
    callback: {
      token: 'gg3vsDz8Er',
      encodingAESKey: 'bkHQ9uP',
      port: 18791,  // 用不同端口, 不和真实 daemon 冲突
    },
  };
  const r2 = await runDaemonWithConfig(realConfig);
  // daemon 启动后 SIGTERM 触发 graceful shutdown, code=0 是正常退出
  assert.strictEqual(r2.code, 0, `应 graceful exit (code=0), 实际: ${r2.code} (signal=${r2.signal})`);
  assert.match(r2.stdout, /listening on 127\.0\.0\.1:18791/, `应输出 listening 日志, 实际 stdout: ${r2.stdout}`);
  console.log(`    ✓ 真实 corpSecret → daemon 启动 + listening 日志正常 (graceful SIGTERM exit 0)`);

  console.log('\n[3/3] 测试缺 callback.token → daemon 应 exit 1 + 提示信息 (回归保护)');
  const noTokenConfig = {
    corpId: 'wwYOUR_CORP_ID',
    agentId: '1000040',
    corpSecret: 'real_secret_value',
    callback: {
      // 故意缺 token / encodingAESKey
      port: 18792,
    },
  };
  const r3 = await runDaemonWithConfig(noTokenConfig);
  assert.strictEqual(r3.code, 1, `缺 token 应 exit(1), 实际: ${r3.code}`);
  assert.match(r3.stderr, /callback\.token|encodingAESKey/, `应输出 callback 缺失提示, 实际 stderr: ${r3.stderr}`);
  console.log(`    ✓ 缺 callback.token → exit(1) + 提示到位 (回归保护)`);

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
