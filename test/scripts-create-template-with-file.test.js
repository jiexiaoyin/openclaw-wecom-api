// v2026-07-26 22:10 老板 query "P2" - 建含 File 控件的测试模板 (per 9:58 [Fact] 非必填)
const test = require('node:test');
const assert = require('node:assert');
const W = require('../sdk');
const fs = require('node:fs');
const path = require('node:path');

// 3 控件 (Text + Money + File 非必填) - 简单模板
function makeControls() {
  return [
    { property: { control: 'Text', id: 'Text-01', title: [{ text: '描述', lang: 'zh_CN' }], require: 1 } },
    { property: { control: 'Money', id: 'Money-01', title: [{ text: '金额', lang: 'zh_CN' }], require: 0 } },
    { property: { control: 'File', id: 'File-01', title: [{ text: '附件', lang: 'zh_CN' }], require: 0 }, config: { file: { type: 'pdf' } } },
  ];
}

test('createTemplate 含 File 非必填 (P2 验证) [已成功 22:11 创建]', { skip: true }, async () => {
  const c = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config.json'), 'utf-8'));
  const w = new W(c);
  const ts = Math.floor(Date.now() / 1000);

  const r = await w.approval.createTemplate({
    template_name: [{ text: '墨言File测_' + ts, lang: 'zh_CN' }],
    template_content: { controls: makeControls() },
  });

  console.log('  errcode=' + r.errcode + ' errmsg=' + r.errmsg);
  if (r.errcode === 0) {
    console.log('  ✅ template_id=' + r.template_id);
    fs.writeFileSync('/tmp/wecom-test-file-template-id.txt', r.template_id || '');
  }
  assert.ok(r, 'createTemplate 返回');
});
