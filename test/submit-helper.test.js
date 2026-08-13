// v2026-07-26 13:17 通用 submit helper (L1+L2+L3) + 4 builder 单测
const test = require('node:test');
const assert = require('node:assert');
const Approval = require('../sdk/modules/approval');

// Mock SDK submit path
function mockApproval() {
  const a = new Approval({ corpId:'t', corpSecret:'s' });
  let lastPost = null;
  a.searchTemplates = () => [{group:'人事', name:'请假测试', template_id:'TEST_TID'}];
  a.post = async (url, data) => {
    if (url.includes('gettemplatedetail')) {
      // 返回"请假"模板: Vacation + Textarea + Text(申请人)
      return {
        errcode: 0,
        template_names: [{text:'请假测试',lang:'zh_CN'}],
        template_content: {
          controls: [
            {
              id: 'vacation-1563793073898',
              property: {
                control: 'Vacation', id: 'vacation-1563793073898',
                title: [{text:'请假类型',lang:'zh_CN'}],
                require: 1,
              },
            },
            {
              id: 'item-reason-99',
              property: {
                control: 'Textarea', id: 'item-reason-99',
                title: [{text:'请假事由',lang:'zh_CN'}],
                require: 1,
              },
            },
            {
              id: 'item-applicant-99',
              property: {
                control: 'Text', id: 'item-applicant-99',
                title: [{text:'申请人',lang:'zh_CN'}],
                require: 0,
              },
            },
          ],
        },
      };
    }
    lastPost = data;
    return { errcode:0, errmsg:'ok', sp_no:'TEST_SP' };
  };
  a.getLastPost = ()=>lastPost;
  return a;
}

test('1. buildMoneyValue - 字符串化 (跟老板 11:38 踩坑一致)', () => {
  const a = new Approval({});
  assert.strictEqual(a.buildMoneyValue({new_money: 1.00}).new_money, '1');
  assert.deepStrictEqual(a.buildMoneyValue({new_money: '0.01'}), { new_money: '0.01' });
  assert.deepStrictEqual(a.buildMoneyValue({new_money: 0}), { new_money: '0' });
});

test('2. buildMoneyValue 必填缺失报错', () => {
  const a = new Approval({});
  assert.throws(() => a.buildMoneyValue({}));
  assert.throws(() => a.buildMoneyValue({new_money: null}));
});

test('3. buildSelectorValue - 完整 options', () => {
  const a = new Approval({});
  const v = a.buildSelectorValue({
    type:'single',
    options:[{ key:'option-123', value:[{text:'差旅费',lang:'zh_CN'}] }],
  });
  assert.strictEqual(v.selector.type,'single');
  assert.deepStrictEqual(v.selector.op_relations, []);
  assert.strictEqual(v.selector.options[0].key,'option-123');
  assert.strictEqual(v.selector.options[0].value[0].text,'差旅费');
});

test('4. buildSelectorValue - 简化 options 自动补 value', () => {
  const a = new Approval({});
  const v = a.buildSelectorValue({ options:[{key:'事假'}] });
  assert.strictEqual(v.selector.options[0].key,'事假');
  assert.strictEqual(v.selector.options[0].value[0].text,'事假');
  assert.strictEqual(v.selector.options[0].value[0].lang,'zh_CN');
});

test('5. buildSelectorValue 必填缺失报错', () => {
  const a = new Approval({});
  assert.throws(() => a.buildSelectorValue({}));
  assert.throws(() => a.buildSelectorValue({options: []}));
});

test('6. buildNumberValue', () => {
  const a = new Approval({});
  assert.deepStrictEqual(a.buildNumberValue({number: 3}), {new_number:'3'});
  assert.deepStrictEqual(a.buildNumberValue({number: '5'}), {new_number:'5'});
  assert.throws(() => a.buildNumberValue({}));
});

