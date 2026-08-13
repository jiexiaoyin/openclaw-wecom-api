// v2026-07-26 12:21: 请假 helper 升级 (真实 SDK structure)
const test = require('node:test');
const assert = require('node:assert');

const Approval = require('../sdk/modules/approval');

function newMockApproval() {
  const a = new Approval({ corpId: 'test', corpSecret: 'secret' });
  let lastGet = null, lastPost = null;
  a.post = async (url, data) => {
    if (url.includes('gettemplatedetail')) {
      lastGet = data;
      return {
        errcode: 0,
        template_names: [{ text: '请假', lang: 'zh_CN' }],
        template_content: {
          controls: [
            { property: { control: 'Vacation', id: 'vacation-1563793073898', require: 1, title: [{ text: '请假类型', lang: 'zh_CN' }] }},
            { property: { control: 'Textarea', id: 'item-1497581399901', require: 0, title: [{ text: '请假事由', lang: 'zh_CN' }] }},
          ],
        },
      };
    }
    lastPost = { url, data };
    return { errcode: 0, errmsg: 'ok', sp_no: 'TEST_SP' };
  };
  a.getLastPost = () => lastPost;
  return a;
}

test('1. buildVacationValue 真实结构 - 事假 3 天', () => {
  const a = new Approval({});
  const v = a.buildVacationValue({ leaveTypeId: 2, startTime: 1753574400, endTime: 1753833600, leaveTypeName: '事假' });
  // 顶层是 vacation 对象
  assert.ok(v.vacation);
  assert.strictEqual(v.vacation.selector.type, 'single');
  assert.strictEqual(v.vacation.selector.options[0].key, '2');
  assert.strictEqual(v.vacation.selector.options[0].value[0].text, '事假');
  assert.deepStrictEqual(v.vacation.selector.op_relations, []);
  // attendance
  assert.strictEqual(v.vacation.attendance.type, 1);
  assert.strictEqual(v.vacation.attendance.date_range.type, 'hour');
  assert.strictEqual(v.vacation.attendance.date_range.new_begin, 1753574400);
  assert.strictEqual(v.vacation.attendance.date_range.new_end, 1753833600);
  // slice_info
  assert.strictEqual(v.vacation.attendance.slice_info.state, 1);
  // day_items: 3 天 + 1 boundary = 4 个
  assert.strictEqual(v.vacation.attendance.slice_info.day_items.length, 4);
  // 前 3 个 有 duration=86400, 第 4 个 boundary duration=0
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[0].duration, 86400);
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[1].duration, 86400);
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[2].duration, 86400);
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[3].duration, 0);
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[3].daytime, 1753833600);
});

test('2. buildVacationValue 必填缺失报错', () => {
  const a = new Approval({});
  assert.throws(() => a.buildVacationValue({}));
  assert.throws(() => a.buildVacationValue({ leaveTypeId: 2, startTime: 1 }));
});

test('3. buildVacationValue 时间戳反序报错', () => {
  const a = new Approval({});
  assert.throws(() => a.buildVacationValue({ leaveTypeId: 2, startTime: 100, endTime: 50 }));
});

test('4. submitLeaveRequest 一站式事假 + 事由', async () => {
  const a = newMockApproval();
  const r = await a.submitLeaveRequest({
    templateId: 'C4Ramzh8A3FGmQvzq1HDv9nqnwu5rqSRRNULTxReQ',
    creator: 'JieXiaoYin',
    leaveTypeId: 2,
    startTime: 1753574400,
    endTime: 1753833600,
    reasonText: '外出学习',
    leaveTypeName: '事假',
  });
  assert.strictEqual(r.errcode, 0);
  const body = a.getLastPost().data;
  // Vacation content 完整
  const vacationContent = body.apply_data.contents.find(c => c.id === 'vacation-1563793073898');
  assert.ok(vacationContent);
  assert.strictEqual(vacationContent.control, 'Vacation');  // 预填 control
  // 深入 vacation 结构
  const v = vacationContent.value.vacation;
  assert.ok(v);
  assert.strictEqual(v.selector.options[0].key, '2');
  assert.strictEqual(v.selector.options[0].value[0].text, '事假');
  assert.strictEqual(v.attendance.date_range.new_begin, 1753574400);
  assert.strictEqual(v.attendance.slice_info.day_items.length, 4);
  // Textarea value
  const reasonContent = body.apply_data.contents.find(c => c.id === 'item-1497581399901');
  assert.ok(reasonContent);
  assert.strictEqual(reasonContent.value.text, '外出学习');
  assert.strictEqual(reasonContent.control, 'Textarea');
});

test('5. submitLeaveRequest 不传 reasonText - 跳过 Textarea', async () => {
  const a = newMockApproval();
  await a.submitLeaveRequest({
    templateId: 'tpl_1', creator: 'u1',
    leaveTypeId: 2, startTime: 1, endTime: 2,
  });
  const body = a.getLastPost().data;
  // 只有 Vacation
  assert.strictEqual(body.apply_data.contents.length, 1);
  assert.strictEqual(body.apply_data.contents[0].control, 'Vacation');
});

