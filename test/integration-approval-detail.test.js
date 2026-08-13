'use strict';

/**
 * 单元测试: buildApprovalDetail 7 种控件解析 (2026-07-26 老板 query 完整实现)
 *
 * 覆盖:
 *   1. Text / Textarea
 *   2. Number
 *   3. Money
 *   4. Date / DateTime
 *   5. Selector (single + multi)
 *   6. Contact
 *   7. Table
 *   8. File / Files
 *   边界: hidden=1 过滤 / 空值过滤 / 长值截断 / 字段数上限 / require 排序
 */

const { test } = require('node:test');
const assert = require('node:assert');
const mod = require('../bin/event-router.js');

// 模拟 SDK
const makeMockSDK = (mockGetApprovalDetailResponse) => ({
  approval: {
    getApprovalDetail: async (spNo) => mockGetApprovalDetailResponse,
  },
  addressbook: {
    getUser: async (userId) => ({ errcode: 0, name: userId === 'TestUser' ? '测试用户' : userId }),
  },
});

const makeContent = (overrides = {}) => ({
  control: 'Text',
  id: 'Text-test',
  title: [{ text: '测试字段', lang: 'zh_CN' }],
  value: { text: '测试值' },
  display: 1,
  require: 0,
  hidden: 0,
  ...overrides,
});

test('1. Text 控件解析', async () => {
  const w = makeMockSDK({ info: { apply_data: { contents: [makeContent({ value: { text: '尚雨婷' } })] } } });
  const out = await mod.buildApprovalDetail(w, 'TEST_001');
  assert.strictEqual(out.fields.length, 1);
  assert.strictEqual(out.fields[0].key, '测试字段');
  assert.strictEqual(out.fields[0].value, '尚雨婷');
});

test('2. Textarea 控件解析 (长文本)', async () => {
  const longText = 'a'.repeat(100);
  const w = makeMockSDK({ info: { apply_data: { contents: [makeContent({ control: 'Textarea', value: { text: longText } })] } } });
  const out = await mod.buildApprovalDetail(w, 'TEST_002');
  assert.strictEqual(out.fields.length, 1);
  // 默认 maxFieldValue=80, 应被截断到 80 + '…'
  assert.strictEqual(out.fields[0].value.length, 81);
  assert.ok(out.fields[0].value.endsWith('…'));
});

test('3. Number 控件解析', async () => {
  const w = makeMockSDK({ info: { apply_data: { contents: [makeContent({ control: 'Number', value: { new_number: '18052374957' }, title: [{ text: '支付宝账号', lang: 'zh_CN' }] })] } } });
  const out = await mod.buildApprovalDetail(w, 'TEST_003');
  assert.strictEqual(out.fields[0].value, '18052374957');
});

test('4. Money 控件解析 (¥ 前缀)', async () => {
  // v2026-07-26 09:52 fix: Money control value 字段是 new_money (不是 new_number)
  // 此前测试用 new_number 是错误假设, 跟真实企微 SDK 返回不符
  const w = makeMockSDK({ info: { apply_data: { contents: [makeContent({ control: 'Money', value: { new_money: '1234.56' }, title: [{ text: '退款金额', lang: 'zh_CN' }] })] } } });
  const out = await mod.buildApprovalDetail(w, 'TEST_004');
  assert.strictEqual(out.fields[0].value, '¥1234.56');
});

test('5. Date 控件解析', async () => {
  const w = makeMockSDK({ info: { apply_data: { contents: [makeContent({ control: 'Date', value: { date: '2026-07-25' }, title: [{ text: '日期', lang: 'zh_CN' }] })] } } });
  const out = await mod.buildApprovalDetail(w, 'TEST_005');
  assert.strictEqual(out.fields[0].value, '2026-07-25');
});

test('6. DateTime 控件解析 (fallback 链)', async () => {
  const w = makeMockSDK({ info: { apply_data: { contents: [makeContent({ control: 'DateTime', value: { date_time: '2026-07-25 17:45' }, title: [{ text: '时间', lang: 'zh_CN' }] })] } } });
  const out = await mod.buildApprovalDetail(w, 'TEST_006');
  assert.strictEqual(out.fields[0].value, '2026-07-25 17:45');
});

