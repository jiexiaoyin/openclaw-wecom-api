// v2026-07-26 老板 query 全做-B: 模板 diff 工具
const test = require('node:test');
const assert = require('node:assert');
const { diffTemplates, diffTemplateControls, formatDiff, SEVERITY } = require('../sdk/utils/templates-diff');

test('1. diffTemplates: 完全相同返回 unchanged', () => {
  const data = [
    { template_id: 't1', name: 'A', controls: [{ control: 'Text', id: 'c1', title: 'X', require: 1, hidden: 0 }] },
    { template_id: 't2', name: 'B', controls: [] }
  ];
  const r = diffTemplates(data, data);
  assert.strictEqual(r.unchanged_count, 2);
  assert.strictEqual(r.changed_count, 0);
  assert.strictEqual(r.added_count, 0);
  assert.strictEqual(r.removed_count, 0);
});

test('2. diffTemplates: 仅远程 (added)', () => {
  const local = [];
  const remote = [{ template_id: 't1', name: 'A', controls: [] }];
  const r = diffTemplates(local, remote);
  assert.strictEqual(r.added_count, 1);
  assert.strictEqual(r.unchanged_count, 0);
  assert.strictEqual(r.summary.added[0].template_id, 't1');
});

test('3. diffTemplates: 仅本地 (removed)', () => {
  const local = [{ template_id: 't1', name: 'A', controls: [] }];
  const remote = [];
  const r = diffTemplates(local, remote);
  assert.strictEqual(r.removed_count, 1);
  assert.strictEqual(r.summary.removed[0].template_id, 't1');
});

test('4. diffTemplateControls: 控件增删改', () => {
  const local = [
    { control: 'Text', id: 'c1', title: '名字', require: 1, hidden: 0 },
    { control: 'Money', id: 'c2', title: '金额', require: 1, hidden: 0 }
  ];
  const remote = [
    { control: 'Text', id: 'c1', title: '姓名', require: 1, hidden: 0 },   // title 改
    { control: 'Selector', id: 'c3', title: '类型', require: 0, hidden: 0 }  // 新控件
    // c2 删除
  ];
  const diffs = diffTemplateControls(local, remote);
  // 应该: c1 changed (title), c2 removed, c3 added
  assert.strictEqual(diffs.length, 3);
  const c1 = diffs.find(d => d.id === 'c1');
  const c2 = diffs.find(d => d.id === 'c2');
  const c3 = diffs.find(d => d.id === 'c3');
  assert.strictEqual(c1.severity, SEVERITY.CONTROL_CHANGED);
  assert.ok(c1.changes.some(c => c.field === 'title'));
  assert.strictEqual(c2.severity, SEVERITY.CONTROL_REMOVED);
  assert.strictEqual(c3.severity, SEVERITY.CONTROL_ADDED);
});

test('5. formatDiff 输出可读', () => {
  const local = [{ template_id: 't1', name: 'A', controls: [] }];
  const remote = [];
  const r = diffTemplates(local, remote);
  const text = formatDiff(r);
  assert.ok(text.includes('总模板:'));
  assert.ok(text.includes('未变:'));
  assert.ok(text.includes('--- 删除'));
  assert.ok(text.includes('A'));
});

test('6. SDK w.approval.diffApprovalTemplates (真实拉 1 个 + diff)', async () => {
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) { return; }
  if (!realSDK) return;

  // diff 客户退款申请 (本地有, 但本地无 controls, 所以会显示 changed 因为 controls 不同)
  const text = await realSDK.approval.diffApprovalTemplates({
    templateIds: ['ZvmCpXs4hn77FPJQvWgGxE8cJ7kewaye6SUJH5'],
    formatOutput: true
  });
  assert.ok(text.includes('总模板:'));
});

test('7. SDK diffApprovalTemplates formatOutput=false 返回 object', async () => {
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) { return; }
  if (!realSDK) return;

  const obj = await realSDK.approval.diffApprovalTemplates({
    templateIds: ['ZvmCpXs4hn77FPJQvWgGxE8cJ7kewaye6SUJH5'],
    formatOutput: false
  });
  assert.strictEqual(typeof obj, 'object');
  assert.ok(obj.summary);
  assert.strictEqual(typeof obj.total, 'number');
});
