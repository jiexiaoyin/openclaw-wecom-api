// v2026-07-26 10:25 fix: callback 5 处重复 ctMap 抽到独立 module
const test = require('node:test');
const assert = require('node:assert');
const { ChangeTypeMap, ExternalContactChangeTypeMap, getChangeTypeText } = require('../sdk/utils/change-type');

test('1. ChangeTypeMap 覆盖企微官方 3 个值', () => {
  assert.strictEqual(ChangeTypeMap[1], '新增');
  assert.strictEqual(ChangeTypeMap[2], '更新');
  assert.strictEqual(ChangeTypeMap[3], '删除');
  assert.strictEqual(Object.keys(ChangeTypeMap).length, 3);
});

test('2. ExternalContactChangeTypeMap 覆盖企微外部联系人 2 个值 (1/4)', () => {
  // 重要: 外部联系人不含 2/3 (无更新概念), 1=新增 4=删除
  assert.strictEqual(ExternalContactChangeTypeMap[1], '新增');
  assert.strictEqual(ExternalContactChangeTypeMap[4], '删除');
  assert.strictEqual(Object.keys(ExternalContactChangeTypeMap).length, 2);
});

test('3. getChangeTypeText: 内部 ct 默认场景 (1/2/3)', () => {
  assert.strictEqual(getChangeTypeText(1), '新增');
  assert.strictEqual(getChangeTypeText(2), '更新');
  assert.strictEqual(getChangeTypeText(3), '删除');
});

test('4. getChangeTypeText: 外部联系人 isExternalContact=true', () => {
  assert.strictEqual(getChangeTypeText(1, true), '新增');
  assert.strictEqual(getChangeTypeText(4, true), '删除');
  // 重要: 内部 map 包含 2/3 但外部联系人不包含
  assert.strictEqual(getChangeTypeText(2, true), '变更(2)');  // 友好 fallback
  assert.strictEqual(getChangeTypeText(3, true), '变更(3)');
});

test('5. getChangeTypeText: safe fallback (未知值、空)', () => {
  assert.notStrictEqual(getChangeTypeText(99), '99');
  assert.ok(getChangeTypeText(99).includes('99'));
  assert.ok(getChangeTypeText(99).startsWith('变更'));

  assert.ok(getChangeTypeText(0).includes('0') || getChangeTypeText(0).includes('空'));
  assert.ok(getChangeTypeText(null).includes('空') || getChangeTypeText(null).includes('null'));
  assert.ok(getChangeTypeText(undefined).includes('空'));
});

test('6. 字符串类型 ct (企微可能返回 string)', () => {
  assert.strictEqual(getChangeTypeText('1'), '新增');
  assert.strictEqual(getChangeTypeText('4', true), '删除');
});