test('7. Selector (single) 控件解析', async () => {
  const w = makeMockSDK({
    info: {
      apply_data: {
        contents: [makeContent({
          control: 'Selector',
          title: [{ text: '退款类型', lang: 'zh_CN' }],
          value: {
            selector: {
              type: 'single',
              options: [{ key: 'k1', value: [{ text: '移动5G金币', lang: 'zh_CN' }] }],
            },
          },
        })],
      },
    },
  });
  const out = await mod.buildApprovalDetail(w, 'TEST_007');
  assert.strictEqual(out.fields[0].value, '移动5G金币');
});

test('8. Selector (multi) 控件解析 (逗号拼接)', async () => {
  const w = makeMockSDK({
    info: {
      apply_data: {
        contents: [makeContent({
          control: 'Selector',
          title: [{ text: '多选', lang: 'zh_CN' }],
          value: {
            selector: {
              type: 'multi',
              options: [
                { key: 'k1', value: [{ text: '选项A', lang: 'zh_CN' }] },
                { key: 'k2', value: [{ text: '选项B', lang: 'zh_CN' }] },
              ],
            },
          },
        })],
      },
    },
  });
  const out = await mod.buildApprovalDetail(w, 'TEST_008');
  assert.strictEqual(out.fields[0].value, '选项A, 选项B');
});

test('9. Contact 控件解析', async () => {
  const w = makeMockSDK({
    info: {
      apply_data: {
        contents: [makeContent({
          control: 'Contact',
          title: [{ text: '相关人员', lang: 'zh_CN' }],
          value: { members: [{ name: '朱云' }, { userid: 'ZhouZhou' }] },
        })],
      },
    },
  });
  const out = await mod.buildApprovalDetail(w, 'TEST_009');
  assert.strictEqual(out.fields[0].value, '朱云, ZhouZhou');
});

test('10. Table 控件解析 (展开明细 cell, v2026-07-27 老板 query 10:54)', async () => {
  const w = makeMockSDK({
    info: {
      apply_data: {
        contents: [makeContent({
          control: 'Table',
          title: [{ text: '明细表', lang: 'zh_CN' }],
          value: { children: [{
            list: [
              { control: 'Text',  title: [{ text: '物品', lang: 'zh_CN' }], value: { text: 'A4 纸' } },
              { control: 'Money', title: [{ text: '单价', lang: 'zh_CN' }], value: { new_money: '20' } },
            ],
          }] },
        })],
      },
    },
  });
  const out = await mod.buildApprovalDetail(w, 'TEST_010');
  // 新行为: 展开 cell 内容
  assert.match(out.fields[0].value, /\[明细 1\]/);
  assert.match(out.fields[0].value, /物品: A4 纸/);
  assert.match(out.fields[0].value, /单价: ¥20/);
});

test('11. File / Files 控件解析', async () => {
  const w = makeMockSDK({
    info: {
      apply_data: {
        contents: [makeContent({
          control: 'Files',
          title: [{ text: '销售截图', lang: 'zh_CN' }],
          value: { files: [{ id: 'f1' }, { id: 'f2' }] },
        })],
      },
    },
  });
  const out = await mod.buildApprovalDetail(w, 'TEST_011');
  assert.strictEqual(out.fields[0].value, '[附件 2 个]');
});

test('12. hidden=1 字段过滤', async () => {
  const w = makeMockSDK({
    info: {
      apply_data: {
        contents: [
          makeContent({ title: [{ text: '可见字段', lang: 'zh_CN' }], value: { text: '可见值' } }),
          makeContent({ title: [{ text: '隐藏字段', lang: 'zh_CN' }], value: { text: '隐藏值' }, hidden: 1 }),
        ],
      },
    },
  });
  const out = await mod.buildApprovalDetail(w, 'TEST_012');
  assert.strictEqual(out.fields.length, 1);
  assert.strictEqual(out.fields[0].key, '可见字段');
});