test('6. submitLeaveRequest 非请假模板 (无 Vacation 控件)', async () => {
  const a = new Approval({ corpId: 't', corpSecret: 's' });
  a.post = async (url) => ({
    errcode: 0,
    template_content: { controls: [{ property: { control: 'Text', id: 't1' }}] },
  });
  const r = await a.submitLeaveRequest({
    templateId: 'tpl_1', creator: 'u1', leaveTypeId: 1,
    startTime: 1, endTime: 2,
  });
  assert.strictEqual(r.errcode, -1);
  assert.ok(r.errmsg.includes('无 Vacation 控件'));
});

test('7. submitLeaveRequest 调休假 leaveTypeId=4 - 默认姓名', async () => {
  const a = newMockApproval();
  await a.submitLeaveRequest({
    templateId: 'tpl_1', creator: 'u1',
    leaveTypeId: 4, startTime: 1753574400, endTime: 1753833600,
  });
  const body = a.getLastPost().data;
  const vacationValue = body.apply_data.contents[0].value;
  // 不传 leaveTypeName 时默认值 '事假' (其实是 '假期类型4' 因为我们设 default `假期类型${leaveTypeId}`)
  assert.strictEqual(vacationValue.vacation.selector.options[0].key, '4');
  // 默认 text: "假期类型4"
  assert.ok(vacationValue.vacation.selector.options[0].value[0].text.includes('4'));
});

test('8. submitLeaveRequest + useTemplateApprover=false 透传', async () => {
  const a = newMockApproval();
  await a.submitLeaveRequest({
    templateId: 'tpl_1', creator: 'u1',
    leaveTypeId: 2, startTime: 1, endTime: 2,
    useTemplateApprover: false,
  });
  assert.strictEqual(a.getLastPost().data.use_template_approver, 0);
});

test('9. buildVacationValue 跨年 1 天 (边界验证)', () => {
  const a = new Approval({});
  const v = a.buildVacationValue({ leaveTypeId: 2, startTime: 1735689600, endTime: 1735776000 });
  // 1 天 = 86400 秒
  assert.strictEqual(v.vacation.attendance.date_range.new_duration, 86400);
  // day_items: 1 天 + 1 boundary = 2 个
  assert.strictEqual(v.vacation.attendance.slice_info.day_items.length, 2);
});

test('10. submitLeaveRequest body 完整 (跟老板 12:16 验证的 sp_no=202607260010 比较)', async () => {
  const a = newMockApproval();
  await a.submitLeaveRequest({
    templateId: 'C4Ramzh8A3FGmQvzq1HDv9nqnwu5rqSRRNULTxReQ',
    creator: 'JieXiaoYin',
    leaveTypeId: 2,  // 事假
    startTime: 1753574400,  // 7-27 0:00 CST
    endTime: 1753833600,    // 7-30 0:00 CST (3 天)
    reasonText: '外出学习',
    leaveTypeName: '事假',
  });
  const body = a.getLastPost().data;
  const v = body.apply_data.contents.find(c => c.id === 'vacation-1563793073898').value;
  // 验证与老板 12:16 成功用例完全一致
  assert.strictEqual(v.vacation.selector.type, 'single');
  assert.deepStrictEqual(v.vacation.selector.op_relations, []);
  assert.strictEqual(v.vacation.selector.options.length, 1);
  assert.strictEqual(v.vacation.attendance.date_range.type, 'hour');
  assert.strictEqual(v.vacation.attendance.date_range.new_begin, 1753574400);
  assert.strictEqual(v.vacation.attendance.date_range.new_end, 1753833600);
  assert.strictEqual(v.vacation.attendance.date_range.new_duration, 259200);  // 3*86400
  assert.strictEqual(v.vacation.attendance.type, 1);
  assert.strictEqual(v.vacation.attendance.slice_info.state, 1);
  assert.strictEqual(v.vacation.attendance.slice_info.duration, 259200);
  assert.strictEqual(v.vacation.attendance.slice_info.day_items.length, 4);
});
test('11. buildVacationValue - 验证 day_items 数量正确性 (12:21 踩坑)', () => {
  const a = new Approval({});
  // 起点和终点都是 CST 0:00 对齐 UTC 秒数
  // start = CST 7-27 0:00 = 1753574400, end = CST 7-30 0:00 = 1753833600
  // duration = 259200 秒 = 3 天
  const v = a.buildVacationValue({ leaveTypeId: 2, startTime: 1753574400, endTime: 1753833600 });
  // 必须: 3 个 day + 1 boundary = 4 个
  assert.strictEqual(v.vacation.attendance.slice_info.day_items.length, 4);
  // day[0].daytime = start, day[3].daytime = end
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[0].daytime, 1753574400);
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[1].daytime, 1753574400 + 86400);
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[2].daytime, 1753574400 + 86400 * 2);
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[3].daytime, 1753833600);
  // boundary duration=0
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[3].duration, 0);
});

test('12. edge: 半天请假 (4小时) 期望 day_items[0].duration=14400 + boundary', () => {
  const a = new Approval({});
  const start = 1753574400;  // CST 7-27 0:00
  const end = start + 4 * 3600;  // 4 小时后
  const v = a.buildVacationValue({ leaveTypeId: 2, startTime: start, endTime: end });
  assert.strictEqual(v.vacation.attendance.date_range.new_duration, 14400);
  // Math.ceil(14400/86400) = 1 → day_items 1 + 1 boundary = 2
  assert.strictEqual(v.vacation.attendance.slice_info.day_items.length, 2);
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[0].duration, 86400);
  assert.strictEqual(v.vacation.attendance.slice_info.day_items[1].duration, 0);
});
