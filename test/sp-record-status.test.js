// v2026-07-26 10:28 fix: 节点 status fallback 抽独立 module
const test = require('node:test');
const assert = require('node:assert');
const { SP_RECORD_NODE_STATUS_MAP, getNodeStatusInfo } = require('../sdk/utils/sp-record-status');

test('1. SP_RECORD_NODE_STATUS_MAP 覆盖 1/2/3/4', () => {
  assert.strictEqual(SP_RECORD_NODE_STATUS_MAP[1].text, '🕐');
  assert.strictEqual(SP_RECORD_NODE_STATUS_MAP[1].label, '等待审批');
  assert.strictEqual(SP_RECORD_NODE_STATUS_MAP[2].text, '✅');
  assert.strictEqual(SP_RECORD_NODE_STATUS_MAP[3].text, '❌');
  assert.strictEqual(SP_RECORD_NODE_STATUS_MAP[3].label, '已驳回');
  assert.strictEqual(SP_RECORD_NODE_STATUS_MAP[4].text, '🔙');
  assert.strictEqual(Object.keys(SP_RECORD_NODE_STATUS_MAP).length, 4);
});

test('2. getNodeStatusInfo 已映射值返回正确', () => {
  assert.deepStrictEqual(getNodeStatusInfo(1), { text: '🕐', label: '等待审批' });
  assert.deepStrictEqual(getNodeStatusInfo(2), { text: '✅', label: '已审批' });
  assert.deepStrictEqual(getNodeStatusInfo(3), { text: '❌', label: '已驳回' });
});

test('3. getNodeStatusInfo 未知值用 ❓ (safe fallback)', () => {
  // 关键: 不应 fallback 到 '🕐' (误显示等待审批)
  const info = getNodeStatusInfo(99);
  assert.strictEqual(info.text, '❓');
  assert.ok(info.label.includes('99'));
  assert.ok(info.label.includes('未知'));
});

test('4. getNodeStatusInfo 空值/null/undefined 都不崩', () => {
  const info0 = getNodeStatusInfo(0);
  assert.strictEqual(info0.text, '❓');
  
  const infoNull = getNodeStatusInfo(null);
  assert.strictEqual(infoNull.text, '❓');
  
  const infoUndef = getNodeStatusInfo(undefined);
  assert.strictEqual(infoUndef.text, '❓');
});

test('5. 字符串类型 sp_status (兼容)', () => {
  assert.strictEqual(getNodeStatusInfo('1').text, '🕐');
  assert.strictEqual(getNodeStatusInfo('2').text, '✅');
});