test('13. 空值字段过滤', async () => {
  const w = makeMockSDK({
    info: {
      apply_data: {
        contents: [
          makeContent({ title: [{ text: '已填', lang: 'zh_CN' }], value: { text: '已填值' } }),
          makeContent({ title: [{ text: '空文本', lang: 'zh_CN' }], value: { text: '' } }),
          makeContent({ control: 'Number', title: [{ text: '空数字', lang: 'zh_CN' }], value: { new_number: '' } }),
        ],
      },
    },
  });
  const out = await mod.buildApprovalDetail(w, 'TEST_013');
  assert.strictEqual(out.fields.length, 1);
  assert.strictEqual(out.fields[0].key, '已填');
});

test('14. require=1 字段优先排序', async () => {
  const w = makeMockSDK({
    info: {
      apply_data: {
        contents: [
          makeContent({ id: 'c1', title: [{ text: '选填1', lang: 'zh_CN' }], value: { text: 'v1' }, require: 0 }),
          makeContent({ id: 'c2', title: [{ text: '必填1', lang: 'zh_CN' }], value: { text: 'v2' }, require: 1 }),
          makeContent({ id: 'c3', title: [{ text: '选填2', lang: 'zh_CN' }], value: { text: 'v3' }, require: 0 }),
          makeContent({ id: 'c4', title: [{ text: '必填2', lang: 'zh_CN' }], value: { text: 'v4' }, require: 1 }),
        ],
      },
    },
  });
  const out = await mod.buildApprovalDetail(w, 'TEST_014');
  // 必填在前: 必填1, 必填2, 选填1, 选填2
  assert.deepStrictEqual(out.fields.map(f => f.key), ['必填1', '必填2', '选填1', '选填2']);
});

test('15. 字段数上限 (maxFields)', async () => {
  const contents = Array.from({ length: 35 }, (_, i) => makeContent({
    id: `c${i}`,
    title: [{ text: `字段${i}`, lang: 'zh_CN' }],
    value: { text: `值${i}` },
  }));
  const w = makeMockSDK({ info: { apply_data: { contents } } });
  const out = await mod.buildApprovalDetail(w, 'TEST_015', { maxFields: 5 });
  assert.strictEqual(out.fields.length, 5);
  assert.strictEqual(out.truncated, true);
});

test('16. 标题多语言 fallback (zh_CN → en → id)', async () => {
  const w = makeMockSDK({
    info: {
      apply_data: {
        contents: [
          makeContent({ title: [{ text: 'Title', lang: 'en' }], value: { text: 'v1' } }),
          makeContent({ title: [{ text: '标题', lang: 'zh_CN' }, { text: 'Title', lang: 'en' }], value: { text: 'v2' } }),
          makeContent({ title: [], value: { text: 'v3' }, id: 'Text-no-title' }),
        ],
      },
    },
  });
  const out = await mod.buildApprovalDetail(w, 'TEST_016');
  assert.strictEqual(out.fields[0].key, 'Title');         // 唯一 en
  assert.strictEqual(out.fields[1].key, '标题');           // 优先 zh_CN
  assert.strictEqual(out.fields[2].key, 'Text-no-title'); // fallback id
});

test('17. SDK 异常时返回空 (不应抛错)', async () => {
  const w = {
    approval: {
      getApprovalDetail: async () => { throw new Error('network timeout'); },
    },
  };
  const out = await mod.buildApprovalDetail(w, 'TEST_017');
  assert.deepStrictEqual(out.fields, []);
  assert.strictEqual(out.truncated, false);
});

test('18. resp 无 info 字段时返回空', async () => {
  const w = makeMockSDK({ errcode: 0, errmsg: 'ok' });  // 无 info
  const out = await mod.buildApprovalDetail(w, 'TEST_018');
  assert.deepStrictEqual(out.fields, []);
});

test('19. writeDebugSnapshot 写文件 + FFO 20 个', async () => {
  const fs = require('fs');
  const dir = '/opt/openclaw/state/wecom-approval-debug';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 先清旧文件 (避免污染断言)
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('TEST_019-'))) {
    fs.unlinkSync(`${dir}/${f}`);
  }

  // 写 25 个, 应 FFO 保留 20
  for (let i = 0; i < 25; i++) {
    mod.writeDebugSnapshot('TEST_019', { error: `mock error ${i}` });
  }
  const files = fs.readdirSync(dir).filter(f => f.startsWith('TEST_019-')).sort();
  assert.strictEqual(files.length, 20);  // FFO

  // 清理
  for (const f of files) fs.unlinkSync(`${dir}/${f}`);
});

