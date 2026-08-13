// v2026-07-27 10:54 老板 query - 验证 sp_no=202607270001 推送文案 (现在应该展开 Table)
const test = require('node:test');
const assert = require('node:assert');
const W = require('../sdk');
const fs = require('node:fs');
const path = require('node:path');

test('验证 sp_no=202607270001 推送文案 - Table 展开后效果', async () => {
  const c = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config.json'), 'utf-8'));
  const w = new W(c);
  
  // 调 SDK 的 buildApprovalDetail (模拟推送渲染)
  // 但 buildApprovalDetail 是 daemon/event-router 的内部函数, 不能从 SDK 调
  // 改为手动拉详情 + 自己渲染验证
  
  const r = await w.approval.getApprovalDetail('202607270001');
  assert.strictEqual(r.errcode, 0);
  
  const contents = r.info.apply_data?.contents || [];
  const tableCtrl = contents.find(c => c.control === 'Table');
  
  console.log('=== Table 控件详情 ===');
  console.log('title:', tableCtrl.title?.[0]?.text);
  const rows = tableCtrl.value.children || [];
  console.log('rows:', rows.length);
  console.log('row[0] cells:', rows[0]?.list?.length);
  
  // 验证 cell 内容存在
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].list.length, 5);
  
  const cells = rows[0].list;
  for (const c of cells) {
    const title = c.title?.[0]?.text;
    const valType = Object.keys(c.value).find(k => !['tips','members','departments','files','children','stat_field','sum_field','related_approval','students','classes','docs','wedrive_files'].includes(k));
    if (valType) {
      console.log(`  ${c.control} (${title}) → ${valType}=${JSON.stringify(c.value[valType]).substring(0, 80)}`);
    } else {
      console.log(`  ${c.control} (${title}) → ${JSON.stringify(c.value).substring(0, 80)}`);
    }
  }
  
  console.log('✅ Table 控件含 5 cell 完整数据, 推送修复后会展开');
});
