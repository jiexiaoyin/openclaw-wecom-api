// v2026-07-26: submitApproval 字段兼容性 + bool→int 自动转
const test = require('node:test');
const assert = require('node:assert');

const Approval = require('../sdk/modules/approval');

function newMock() {
  const a = new Approval({ corpId: 'test', corpSecret: 'secret' });
  let captured = null;
  a.post = async (url, data) => { captured = data; return { errcode: 0, captured, url }; };
  a.getLastBody = () => captured;
  return a;
}

test('1. 高层 + boolean true use_template_approver → uint32 1', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: 't1', creator: 'u1',
    useTemplate_approver: true,
    content: [{ id: 'x', value: { text: 'hi' } }],
  });
  assert.strictEqual(a.getLastBody().use_template_approver, 1);
});

test('2. 原生 + boolean false → uint32 0', async () => {
  const a = newMock();
  await a.submitApproval({
    template_id: 't1', creator_userid: 'u1',
    use_template_approver: false,
  });
  assert.strictEqual(a.getLastBody().use_template_approver, 0);
});

test('3. 原生接受 callerUserid 别名', async () => {
  const a = newMock();
  await a.submitApproval({
    template_id: 't1', callerUserid: 'JieXiaoYin',
    use_template_approver: 1,
  });
  assert.strictEqual(a.getLastBody().creator_userid, 'JieXiaoYin');
});

test('4. 原生接受 applyData 别名', async () => {
  const a = newMock();
  await a.submitApproval({
    template_id: 't1', creator_userid: 'u1',
    applyData: { contents: [{ id: 'x', value: { text: 'hi' } }] },
  });
  assert.ok(a.getLastBody().apply_data);
  assert.strictEqual(a.getLastBody().apply_data.contents[0].id, 'x');
});

test('5. use_template_approver 字符串 "1" → uint32 1', async () => {
  const a = newMock();
  await a.submitApproval({
    template_id: 't1', creator_userid: 'u1',
    use_template_approver: '1',
  });
  assert.strictEqual(a.getLastBody().use_template_approver, 1);
});

test('6. 高层接受 contents 别名', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: 't1', creator: 'u1',
    contents: [{ id: 'x', value: { text: 'hi' } }],
  });
  assert.ok(a.getLastBody().apply_data.contents);
});

test('7. 完整老板 query 11:21 场景 (原型)', async () => {
  const a = newMock();
  const r = await a.submitApproval({
    templateId: 'C4Ramzh8A3FGmQvzq1HDv9nqnwu5rqSRRNULTxReQ',
    callerUserid: 'JieXiaoYin',
    useTemplateApprover: true,
    content: [
      { id: 'vacation-1563793073898', value: { leave_type: 2, start_time: 1753564800, end_time: 1753824000 }},
      { id: 'item-1497581399901', value: { text: '外出学习' }},
    ],
  });
  const body = a.getLastBody();
  assert.strictEqual(body.template_id, 'C4Ramzh8A3FGmQvzq1HDv9nqnwu5rqSRRNULTxReQ');
  assert.strictEqual(body.creator_userid, 'JieXiaoYin');
  assert.strictEqual(body.use_template_approver, 1);
  assert.ok(body.apply_data.contents);
  assert.strictEqual(body.apply_data.contents[0].id, 'vacation-1563793073898');
});

test('8. 默认 use_template_approver = 0', async () => {
  const a = newMock();
  await a.submitApproval({
    template_id: 't1', creator_userid: 'u1',
  });
  assert.strictEqual(a.getLastBody().use_template_approver, 0);
});

test('9. 原生混用 templateId + native 字段', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: 't1',  // 高层 alias
    creator_userid: 'u1',  // 原生字段
    use_template_approver: 1,
    apply_data: { contents: [{ id: 'x', value: { text: 'hi' } }] },  // 原生
  });
  // 是原生模式 (apply_data 存在)
  const body = a.getLastBody();
  assert.strictEqual(body.template_id, 't1');
  assert.ok(body.apply_data);
});

test('10. apply_data 已传, content 优先忽略 (避免冲突)', async () => {
  const a = newMock();
  await a.submitApproval({
    templateId: 't1', creator: 'u1',
    apply_data: { contents: [{ id: 'a', value: { text: 'A' }}] },
    content: [{ id: 'b', value: { text: 'B' }}],
  });
  // 高层模式 (无 creator_userid/process/summary_list 标记)
  // 应该 apply_data 优先
  const body = a.getLastBody();
  assert.ok(body.apply_data);
  assert.strictEqual(body.apply_data.contents[0].id, 'a');
});