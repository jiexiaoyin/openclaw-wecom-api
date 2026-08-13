// v2026-07-26 21:55 老板 query "BDE" B+D 步骤 - 7 个新 builder 单元测试
const test = require('node:test');
const assert = require('node:assert');
const W = require('../sdk');

// helper
const w = () => new W({});

test('1. buildDateValue → {date:{type,s_timestamp}}', () => {
  assert.deepStrictEqual(w().approval.buildDateValue({ type: 'day', timestamp: 1753574400 }), { date: { type: 'day', s_timestamp: '1753574400' } });
});
test('2. buildDateValue 缺 timestamp 报错', () => {
  assert.throws(() => w().approval.buildDateValue({}), /timestamp 必填/);
});

test('3. buildContactValue userids → {members:[{userid}]}', () => {
  assert.deepStrictEqual(w().approval.buildContactValue({ userids: ['u1','u2'] }), { members: [{ userid: 'u1' }, { userid: 'u2' }] });
});
test('4. buildContactValue departmentIds → {departments:[{department_id}]}', () => {
  assert.deepStrictEqual(w().approval.buildContactValue({ departmentIds: ['2'] }), { departments: [{ department_id: '2' }] });
});
test('5. buildContactValue 双空报错', () => {
  assert.throws(() => w().approval.buildContactValue({}), /userids 或 departmentIds 必填/);
});

test('6. buildLocationValue lat/lng 数字转字符串', () => {
  const v = w().approval.buildLocationValue({ latitude: 32.99, longitude: 118.5, title: 't', address: 'a', time: 1753833600 });
  assert.strictEqual(v.latitude, '32.99');
  assert.strictEqual(v.longitude, '118.5');
  assert.strictEqual(v.time, 1753833600);
});
test('7. buildLocationValue 缺坐标报错', () => {
  assert.throws(() => w().approval.buildLocationValue({}), /latitude \+ longitude/);
});

test('8. buildRelatedApprovalValue → {related_approval:{sp_no:字符串}}', () => {
  assert.deepStrictEqual(w().approval.buildRelatedApprovalValue({ sp_no: '202607260010' }), { related_approval: { sp_no: '202607260010' } });
});
test('9. buildRelatedApprovalValue 缺 sp_no 报错', () => {
  assert.throws(() => w().approval.buildRelatedApprovalValue({}), /sp_no 必填/);
});

test('10. buildDateRangeValue → {date_range:{type,new_begin,new_end,new_duration}}', () => {
  assert.deepStrictEqual(w().approval.buildDateRangeValue({ type: 'hour', beginTime: 1753574400, endTime: 1753833600 }), { date_range: { type: 'hour', new_begin: 1753574400, new_end: 1753833600, new_duration: 259200 } });
});
test('11. buildDateRangeValue 缺时间报错', () => {
  assert.throws(() => w().approval.buildDateRangeValue({ beginTime: 1 }), /beginTime \+ endTime 必填/);
});

test('12. buildFormulaValue → {formula:{value:字符串}}', () => {
  assert.deepStrictEqual(w().approval.buildFormulaValue({ value: 100 }), { formula: { value: '100' } });
});

test('13. buildBankAccountValue → {bank_account:{...}}', () => {
  const v = w().approval.buildBankAccountValue({ type: 1, name: '账户', number: '621200000', remark: '测试', bank: '工商银行' });
  assert.strictEqual(v.bank_account.account_type, 1);
  assert.strictEqual(v.bank_account.account_name, '账户');
  assert.strictEqual(v.bank_account.bank.bank_alias, '工商银行');
});
test('14. buildBankAccountValue 缺 name 报错', () => {
  assert.throws(() => w().approval.buildBankAccountValue({ number: '123' }), /name \+ number 必填/);
});

// v2026-07-26 22:05 老板 query "91983 还哪些控件" - 续加 4 builder 测试 (Attendance/Tips/Table/File)
const w2 = () => new (require('../sdk'))({});

test('15. buildAttendanceValue (5=加班): {attendance:{date_range,type:5,slice_info}}', () => {
  const v = w2().approval.buildAttendanceValue({ type: 5, beginTime: 1753574400, endTime: 1753660800 });
  assert.strictEqual(v.attendance.type, 5);
  assert.strictEqual(v.attendance.date_range.new_duration, 86400);
});
test('16. buildAttendanceValue 缺时间报错', () => {
  assert.throws(() => w2().approval.buildAttendanceValue({ type: 5, beginTime: 1 }), /beginTime \+ endTime/);
});
test('17. buildAttendanceValue 无效 type 报错', () => {
  assert.throws(() => w2().approval.buildAttendanceValue({ type: 9, beginTime: 1, endTime: 2 }), /type 必须是 1-5/);
});

test('18. buildTipsValue: content → new_tips 嵌套结构', () => {
  const v = w2().approval.buildTipsValue({ content: '墨言测试' });
  assert.deepStrictEqual(v.new_tips.tips_content[0].text.sub_text[0].content.plain_text.content, '墨言测试');
});

test('19. buildTableValue 单行单 cell', () => {
  const v = w2().approval.buildTableValue({ rows: [{ cells: [{ control: 'Text', value: { text: 'a' }, title: '明细1' }] }] });
  assert.strictEqual(v.children.length, 1);
  assert.strictEqual(v.children[0].list.length, 1);
  assert.strictEqual(v.children[0].list[0].control, 'Text');
});
test('20. buildTableValue 多行多 cell (Money + Text)', () => {
  const v = w2().approval.buildTableValue({ rows: [
    { cells: [{ control: 'Text', value: { text: 'a' }, title: '物品1' }, { control: 'Money', value: { new_money: '10.0' }, title: '单价' }] },
    { cells: [{ control: 'Text', value: { text: 'b' }, title: '物品2' }, { control: 'Money', value: { new_money: '20.0' }, title: '单价' }] },
  ] });
  assert.strictEqual(v.children.length, 2);
  assert.strictEqual(v.children[0].list.length, 2);
});

test('21. buildFileValue (f1 file_id): {files:[{file_id,file_name,...}]}', () => {
  const v = w2().approval.buildFileValue({ files: [{ file_id: 'f1', file_name: 'test.pdf', file_size: 1024 }] });
  assert.strictEqual(v.files[0].file_id, 'f1');
  assert.strictEqual(v.files[0].file_name, 'test.pdf');
});
