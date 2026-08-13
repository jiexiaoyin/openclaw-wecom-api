// v2026-07-26 14:08 老板 query B: StatuChangeEvent=5 催办文案测试
const test = require('node:test');
const assert = require('node:assert');

// 模拟 handler 内部文案生成函数
function buildActionText(approval, event) {
  const sp_status = Number(approval?.SpStatus || 0);
  const statu_change_event = String(approval?.StatuChangeEvent || '');
  const isReminder = statu_change_event === '5';
  const isRevoke = event === 'sys_approval_revoke';
  const isFinal = sp_status === 2 || sp_status === 3;
  // 简化: 不引入 hasAnyApproved, 用 1+ hasAnyApproved=false 模拟新增场景
  const hasAnyApproved = false;
  let actionText;
  if (isReminder) actionText = '催办';
  else if (isRevoke) actionText = '撤销';
  else if (isFinal) actionText = '结果';
  else if (hasAnyApproved) actionText = '进度更新';
  else actionText = '新增';
  return { actionText, isReminder, icon: isReminder ? '⏰' : '📋' };
}

test('1. 催办事件 (StatuChangeEvent=5) → actionText=催办 + ⏰ 图标', () => {
  const r = buildActionText({ SpStatus: '1', StatuChangeEvent: '5' }, 'sys_approval_change');
  assert.strictEqual(r.actionText, '催办');
  assert.strictEqual(r.icon, '⏰');
  assert.strictEqual(r.isReminder, true);
});

test('2. 申请事件 (StatuChangeEvent=1) → actionText=新增 + 📋 图标', () => {
  const r = buildActionText({ SpStatus: '1', StatuChangeEvent: '1' }, 'sys_approval_change');
  assert.strictEqual(r.actionText, '新增');
  assert.strictEqual(r.icon, '📋');
  assert.strictEqual(r.isReminder, false);
});

test('3. 同意事件 (StatuChangeEvent=2) → actionText=结果 (因 SpStatus=2 isFinal)', () => {
  const r = buildActionText({ SpStatus: '2', StatuChangeEvent: '2' }, 'sys_approval_change');
  assert.strictEqual(r.actionText, '结果');
  assert.strictEqual(r.icon, '📋');
});

test('4. 转审事件 (StatuChangeEvent=4) → actionText=新增 (流转中)', () => {
  const r = buildActionText({ SpStatus: '1', StatuChangeEvent: '4' }, 'sys_approval_change');
  assert.strictEqual(r.actionText, '新增');
  assert.strictEqual(r.icon, '📋');
});

test('5. 撤销事件 (event=sys_approval_revoke) → actionText=撤销', () => {
  const r = buildActionText({ SpStatus: '1', StatuChangeEvent: '1' }, 'sys_approval_revoke');
  assert.strictEqual(r.actionText, '撤销');
  assert.strictEqual(r.icon, '📋');
});

test('6. 缺 StatuChangeEvent 字段 → actionText=新增 (向后兼容)', () => {
  const r = buildActionText({ SpStatus: '1' }, 'sys_approval_change');
  assert.strictEqual(r.actionText, '新增');
  assert.strictEqual(r.icon, '📋');
});

test('7. 数值型 StatuChangeEvent=5 → actionText=催办 (String 转换正确)', () => {
  const r = buildActionText({ SpStatus: '1', StatuChangeEvent: 5 }, 'sys_approval_change');
  assert.strictEqual(r.actionText, '催办');
});

test('8. 边界: StatuChangeEvent=null → actionText=新增 (兼容)', () => {
  const r = buildActionText({ SpStatus: '1', StatuChangeEvent: null }, 'sys_approval_change');
  assert.strictEqual(r.actionText, '新增');
});