test('20. 端到端: sp_no=202607250001 (真实数据, 需要 daemon 已配置)', async () => {
  // 这个测试只在有真实 SDK 配置时跑
  let realSDK = null;
  try {
    const Wecom = require('../sdk');
    const config = require('../config.json');
    realSDK = new Wecom(config);
  } catch (e) {
    // 跳过
    return;
  }
  if (!realSDK) return;
  const out = await mod.buildApprovalDetail(realSDK, '202607250001');
  // 不强制断言字段 (取决于真实数据), 只断言不抛错
  assert.ok(Array.isArray(out.fields));
  assert.strictEqual(typeof out.truncated, 'boolean');
});
test('21. Table 多 cell 行 (sp_no=202607270003 真实数据) 不被外层 80 字截断', async () => {
  // v2026-07-27 19:38 fix (老板 query): 5 cell 拼接 102 字符, 之前被外层 80 字符截断到 "高献..."
  // 期望: 完整显示 5 cell (Date/Money/Textarea/Text/File)
  const realFixture = {
    info: {
      sp_no: '202607270003',
      apply_data: {
        contents: [
          {
            control: 'Selector',
            id: 'Selector-1',
            title: [{ text: '报销类型', lang: 'zh_CN' }],
            value: { selector: { options: [{ key: 'opt1', value: [{ text: '其他', lang: 'zh_CN' }] }] } },
            display: 1, require: 1, hidden: 0,
          },
          {
            control: 'Table',
            id: 'item-1503317853434',
            title: [{ text: '报销明细', lang: 'zh_CN' }],
            value: {
              children: [{
                list: [
                  { control: 'Date', title: [{ text: '发生时间', lang: 'zh_CN' }],
                    value: { date: { type: 'day', s_timestamp: '1785081600' } } },
                  { control: 'Money', title: [{ text: '费用金额', lang: 'zh_CN' }],
                    value: { new_money: '13.9' } },
                  { control: 'Textarea', title: [{ text: '费用说明', lang: 'zh_CN' }],
                    value: { text: '店内垃圾袋和报警器遥控器电池' } },
                  { control: 'Text', title: [{ text: '报销款打入账户（姓名账户）', lang: 'zh_CN' }],
                    value: { text: '高献梅' } },
                  { control: 'File', title: [{ text: '报销凭证及发票', lang: 'zh_CN' }],
                    value: { files: [{ file_id: 'f1' }, { file_id: 'f2' }] } },
                ],
              }],
            },
            display: 1, require: 1, hidden: 0,
          },
        ],
      },
    },
  };
  const w = makeMockSDK(realFixture);
  const out = await mod.buildApprovalDetail(w, 'TEST_TABLE_MULTICELL');
  const f = out.fields.find(x => x.key === '报销明细');
  assert.ok(f, '应有 报销明细 字段');
  // 完整 5 cell 拼接长度: 102 字符, 不应被截断到 80 + '…'
  console.log('  value.length =', f.value.length);
  console.log('  value =', f.value);
  assert.ok(!f.value.endsWith('…'), 'Table 多 cell 行不应被外层 80 截断');
  assert.ok(f.value.includes('高献梅'), '应包含完整姓名 高献梅');
  assert.ok(f.value.includes('报销凭证及发票'), '应包含报销凭证及发票 cell');
  assert.ok(f.value.includes('[附件 2 个]'), '应包含发票附件数');
});

test('22. 单字段 Textarea (回归) 仍被外层 80 字截断', async () => {
  // 验证多 cell 跳过逻辑不影响单字段截断
  const longText = 'a'.repeat(100);
  const w = makeMockSDK({ info: { apply_data: { contents: [makeContent({ control: 'Textarea', value: { text: longText } })] } } });
  const out = await mod.buildApprovalDetail(w, 'TEST_022');
  assert.strictEqual(out.fields[0].value.length, 81);
  assert.ok(out.fields[0].value.endsWith('…'));
});
