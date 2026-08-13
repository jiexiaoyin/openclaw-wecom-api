// v2026-07-26 老板 query C: zero-deps schema validator
const test = require('node:test');
const assert = require('node:assert');
const { validateApprovalTemplates } = require('../sdk/utils/templates-validator');
const { loadApprovalTemplates } = require('../sdk/utils/templates-loader');
const path = require('path');

test('1. validateApprovalTemplates 真实数据 OK', () => {
  const data = JSON.parse(require('fs').readFileSync(
    path.join(__dirname, '../docs/approval-templates.json'),
    'utf-8'
  ));
  const result = validateApprovalTemplates(data);
  assert.strictEqual(result.ok, true, '33 个真实模板应该 OK. 错误: ' + JSON.stringify(result.errors.slice(0, 3)));
});

test('2. validateApprovalTemplates 缺 name 报错', () => {
  const bad = { '财务': [{ template_id: 'tAbc12345' }] };  // 缺 name
  const r = validateApprovalTemplates(bad);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('name')), '应该提到 name 错误');
});

test('3. validateApprovalTemplates 缺 template_id 报错', () => {
  const bad = { '财务': [{ name: '客户退款申请' }] };
  const r = validateApprovalTemplates(bad);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('template_id')));
});

test('4. validateApprovalTemplates 格式错误 (短/特殊字符)', () => {
  const bad = {
    '财务': [
      { name: '客户退款申请', template_id: 'short' },       // 5 位 (太短)
      { name: '报销', template_id: 'has/slash' }            // 含 /
    ]
  };
  const r = validateApprovalTemplates(bad);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.errors.length, 2);
  assert.ok(r.errors.some(e => e.includes('short')));
  assert.ok(r.errors.some(e => e.includes('has/slash')));
});

test('5. validateApprovalTemplates 重复 ID 报错', () => {
  const dup = {
    '财务': [{ name: 'A', template_id: 'dupAbc1234' }],
    '人事': [{ name: 'B', template_id: 'dupAbc1234' }]  // same id
  };
  const r = validateApprovalTemplates(dup);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('重复')));
});

test('6. validateApprovalTemplates 分组非 array 报错', () => {
  const bad = { '财务': 'not an array' };
  const r = validateApprovalTemplates(bad);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('array')));
});

test('7. validateApprovalTemplates _meta / _stat 跳过', () => {
  const ok = {
    '_meta': { description: '随便什么' },  // 跳过
    '_stat': { from: '10:32' },
    '财务': [{ name: '客户退款申请', template_id: 'ZvmCpXs4hn77FPJQvWgGxE8cJ7kewaye6SUJH5' }]
  };
  const r = validateApprovalTemplates(ok);
  assert.strictEqual(r.ok, true);
});

test('8. 顶层不是 object 报错', () => {
  const r1 = validateApprovalTemplates(null);
  const r2 = validateApprovalTemplates([]);
  const r3 = validateApprovalTemplates('string');
  assert.strictEqual(r1.ok, false);
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r3.ok, false);
});

test('9. loadApprovalTemplates 真实数据不抛错 (默认 validate=true)', () => {
  // 默认 validate=true, 真实数据应该过
  const data = loadApprovalTemplates();
  const total = Object.values(data).filter(v => Array.isArray(v)).reduce((a, b) => a + b.length, 0);
  assert.ok(total >= 33);
});

test('10. loadApprovalTemplates bad JSON 抛错', () => {
  // 临时写坏文件
  const fs = require('fs');
  const tmpPath = '/tmp/bad-templates.json';
  fs.writeFileSync(tmpPath, JSON.stringify({ '财务': [{ name: 'A' }] }));  // 缺 template_id

  // 创建一个 fake docs dir
  const tmpDocs = '/tmp/wecom-template-test-docs-' + Date.now();
  fs.mkdirSync(tmpDocs, { recursive: true });
  fs.copyFileSync(tmpPath, tmpDocs + '/approval-templates.json');

  assert.throws(
    () => loadApprovalTemplates(tmpDocs),
    /schema 校验失败/
  );
  fs.rmSync(tmpDocs, { recursive: true });
});
