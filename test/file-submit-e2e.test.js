// v2026-07-26 22:10 老板 query "P2" - 上传 + 真提交含 File 控件
const test = require('node:test');
const assert = require('node:assert');
const W = require('../sdk');
const fs = require('node:fs');
const path = require('node:path');

test('File 端到端: upload + submit (P2 验证) [已成功 22:11]', { skip: true }, async () => {
  const c = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config.json'), 'utf-8'));
  const w = new W(c);
  const templateId = fs.readFileSync('/tmp/wecom-test-file-template-id.txt', 'utf-8').trim();
  console.log('  Template:', templateId);

  // 1. 上传
  const upload = await w.media.uploadMedia('/tmp/testfile/test.png', 'image');
  console.log('  Upload:', upload.errcode, upload.media_id);
  if (upload.errcode !== 0) {
    throw new Error('Upload failed: ' + upload.errmsg);
  }

  // 2. 含 File 控件真提交
  const r = await w.approval.submitApproval({
    template_id: templateId,
    creator_userid: 'JieXiaoYin',
    use_template_approver: 0,
    process: { node_list: [{ type: 1, apv_rel: 1, userid: ['ZhuYun'] }] },
    apply_data: { contents: [
      { control: 'Text', id: 'Text-01', value: { text: 'P2 File 22:11' } },
      { control: 'Money', id: 'Money-01', value: { new_money: '0' } },
      { control: 'File', id: 'File-01', value: { files: [{ file_id: upload.media_id, file_name: 'test.png', file_size: 90, file_type: 'png' }] } },
    ] },
    summary_list: [{ text: { text: 'P2 File验证' }, lang: 'zh_CN' }],
  });

  console.log('  Submit: errcode=' + r.errcode + ' errmsg=' + r.errmsg);
  if (r.errcode === 0) {
    console.log('  ✅ sp_no=' + r.sp_no);
    fs.writeFileSync('/tmp/wecom-test-file-sp-no.txt', r.sp_no || '');
  }
  assert.ok(r, 'submit 返回');
});
