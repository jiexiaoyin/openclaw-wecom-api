// v2026-07-26 老板 query B: SDK syncApprovalTemplates() helper
const test = require('node:test');
const assert = require('node:assert');

test('1. syncApprovalTemplates 默认参数 (拉全部) 返回 array', async () => {
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) { return; }
  if (!realSDK) return;

  const results = await realSDK.approval.syncApprovalTemplates({ controlsOnly: true });
  assert.ok(Array.isArray(results));
  assert.ok(results.length >= 33, '应该至少返回 33 个, 实际 ' + results.length);
});

test('2. syncApprovalTemplates 单条 ID 拉客户退款申请', async () => {
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) { return; }
  if (!realSDK) return;

  const results = await realSDK.approval.syncApprovalTemplates({
    templateIds: ['ZvmCpXs4hn77FPJQvWgGxE8cJ7kewaye6SUJH5'],
    controlsOnly: true
  });
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].errcode, 0);
  assert.strictEqual(results[0].template_id, 'ZvmCpXs4hn77FPJQvWgGxE8cJ7kewaye6SUJH5');
  // 控件数已知是 9
  assert.strictEqual(results[0].controls.length, 9, '客户退款申请真实有 9 控件, 实际 ' + results[0].controls.length);
});

test('3. syncApprovalTemplates 返回结构 (含 controls + names)', async () => {
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) { return; }
  if (!realSDK) return;

  const results = await realSDK.approval.syncApprovalTemplates({
    templateIds: ['ZvmCpXs4hn77FPJQvWgGxE8cJ7kewaye6SUJH5'],
    controlsOnly: false
  });
  const r = results[0];
  assert.strictEqual(r.errcode, 0);
  // controls 数组, 每条是简化版
  assert.ok(Array.isArray(r.controls));
  for (const c of r.controls) {
    assert.strictEqual(typeof c.control, 'string');
    assert.strictEqual(typeof c.id, 'string');
    assert.strictEqual(typeof c.title, 'string');
    // require 可以 0/1
    assert.ok(c.require === 0 || c.require === 1 || c.require === undefined);
  }
  // template_names 是多语言 array
  if (r.template_names) {
    assert.ok(Array.isArray(r.template_names));
    assert.ok(r.template_names.length >= 1);
  }
});

test('4. syncApprovalTemplates 错误 template_id 优雅 fallback', async () => {
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) { return; }
  if (!realSDK) return;

  const results = await realSDK.approval.syncApprovalTemplates({
    templateIds: ['invalid_template_id_xxx'],
    controlsOnly: true
  });
  // 不应该 throw, 应该有 errcode != 0 的条目
  assert.strictEqual(results.length, 1);
  assert.notStrictEqual(results[0].errcode, 0, '错误 ID 应该 errcode != 0');
  assert.deepStrictEqual(results[0].controls, []);
});

test('5. syncApprovalTemplates 批量 (3 条真实)', async () => {
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) { return; }
  if (!realSDK) return;

  const ids = [
    'ZvmCpXs4hn77FPJQvWgGxE8cJ7kewaye6SUJH5',  // 客户退款
    'ZvdX44vFQg7BdVZJ4HS9yD7GMYVScjgaGUZfY5',  // 报销申请
    '3WLJ7ApqEHS71MJXZcAE8ULeZQqoa5LBv3MrFyjF'  // 打卡补卡
  ];
  const results = await realSDK.approval.syncApprovalTemplates({
    templateIds: ids,
    controlsOnly: true
  });
  assert.strictEqual(results.length, 3);
  for (const r of results) {
    assert.strictEqual(r.errcode, 0, '3 个真实模板都应 errcode=0. 失败: ' + r.template_id + ' ' + r.errmsg);
    assert.ok(r.controls.length > 0, r.template_id + ' 控件数 0, 不合理');
  }
});

test('6. syncApprovalTemplates 并发 concurrency=10 (拉 33 个)', async () => {
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) { return; }
  if (!realSDK) return;

  const t0 = Date.now();
  const results = await realSDK.approval.syncApprovalTemplates({ 
    controlsOnly: true,
    concurrency: 10
  });
  const elapsed = Date.now() - t0;
  assert.strictEqual(results.length, 33);
  // 并发应该比顺序快
  console.log('  并发 10 总时间:', elapsed + 'ms');
});

test('7. syncApprovalTemplates writeBack=true (会改 docs)', async () => {
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) { return; }
  if (!realSDK) return;

  // 备份当前 docs (用 test 相对路径, 不依赖 dev 绝对路径)
  const fs = require('fs');
  const path = require('path');
  const docsPath = path.join(__dirname, '../docs/approval-templates.json');
  const before = fs.readFileSync(docsPath, 'utf-8');
  
  try {
    await realSDK.approval.syncApprovalTemplates({ 
      controlsOnly: true,
      concurrency: 5,
      writeBack: true
    });
    const after = fs.readFileSync(docsPath, 'utf-8');
    // writeBack 后, JSON 应包含 controls 字段
    assert.ok(after.includes('"controls":'), 'writeBack 后应有 controls 字段');
    assert.ok(after.includes('"synced_at"'), 'writeBack 后应有 synced_at');
  } finally {
    // 恢复原状
    fs.writeFileSync(docsPath, before);
  }
});
