// v2026-07-26 老板 query D: SDK listTemplates() helper
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApprovalTemplates, flattenTemplates } = require('../sdk/utils/templates-loader');

const TEMPLATES_PATH = path.join(__dirname, '../docs/approval-templates.json');

test('1. docs/approval-templates.json 存在 + 合法', () => {
  assert.strictEqual(fs.existsSync(TEMPLATES_PATH), true,
    '老板 query A 落盘: docs/approval-templates.json 必须存在');
  const data = JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf-8'));
  
  // 至少 1 个分组
  const groups = Object.keys(data);
  assert.ok(groups.length >= 1, '需要至少 1 个分组');
});

test('2. flattenTemplates 把分组铺成 array, 每条 {group, name, template_id}', () => {
  const data = loadApprovalTemplates();
  const flat = flattenTemplates(data);
  
  assert.ok(flat.length >= 33, '老板 query 解析的 33 个模板必须全部存在, 实际 ' + flat.length);
  
  // 查 客户退款申请 (MemOS fact 7-16 已知 ID)
  const refund = flat.find(t => t.name === '客户退款申请');
  assert.ok(refund, '客户退款申请必须在');
  assert.strictEqual(refund.template_id, 'ZvmCpXs4hn77FPJQvWgGxE8cJ7kewaye6SUJH5');
  assert.strictEqual(refund.group, '财务');
  
  // 查 报销申请
  const reimburse = flat.find(t => t.name === '报销申请');
  assert.ok(reimburse, '报销申请必须在');
  assert.strictEqual(reimburse.template_id, 'ZvdX44vFQg7BdVZJ4HS9yD7GMYVScjgaGUZfY5');
  
  // 查 打卡补卡
  const checkin = flat.find(t => t.name === '打卡补卡');
  assert.ok(checkin, '打卡补卡必须在');
  assert.strictEqual(checkin.template_id, '3WLJ7ApqEHS71MJXZcAE8ULeZQqoa5LBv3MrFyjF');
});

test('3. template_id 唯一性 (33 个 ID 不能重复)', () => {
  const flat = flattenTemplates(loadApprovalTemplates());
  const ids = flat.map(t => t.template_id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(ids.length, uniqueIds.size, 
    '模板 ID 必须唯一, 但有重复. 重复 IDs: ' +
    [...ids.filter((id, i) => ids.indexOf(id) !== i)].join(', '));
});

test('4. 跳过 _meta / _stat 等元数据字段', () => {
  // 测试用合成 data, 验证 _ 开头字段被过滤
  const mock = {
    "_stat": "should be skipped",
    "_meta": "also skipped",
    "零售管理": [{ name: '赠品申请', template_id: 't1' }],
    "财务": [{ name: '客户退款申请', template_id: 't2' }]
  };
  const flat = flattenTemplates(mock);
  assert.strictEqual(flat.length, 2, '元数据字段必须跳过, 实际: ' + flat.length);
  assert.strictEqual(flat[0].group, '零售管理');
  assert.strictEqual(flat[1].group, '财务');
});

test('5. SDK w.approval.listTemplates() 工作 (需要真实 config)', () => {
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) { return; }  // 跳过无 config
  if (!realSDK) return;
  
  const flat = realSDK.approval.listTemplates();
  assert.ok(flat.length >= 33, 'SDK listTemplates 实际返回: ' + flat.length);
  assert.strictEqual(typeof flat[0].template_id, 'string');
});

test('6. SDK w.approval.listTemplatesByGroup() 工作', () => {
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) { return; }
  if (!realSDK) return;
  
  const byGroup = realSDK.approval.listTemplatesByGroup();
  assert.ok(byGroup['财务']);
  assert.ok(byGroup['财务'].length >= 10, '财务分组 ≥10 个');
  assert.ok(byGroup['人事']);
});
