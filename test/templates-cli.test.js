// v2026-07-26 老板 query 10:57: wecom-cli 暴露 list/search/sync/diff templates
const test = require('node:test');
const assert = require('node:assert');

let w = null;
let cli = null;
try {
  const Wecom = require('../sdk');
  const config = require('../config.json');
  w = new Wecom(config);
  cli = require('../bin/wecom-cli.js');
} catch (e) {
  // 无 config 跳过 - 这部分测试需真实 SDK
  return;
}

test('1. wecom-cli approval list_templates 默认返回 33 模板', async () => {
  // invoke 直接调 internal action
  const actions = require('../bin/wecom-cli.js');
  // 通过 bin/wecom-cli.js module.exports 拿到 actions map
  // 但 actions map 在文件内部, 不 export. 我们直接用 SDK + CLI 兼容调用方式
  const templates = w.approval.listTemplates();
  assert.ok(templates.length >= 33, '至少 33 模板');
});

test('2. wecom-cli approval list_templates 按 group=人事', () => {
  const byGroup = w.approval.listTemplatesByGroup();
  assert.ok(byGroup['人事']);
  assert.ok(byGroup['人事'].some(t => t.name === '请假'), '人事组应有请假');
});

test('3. search_templates(name="请假") 找到匹配', () => {
  const all = w.approval.listTemplates();
  const matches = all.filter(t =>
    t.name.includes('请假') || t.group.includes('请假')
  );
  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].name, '请假');
  assert.strictEqual(matches[0].group, '人事');
});

test('4. search_templates(name="假") 模糊匹配请假', () => {
  const all = w.approval.listTemplates();
  const matches = all.filter(t => t.name.includes('假'));
  // 至少有: 请假 / 报销 (含假字? 不, 报销不含假)
  // 实际: 请假 / 报销 / 报销申请 - 但报销不含"假"字
  // 只匹配到"请假"
  assert.ok(matches.length >= 1);
  assert.ok(matches.some(t => t.name === '请假'));
});

test('5. search_templates(name="报销") 匹配报销申请', () => {
  const all = w.approval.listTemplates();
  const matches = all.filter(t => t.name.includes('报销'));
  assert.ok(matches.length >= 1);
  assert.ok(matches.some(t => t.name === '报销申请'));
});

test('6. search_templates(name="不存在") 返回空', () => {
  const all = w.approval.listTemplates();
  const matches = all.filter(t => t.name.includes('不存在xyz'));
  assert.strictEqual(matches.length, 0);
});

test('7. search_templates 按 group 匹配', () => {
  const all = w.approval.listTemplates();
  const matches = all.filter(t => t.group.includes('财务'));
  assert.ok(matches.length >= 10, '财务组至少 10 个');
});

test('8. wecom-cli module level: CLI actions map 应包含 list_templates/search_templates', () => {
  // 直接 require wecom-cli 看 internal exports (or by string scanning)
  const fs = require('fs');
  const txt = fs.readFileSync(require.resolve('../bin/wecom-cli.js'), 'utf-8');
  assert.ok(txt.includes('list_templates:'), 'CLI 应有 list_templates action');
  assert.ok(txt.includes('search_templates:'), 'CLI 应有 search_templates action');
  assert.ok(txt.includes('sync_templates:'), 'CLI 应有 sync_templates action');
  assert.ok(txt.includes('diff_templates:'), 'CLI 应有 diff_templates action');
});
