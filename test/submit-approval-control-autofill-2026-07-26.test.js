// v2026-07-26 11:40: submitApproval 自动补 control 字段 (避免 301025)
const test = require('node:test');
const assert = require('node:assert');

const Approval = require('../sdk/modules/approval');

// 真实 docs SSOT - 含退款给客户 (有 controls)
const REAL_TID = '3WLJ7G9TU6FbSJRVSSnkkZEr67rJN4eM959MXZbL';

function newMock() {
  const a = new Approval({ corpId: 'test', corpSecret: 'secret' });
  let captured = null;
  a.post = async (url, data) => { captured = data; return { errcode: 0, sp_no: 'TEST' }; };
  a.getBody = () => captured;
  return a;
}

test('1. 真实 docs SSOT 自动补 control 字段 (退款给客户)', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: REAL_TID,
    callerUserid: 'JieXiaoYin',
    content: [
      { id: 'Text-1598340792149', value: { text: '客户某某' } },
      { id: 'Money-1598340792150', value: { new_money: 1 } },
      { id: 'Text-1598340792152', value: { text: '备注' } },
    ],
  });
  const body = a.getBody();
  assert.strictEqual(body.apply_data.contents[0].control, 'Text');
  assert.strictEqual(body.apply_data.contents[1].control, 'Money');
  assert.strictEqual(body.apply_data.contents[2].control, 'Text');
});

test('2. 调用方已传 control 字段 → 不覆盖', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: REAL_TID,
    creator: 'u1',
    content: [{ control: 'Text', id: 'Text-1598340792149', value: { text: 'hi' } }],
  });
  assert.strictEqual(a.getBody().apply_data.contents[0].control, 'Text');
});

test('3. 原生 apply_data 格式也补 control 字段', async () => {
  const a = newMock();
  await a.submitApproval({
    template_id: REAL_TID,
    creator_userid: 'u1',
    apply_data: {
      contents: [
        { id: 'Text-1598340792149', value: { text: 'hi' } },
        { id: 'Money-1598340792150', value: { new_money: 1 } },
      ],
    },
  });
  const body = a.getBody();
  assert.strictEqual(body.apply_data.contents[0].control, 'Text');
  assert.strictEqual(body.apply_data.contents[1].control, 'Money');
});

test('4. template_id 在 ssot 找不到 → control 字段不补 (优雅降级)', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: 'NOT_IN_SSOT_999',
    creator: 'u1',
    content: [{ id: 'x', value: { text: 'hi' } }],
  });
  // 没补, 但也不报错
  assert.strictEqual(a.getBody().apply_data.contents[0].control, undefined);
});

test('5. 部分 contents 缺 control → 只补缺的 (不覆盖已有)', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: REAL_TID,
    creator: 'u1',
    content: [
      { control: 'Text', id: 'Text-1598340792149', value: { text: 'hi' } }, // 已有
      { id: 'Money-1598340792150', value: { new_money: 1 } }, // 缺
    ],
  });
  const body = a.getBody();
  assert.strictEqual(body.apply_data.contents[0].control, 'Text');
  assert.strictEqual(body.apply_data.contents[1].control, 'Money');
});

test('6. contents 为空 (无 content 字段) → 不抛错', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: REAL_TID, creator: 'u1',
  });
  assert.strictEqual(a.getBody().apply_data, undefined);
});

test('7. _templateDetail 预传 → 优先用预传 (不读 ssot)', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: REAL_TID,
    creator: 'u1',
    _templateDetail: {
      template_content: {
        controls: [{ control: 'CustomText', id: 'Text-1598340792149' }],
      },
    },
    content: [{ id: 'Text-1598340792149', value: { text: 'hi' } }],
  });
  assert.strictEqual(a.getBody().apply_data.contents[0].control, 'CustomText');
});

test('8. 真实场景: 退款给客户 - 无 control 字段直接提交 (老板 query 11:34 验证)', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: REAL_TID,
    callerUserid: 'JieXiaoYin',
    content: [
      { id: 'Text-1598340792149', value: { text: '客户某某' } },
      { id: 'Money-1598340792150', value: { new_money: 1 } },
      { id: 'Text-1598340792152', value: { text: '备注' } },
    ],
  });
  const body = a.getBody();
  assert.strictEqual(body.apply_data.contents[0].control, 'Text');
  assert.strictEqual(body.apply_data.contents[1].control, 'Money');
  assert.strictEqual(body.apply_data.contents[2].control, 'Text');
  // value 完整保留
  assert.strictEqual(body.apply_data.contents[0].value.text, '客户某某');
  assert.strictEqual(body.apply_data.contents[1].value.new_money, 1);
});

test('9. 内容完全为空 (apply_data: {}) → 不抛错', async () => {
  const a = newMock();
  await a.submitApproval({
    template_id: REAL_TID,
    creator_userid: 'u1',
    apply_data: {},
  });
  assert.strictEqual(JSON.stringify(a.getBody().apply_data), '{}');
});

test('10. contents 里含 comment/null 噪声 → 不抛错 (容错)', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: REAL_TID,
    creator: 'u1',
    content: [
      { id: 'Text-1598340792149', value: { text: 'hi' } },
      { comment: 'test' },
      null,
    ],
  });
  const body = a.getBody();
  assert.strictEqual(body.apply_data.contents[0].control, 'Text');
  assert.strictEqual(body.apply_data.contents[1].control, undefined);
  assert.strictEqual(body.apply_data.contents[2], null);
});

test('11. 多次提交 - 复用同一 SDK 实例不串扰', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: REAL_TID, creator: 'u1',
    content: [{ id: 'Text-1598340792149', value: { text: 'first' } }],
  });
  const body1 = a.getBody();
  assert.strictEqual(body1.apply_data.contents[0].control, 'Text');
});

test('12. 请假模板 (有 Vacation 控件) 也自动补', async () => {
  const a = newMock();
  const LEAVE_TID = 'C4Ramzh8A3FGmQvzq1HDv9nqnwu5rqSRRNULTxReQ';
  await a.submitApproval({
    templateId: LEAVE_TID,
    creator: 'u1',
    content: [
      { id: 'vacation-1563793073898', value: { leave_type: 2, start_time: 1753564800, end_time: 1753824000 }},
      { id: 'item-1497581399901', value: { text: '事由' }},
    ],
  });
  const body = a.getBody();
  // Vacation 控件补上
  assert.strictEqual(body.apply_data.contents[0].control, 'Vacation');
  // Textarea 控件补上
  assert.strictEqual(body.apply_data.contents[1].control, 'Textarea');
});
