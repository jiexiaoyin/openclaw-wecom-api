/**
 * Approval 模块集成测试
 * 覆盖: 核心 8 个 async 方法 (含 v1.5.2 batch3 新加的 oa 3 个)
 *
 * 模式: 实例化 + 方法计数 + stub URL 锁定 + 本轮新方法验证
 * 按 customer.test.js 范例, 按 2026-07-15 15:28 老板指令 P1
 *
 * @author openclaw-bot 2026-07-15
 */

const assert = require('assert');
const Approval = require('../sdk/modules/approval');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/4] 实例化 Approval');
  const a = new Approval({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(a instanceof Approval, 'instance check');
  console.log('    ✓ Approval instance created');

  console.log('\n[2/4] 验证全部 async 方法存在');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/approval'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个`);
  for (const fn of methodNames) {
    assert.strictEqual(typeof a[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  // 验证 v1.5.2 batch2-3 新加的 5 个 oa/corp 端点都存在
  const newMethods = ['getCorpApprovalData', 'getOpenApprovalData', 'applyScheduleEvent', 'getApprovalInfo', 'downloadJournal'];
  for (const m of newMethods) {
    assert.strictEqual(typeof a[m], 'function', `${m} 应该是函数 (v1.5.2 新加)`);
  }
  console.log(`    ✓ v1.5.2 batch2-3 新加 5 方法全部存在: ${newMethods.join(', ')}`);

  console.log('\n[3/4] Stub request + 验证 URL 锁定');
  const stubs = [];
  // stub 同时适配 (method,url,data) 三参 和 {method,url,data,responseType} 对象
  a.request = async function (...args) {
    let entry;
    if (args.length === 1 && typeof args[0] === 'object' && args[0].method) {
      entry = { method: args[0].method, url: args[0].url, data: args[0].data };
    } else {
      entry = { method: args[0], url: args[1], data: args[2] };
    }
    stubs.push(entry);
    return { errcode: 0, errmsg: 'ok' };
  };

  const tcs = [
    { name: 'getTemplateDetail', args: ['tpl_001'], method: 'POST', url: '/oa/gettemplatedetail' },
    { name: 'submitApproval', args: [{ template_id: 'tpl_001', creator_userid: 'u1' }], method: 'POST', url: '/oa/applyevent' },
    { name: 'getApprovalDetail', args: ['sp_001'], method: 'POST', url: '/oa/getapprovaldetail' },
    // v1.5.2 batch2 新加
    { name: 'getCorpApprovalData', args: [1700000000, 1800000000], method: 'POST', url: '/corp/getapprovaldata' },
    { name: 'getOpenApprovalData', args: [1700000000, 1800000000], method: 'POST', url: '/corp/getopenapprovaldata' },
    // v1.5.2 batch3 新加
    { name: 'applyScheduleEvent', args: [{ schedule_id: 'sch_001' }], method: 'POST', url: '/oa/applyevent' },
    { name: 'getApprovalInfo', args: ['sp_001,sp_002'], method: 'POST', url: '/oa/getapprovalinfo' },
    { name: 'downloadJournal', args: [{ starttime: 1700000000, endtime: 1800000000 }], method: 'POST', url: '/oa/journal/download' },
  ];

  for (const tc of tcs) {
    stubs.length = 0;
    await a[tc.name](...tc.args);
    assert.strictEqual(stubs[0].method, tc.method, `${tc.name} method 应为 ${tc.method}`);
    assert.ok(stubs[0].url.startsWith(tc.url) || stubs[0].url === tc.url, `${tc.name} URL 应以 ${tc.url} 开头, 实际=${stubs[0].url}`);
    console.log(`    ✓ ${tc.name} → ${tc.method} ${tc.url}`);
  }

  console.log('\n[4/4] SubmitApproval 高层格式转换验证');
  a.post = async function (url, data) {
    stubs.push({ method: 'POST', url, data });
    return { errcode: 0, errmsg: 'ok' };
  };
  stubs.length = 0;
  await a.submitApproval({
    templateId: 'tpl_hr',
    creator: 'ZhuYun',
    approver: [{ type: 1, userid: 'Manager1' }],
    content: [{ control: 'Text', id: 'Text-001', value: { text: '请假' } }],
  });
  assert.strictEqual(stubs[0].data.template_id, 'tpl_hr', '高层 templateId → template_id');
  assert.strictEqual(stubs[0].data.creator_userid, 'ZhuYun', '高层 creator → creator_userid');
  assert.ok(stubs[0].data.process, '高层应转 process 字段');
  console.log('    ✓ submitApproval 高层格式 → 自动转 template_id/creator_userid/process');

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
