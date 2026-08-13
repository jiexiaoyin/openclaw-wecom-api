// v2026-07-26: smartsheet-registry SSOT 单测
const test = require('node:test');
const assert = require('node:assert');

const {
  loadSmartSheetRegistry,
  validateJsonSchema,
} = require('../sdk/utils/smartsheet-registry');

test('1. loadSmartSheetRegistry 默认 validate=true 加载成功', () => {
  const reg = loadSmartSheetRegistry();
  assert.ok(reg._meta);
  assert.ok(reg._meta.schema_version);
  assert.ok(Array.isArray(reg.sheets));
  assert.ok(reg.sheets.length >= 2);
});

test('2. _meta 包含必需字段', () => {
  const reg = loadSmartSheetRegistry();
  assert.ok(reg._meta.schema_version);
  assert.match(reg._meta.schema_version, /^\d+\.\d+\.\d+$/);
  assert.ok(reg._meta.synced_at);
});

test('3. list() 返回完整 sheets 数组', () => {
  const reg = loadSmartSheetRegistry();
  const list = reg.list();
  assert.strictEqual(list.length, reg.sheets.length);
  list.forEach(s => {
    assert.ok(s.docid);
    assert.ok(s.name);
  });
});

test('4. count() 返回正确数量', () => {
  const reg = loadSmartSheetRegistry();
  assert.strictEqual(reg.count(), reg.sheets.length);
  assert.ok(reg.count() >= 2);
});

test('5. searchByName(晨报) 找到晨报日报', () => {
  const reg = loadSmartSheetRegistry();
  const hits = reg.searchByName('晨报');
  assert.ok(hits.length >= 1);
  assert.ok(hits.some(h => h.name === '晨报日报'));
});

test('6. searchByName(周报) 找到门店数据周报', () => {
  const reg = loadSmartSheetRegistry();
  const hits = reg.searchByName('周报');
  assert.ok(hits.some(h => h.name === '门店数据周报'));
});

test('7. searchByName("不存在的xyz") 返回空', () => {
  const reg = loadSmartSheetRegistry();
  const hits = reg.searchByName('不存在的xyz');
  assert.strictEqual(hits.length, 0);
});

test('8. getByDocId 精确查', () => {
  const reg = loadSmartSheetRegistry();
  const first = reg.list()[0];
  const got = reg.getByDocId(first.docid);
  assert.strictEqual(got.name, first.name);
});

test('9. getByDocId 不存在返回 null', () => {
  const reg = loadSmartSheetRegistry();
  const got = reg.getByDocId('DC_NOT_EXIST_xxx');
  assert.strictEqual(got, null);
});

test('10. getByName 精确查', () => {
  const reg = loadSmartSheetRegistry();
  const got = reg.getByName('晨报日报');
  assert.ok(got);
  assert.strictEqual(got.name, '晨报日报');
});

test('11. getByTag(cron) 找到带 cron tag 的所有', () => {
  const reg = loadSmartSheetRegistry();
  const hits = reg.getByTag('cron');
  assert.ok(hits.length >= 2);
});

test('12. searchByPurpose 模糊查', () => {
  const reg = loadSmartSheetRegistry();
  const hits = reg.searchByPurpose('cron');
  assert.ok(hits.length >= 1);
});

test('13. validateJsonSchema 正确数据 ok=true', () => {
  const reg = loadSmartSheetRegistry();
  const data = { _meta: reg._meta, sheets: reg.sheets };
  const schema = require('../docs/smartsheet-registry.schema.json');
  const r = validateJsonSchema(data, schema);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.errors, []);
});

test('14. validateJsonSchema 缺 docid → fail', () => {
  const bad = {
    _meta: { schema_version: '1.0.0', synced_at: '2026-07-26' },
    sheets: [{ name: 'no-docid' }]  // 缺 docid
  };
  const schema = require('../docs/smartsheet-registry.schema.json');
  const r = validateJsonSchema(bad, schema);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('docid')));
});

test('15. validateJsonSchema additionalProperties=false → fail', () => {
  const bad = {
    _meta: { schema_version: '1.0.0', synced_at: '2026-07-26' },
    sheets: [{ docid: 'DCxxx', name: 'x', unknown_field: 'boom' }]
  };
  const schema = require('../docs/smartsheet-registry.schema.json');
  const r = validateJsonSchema(bad, schema);
  assert.strictEqual(r.ok, false);
});

test('16. loadSmartSheetRegistry validate=false 仍加载', () => {
  const reg = loadSmartSheetRegistry({ validate: false });
  assert.ok(reg.sheets.length >= 2);
});

test('17. SDK document.searchSheets() 业务方法', () => {
  // 仅当有 config 才跑
  let realSDK = null;
  try {
    const W = require('../sdk');
    const cfg = require('../config.json');
    realSDK = new W(cfg);
  } catch (e) { return; }
  if (!realSDK) return;

  const all = realSDK.document.searchSheets();
  assert.ok(all.length >= 2);

  const morningPaper = realSDK.document.searchSheets({ name: '晨报' });
  assert.ok(morningPaper.some(s => s.name === '晨报日报'));
});

test('18. SDK document.registerSmartSheet() 检查重复 docid', () => {
  let realSDK = null;
  try {
    const W = require('../sdk');
    const cfg = require('../config.json');
    realSDK = new W(cfg);
  } catch (e) { return; }
  if (!realSDK) return;

  const dup = realSDK.document.registerSmartSheet({
    docid: 'DC1ARtPa1OXzzfPxxxxxx',  // 已存在
    name: '测试重复'
  });
  assert.strictEqual(dup.ok, false);
  assert.ok(dup.error.includes('已登记'));
});

test('19. SDK document.loadSmartSheetRegistry() 与 util 一致', () => {
  let realSDK = null;
  try {
    const W = require('../sdk');
    const cfg = require('../config.json');
    realSDK = new W(cfg);
  } catch (e) { return; }
  if (!realSDK) return;

  const reg1 = loadSmartSheetRegistry();
  const reg2 = realSDK.document.loadSmartSheetRegistry();
  assert.strictEqual(reg1.count(), reg2.count());
});

test('20. SDK document.searchSheets 4 维过滤 (name+tag+purpose+docid)', () => {
  let realSDK = null;
  try {
    const W = require('../sdk');
    const cfg = require('../config.json');
    realSDK = new W(cfg);
  } catch (e) { return; }
  if (!realSDK) return;

  const reg = realSDK.document.loadSmartSheetRegistry();
  const first = reg.list()[0];
  const got = realSDK.document.searchSheets({ docid: first.docid });
  assert.strictEqual(got.length, 1);
  assert.strictEqual(got[0].docid, first.docid);
});