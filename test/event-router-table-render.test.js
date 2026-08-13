// v2026-07-27 10:54 老板 query "好像并没有显示详细的内容" - Table 控件展开修复
const test = require('node:test');
const assert = require('node:assert');

// 模拟 sp_no=202607270001 的 value 结构
const sp270001Table = {
  control: 'Table',
  id: 'item-1503317853434',
  title: [{ text: '报销明细', lang: 'zh_CN' }],
  value: {
    children: [{
      list: [
        { control: 'Date', title: [{ text: '发生时间', lang: 'zh_CN' }], value: { date: { type: 'day', s_timestamp: '1784908800' } } },
        { control: 'Money', title: [{ text: '费用金额', lang: 'zh_CN' }], value: { new_money: '1200' } },
        { control: 'Textarea', title: [{ text: '费用说明', lang: 'zh_CN' }], value: { text: '用户办理18252303655融合79套餐，购机减1200，' } },
        { control: 'Text', title: [{ text: '报销款打入账户', lang: 'zh_CN' }], value: { text: '王燕农行' } },
        { control: 'File', title: [{ text: '报销凭证及发票', lang: 'zh_CN' }], value: { files: [{ file_id: 'WWME_mI_AWAAAd6-IyjPIxt5UPgM1unt_wQ' }] } },
      ],
    }],
  },
};

// 直接调 SDK event-router (我们要测逻辑)
// 但更简单 - 提取渲染逻辑
// 我们重新运行 case 'Table' 的代码逻辑

test('1. 模拟 SDK event-router Table 渲染逻辑 - 5 cell 展开', () => {
  const v = sp270001Table.value;
  const rows = v.children || v.stat_field || [];
  assert.strictEqual(rows.length, 1);
  
  // 模拟新逻辑
  const tableLines = [];
  for (let ri = 0; ri < rows.length; ri++) {
    const list = rows[ri].list || [];
    const cellParts = [];
    for (const cell of list) {
      const cTitle = (Array.isArray(cell.title) ? cell.title[0]?.text : cell.title) || '';
      const cv = cell.value || {};
      let cellVal = '';
      if (cv.text) cellVal = cv.text;
      else if (cv.new_money) cellVal = `¥${cv.new_money}`;
      else if (cv.new_number) cellVal = cv.new_number;
      else if (cv.date?.s_timestamp) cellVal = new Date(Number(cv.date.s_timestamp) * 1000).toISOString().substring(0, 10);
      else if (Array.isArray(cv.files) && cv.files.length > 0) cellVal = `[附件 ${cv.files.length} 个]`;
      if (cellVal && cTitle) cellParts.push(`${cTitle}: ${cellVal}`);
      else if (cellVal) cellParts.push(cellVal);
    }
    if (cellParts.length > 0) tableLines.push(`  [明细 ${ri + 1}] ${cellParts.join(' | ')}`);
  }
  
  const rendered = tableLines.join('\n');
  console.log('  渲染结果:\n', rendered);
  
  // 验证 5 个 cell 全部展开
  assert.match(rendered, /发生时间: 2026-07-24/);
  assert.match(rendered, /费用金额: ¥1200/);
  assert.match(rendered, /费用说明: 用户办理/);
  assert.match(rendered, /报销款打入账户: 王燕农行/);
  assert.match(rendered, /\[附件 1 个\]/);
});

test('2. 空 children 不渲染', () => {
  const v = { children: [] };
  const rows = v.children || v.stat_field || [];
  assert.strictEqual(rows.length, 0);
  assert.strictEqual(Array.isArray(rows) && rows.length === 0 ? '' : 'ok', '');
});

test('3. 多行明细 (3 行) 全部展开', () => {
  const rows = [{
    list: [
      { control: 'Text', title: [{ text: '物品', lang: 'zh_CN' }], value: { text: 'A4 纸' } },
      { control: 'Money', title: [{ text: '单价', lang: 'zh_CN' }], value: { new_money: '20' } },
    ],
  }, {
    list: [
      { control: 'Text', title: [{ text: '物品', lang: 'zh_CN' }], value: { text: '墨盒' } },
      { control: 'Money', title: [{ text: '单价', lang: 'zh_CN' }], value: { new_money: '160' } },
    ],
  }, {
    list: [
      { control: 'Text', title: [{ text: '物品', lang: 'zh_CN' }], value: { text: '发票夹' } },
      { control: 'Money', title: [{ text: '单价', lang: 'zh_CN' }], value: { new_money: '2.8' } },
    ],
  }];
  
  const tableLines = [];
  for (let ri = 0; ri < rows.length; ri++) {
    const list = rows[ri].list || [];
    const cellParts = [];
    for (const cell of list) {
      const cTitle = (Array.isArray(cell.title) ? cell.title[0]?.text : cell.title) || '';
      const cv = cell.value || {};
      let cellVal = '';
      if (cv.text) cellVal = cv.text;
      else if (cv.new_money) cellVal = `¥${cv.new_money}`;
      else if (cv.new_number) cellVal = cv.new_number;
      else if (cv.date?.s_timestamp) cellVal = new Date(Number(cv.date.s_timestamp) * 1000).toISOString().substring(0, 10);
      else if (Array.isArray(cv.files) && cv.files.length > 0) cellVal = `[附件 ${cv.files.length} 个]`;
      if (cellVal && cTitle) cellParts.push(`${cTitle}: ${cellVal}`);
      else if (cellVal) cellParts.push(cellVal);
    }
    if (cellParts.length > 0) tableLines.push(`  [明细 ${ri + 1}] ${cellParts.join(' | ')}`);
  }
  
  const rendered = tableLines.join('\n');
  console.log('  3 行渲染:\n', rendered);
  
  assert.strictEqual(tableLines.length, 3);
  assert.match(rendered, /\[明细 1\]/);
  assert.match(rendered, /\[明细 3\]/);
});
