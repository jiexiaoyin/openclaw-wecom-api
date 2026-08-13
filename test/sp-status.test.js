// v2026-07-26 10:23 fix (老板 query "状态:6" bug):
// 验证 sp_status 枚举映射全覆盖 + safe fallback
const test = require('node:test');
const assert = require('node:assert');
const { SP_STATUS_MAP, getSpStatusText } = require('../sdk/utils/sp-status');

test('1. SP_STATUS_MAP 覆盖企微官方 7 个 sp_status 值', () => {
  // 企微官方枚举 (per SDK docstring 7-17):
  //   1=审批中 / 2=已通过 / 3=已驳回 / 4=已撤销
  //   6=通过后撤销 / 7=已删除 / 10=已支付
  assert.strictEqual(SP_STATUS_MAP[1], '🟡审批中');
  assert.strictEqual(SP_STATUS_MAP[2], '✅通过');
  assert.strictEqual(SP_STATUS_MAP[3], '❌驳回');
  assert.strictEqual(SP_STATUS_MAP[4], '🚫撤销');
  assert.strictEqual(SP_STATUS_MAP[6], '🔁通过后撤销');
  assert.strictEqual(SP_STATUS_MAP[7], '🗑已删除');
  assert.strictEqual(SP_STATUS_MAP[10], '💰已支付');
  assert.strictEqual(Object.keys(SP_STATUS_MAP).length, 7);
});

test('2. getSpStatusText: 已映射值返回原中文', () => {
  assert.strictEqual(getSpStatusText(1), '🟡审批中');
  assert.strictEqual(getSpStatusText(2), '✅通过');
  assert.strictEqual(getSpStatusText(6), '🔁通过后撤销');
  assert.strictEqual(getSpStatusText(10), '💰已支付');
});

test('3. getSpStatusText: 字符串类型 sp_status (企微可能返回 string)', () => {
  assert.strictEqual(getSpStatusText('6'), '🔁通过后撤销');
  assert.strictEqual(getSpStatusText('1'), '🟡审批中');
});

test('4. getSpStatusText: 未知 sp_status 不返回原始数字 (safe fallback)', () => {
  // 这是关键回归保护: 不要 fallback 到 "状态: 6" 这种原始数字
  const text = getSpStatusText(99);
  assert.notStrictEqual(text, '99');  // 不应等于原始数字
  assert.notStrictEqual(text, 99);    // 也不应是 number
  assert.ok(text.includes('99'));     // 应包含原始值便于调试
  assert.ok(text.startsWith('未知状态'));  // 应明确标识未知
});

test('5. getSpStatusText: 空值 / null / undefined 都 safe fallback', () => {
  const textEmpty = getSpStatusText(0);
  assert.ok(textEmpty.includes('0') || textEmpty.includes('空'));
  
  const textNull = getSpStatusText(null);
  assert.ok(textNull.includes('空') || textNull.includes('null'));
  
  const textUndef = getSpStatusText(undefined);
  assert.ok(textUndef.includes('空') || textUndef.includes('undefined'));
});
