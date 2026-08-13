// v2026-07-26 10:31 fix: smartsheet event type 抽独立 module
const test = require('node:test');
const assert = require('node:assert');
const { SMARTSHEET_EVENT_TYPE_MAP, getSmartSheetEventType } = require('../sdk/utils/smartsheet-event-type');

test('1. SMARTSHEET_EVENT_TYPE_MAP 覆盖企微 3 个 wedoc 事件', () => {
  assert.strictEqual(SMARTSHEET_EVENT_TYPE_MAP['add_record'], '➕ 新增记录');
  assert.strictEqual(SMARTSHEET_EVENT_TYPE_MAP['update_record'], '✏️ 修改记录');
  assert.strictEqual(SMARTSHEET_EVENT_TYPE_MAP['delete_record'], '🗑️ 删除记录');
  assert.strictEqual(Object.keys(SMARTSHEET_EVENT_TYPE_MAP).length, 3);
});

test('2. getSmartSheetEventType 已映射值正确', () => {
  assert.strictEqual(getSmartSheetEventType('add_record'), '➕ 新增记录');
  assert.strictEqual(getSmartSheetEventType('update_record'), '✏️ 修改记录');
  assert.strictEqual(getSmartSheetEventType('delete_record'), '🗑️ 删除记录');
});

test('3. getSmartSheetEventType 未知值用 safe fallback', () => {
  // 关键: 不应直接返回原始字符串 "unknown_event"
  const text = getSmartSheetEventType('unknown_event');
  assert.notStrictEqual(text, 'unknown_event');
  assert.ok(text.includes('unknown_event'));
  assert.ok(text.startsWith('未知事件'));
});

test('4. getSmartSheetEventType 空/null/undefined 都不崩', () => {
  assert.ok(getSmartSheetEventType('').includes('空'));
  assert.ok(getSmartSheetEventType(null).includes('空'));
  assert.ok(getSmartSheetEventType(undefined).includes('空'));
});
