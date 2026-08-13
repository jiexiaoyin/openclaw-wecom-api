// v2026-07-26 老板 query 10:57: SDK approval.searchTemplates()
const test = require('node:test');
const assert = require('node:assert');

let realSDK = null;
try {
  const Wecom = require('../sdk');
  const config = require('../config.json');
  realSDK = new Wecom(config);
} catch (e) { return; }
if (!realSDK) return;

test('1. searchTemplates("请假") 找到 1 个', () => {
  const r = realSDK.approval.searchTemplates({ name: '请假' });
  assert.ok(r.length >= 1);
  assert.ok(r.some(t => t.name === '请假'));
});

test('2. searchTemplates("假") 模糊匹配', () => {
  const r = realSDK.approval.searchTemplates({ name: '假' });
  assert.ok(r.length >= 1);
  assert.ok(r.some(t => t.name === '请假'));
});

test('3. searchTemplates("报销") 匹配报销申请', () => {
  const r = realSDK.approval.searchTemplates({ name: '报销' });
  assert.ok(r.length >= 1);
  assert.ok(r.some(t => t.name === '报销申请'));
});

test('4. searchTemplates 限制 group', () => {
  const r = realSDK.approval.searchTemplates({ name: '请假', group: '人事' });
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].group, '人事');
});

test('5. searchTemplates 不存在', () => {
  const r = realSDK.approval.searchTemplates({ name: 'xyz不存在' });
  assert.strictEqual(r.length, 0);
});

test('6. searchTemplates exact=true 精确', () => {
  const r1 = realSDK.approval.searchTemplates({ name: '请假', exact: false });
  const r2 = realSDK.approval.searchTemplates({ name: '请假', exact: true });
  assert.ok(r1.length >= 1);
  assert.strictEqual(r2.length, 1);
  assert.strictEqual(r2[0].name, '请假');
});

test('7. searchTemplates 空字符串返回空', () => {
  const r = realSDK.approval.searchTemplates({ name: '' });
  assert.strictEqual(r.length, 0);
});

test('8. searchTemplates 返回完整结构 (含 group + name + template_id)', () => {
  const r = realSDK.approval.searchTemplates({ name: '请假' });
  assert.strictEqual(r.length, 1);
  const t = r[0];
  assert.strictEqual(typeof t.group, 'string');
  assert.strictEqual(typeof t.name, 'string');
  assert.strictEqual(typeof t.template_id, 'string');
  assert.ok(t.template_id.length >= 8);
});