test('7. submit({template, caller, data}) - 请事假 3 天 (title 形式)', async () => {
  const a = mockApproval();
  const r = await a.submit({
    template: '请假测试',
    caller: 'JieXiaoYin',
    data: {
      '请假类型': { leaveTypeId: 2, leaveTypeName: '事假', startTime: 1753574400, endTime: 1753833600 },
      '请假事由': '外出学习',
      '申请人': 'JieXiaoYin',
    },
  });
  assert.strictEqual(r.errcode, 0);
  const body = a.getLastPost();
  // vacation content
  const v = body.apply_data.contents.find(c => c.id === 'vacation-1563793073898');
  assert.ok(v);
  assert.strictEqual(v.control, 'Vacation');
  assert.strictEqual(v.value.vacation.selector.options[0].key, '2');
  // reason
  const reason = body.apply_data.contents.find(c => c.id === 'item-reason-99');
  assert.strictEqual(reason.value.text, '外出学习');
});

test('8. submit() 模板名不匹配 报错 (L1 防御)', async () => {
  const a = new Approval({});
  a.searchTemplates = () => [];
  a.getTemplateDetail = async () => ({});
  const r = await a.submit({ template: '不存在模板', caller: 'u1', data: {} });
  assert.strictEqual(r.errcode, -1);
  assert.ok(r.errmsg.includes('未找到模板'));
});

test('9. submit() 模板名重复命中 报错 (L1 防御)', async () => {
  const a = new Approval({});
  a.searchTemplates = () => [
    { group:'人事', name:'请假', template_id:'t1' },
    { group:'人事', name:'请假', template_id:'t2' },
  ];
  a.getTemplateDetail = async () => ({});
  const r = await a.submit({ template: '请假', caller: 'u1', data: {} });
  assert.strictEqual(r.errcode, -1);
  assert.ok(r.errmsg.includes('命中 2 个'));
});

test('10. submit() Money 控件 - 传 number 自动转 string', async () => {
  const a = new Approval({});
  a.searchTemplates = () => [{group:'财务',name:'退款',template_id:'tpl_refund'}];
  a.getTemplateDetail = async () => ({
    errcode: 0,
    template_content: { controls: [
      { id:'Money-1', property:{control:'Money', id:'Money-1', title:[{text:'退款金额',lang:'zh_CN'}], require:1} },
    ]},
  });
  a.post = async () => ({errcode:0,errmsg:'ok',sp_no:'TEST_MONEY'});
  const r = await a.submit({
    template: '退款', caller: 'u1',
    data: { '退款金额': 0.01 },
  });
  assert.strictEqual(r.errcode, 0);
});

test('11. submit() Selector 控件 - 字符串值自动 wrap', async () => {
  const a = new Approval({});
  a.searchTemplates = () => [{group:'财务',name:'报销',template_id:'tpl_bx'}];
  a.getTemplateDetail = async () => ({
    errcode: 0,
    template_content: { controls: [
      { id:'sel-1', property:{control:'Selector', id:'sel-1', title:[{text:'报销类型',lang:'zh_CN'}], require:1} },
    ]},
  });
  let captured;
  a.post = async (url, data) => { captured = data; return {errcode:0,errmsg:'ok'}; };
  await a.submit({
    template: '报销', caller: 'u1',
    data: { '报销类型': '差旅费' },
  });
  const sel = captured.apply_data.contents[0];
  assert.strictEqual(sel.control, 'Selector');
  assert.strictEqual(sel.value.selector.options[0].key, '差旅费');
  assert.strictEqual(sel.value.selector.options[0].value[0].text, '差旅费');
});

test('12. submit() 未验证控件 - raw value 透传', async () => {
  const a = new Approval({});
  a.searchTemplates = () => [{group:'人事',name:'出差',template_id:'tpl_travel'}];
  a.getTemplateDetail = async () => ({
    errcode: 0,
    template_content: { controls: [
      { id:'F-1', property:{control:'File', id:'F-1', title:[{text:'附件',lang:'zh_CN'}], require:0} },
      { id:'T-1', property:{control:'Text', id:'T-1', title:[{text:'出差原因',lang:'zh_CN'}], require:1} },
    ]},
  });
  let captured;
  a.post = async (url, data) => { captured = data; return {errcode:0,errmsg:'ok'}; };
  await a.submit({
    template: '出差', caller: 'u1',
    data: { '出差原因': '客户拜访', '附件': { files: [] } },
  });
  // File 控件传 raw value
  const file = captured.apply_data.contents.find(c => c.id === 'F-1');
  assert.deepStrictEqual(file.value, { files: [] });
  // Text 控件 走 builder
  const text = captured.apply_data.contents.find(c => c.id === 'T-1');
  assert.strictEqual(text.value.text, '客户拜访');
});
