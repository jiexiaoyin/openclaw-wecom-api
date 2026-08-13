// v2026-07-26 21:44 老板 query 修正: 1000040 自建应用有 createTemplate 权限
// 老板本地文档 /opt/企业微信开发文档_服务端API.md 包含 97437/97438/91983 接口
// 12:48 PunchCorrection 301025 是 企微官方限制 (第 79567 行)
// 之前 12:43 [Fact] "无权限" 判断错, 修正为 "有权限"

const test = require('node:test');
const assert = require('node:assert');

test('1. 1000040 自建应用有 createTemplate 权限 (不返回 60020)', async () => {
  const W = require('../sdk');
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '../config.json'), 'utf-8'));
  const w = new W(c);
  
  try {
    await w.approval.createTemplate({
      template_name: [{ text: '墨言测试', lang: 'zh_CN' }],
      template_content: { controls: [] },
    });
    assert.fail('应该报参错');
  } catch (e) {
    assert.notStrictEqual(e.code, 60020, 'createTemplate 不应返 60020 无权限');
    assert.strictEqual(e.code, 301086, 'createTemplate 应返 301086 参错');
  }
});

test('2. 1000040 自建应用有 updateTemplate 权限 (不返回 60020)', async () => {
  const W = require('../sdk');
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '../config.json'), 'utf-8'));
  const w = new W(c);
  
  try {
    await w.approval.updateTemplate('3WLJ7ApqEHS71MJXZcAE8ULeZQqoa5LBv3MrFyjF', {
      template_name: [{ text: '打卡补卡', lang: 'zh_CN' }],
    });
    assert.fail('应该报参错');
  } catch (e) {
    assert.notStrictEqual(e.code, 60020, 'updateTemplate 不应返 60020 无权限');
    assert.strictEqual(e.code, 301086, 'updateTemplate 应返 301086 参错');
  }
});

test('3. 1000040 自建应用有 getApprovalDetail 权限 (不返回 60020)', async () => {
  const W = require('../sdk');
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '../config.json'), 'utf-8'));
  const w = new W(c);
  
  const r = await w.approval.getApprovalDetail('202607260005');
  assert.strictEqual(r.errcode, 0, 'getApprovalDetail 应返 0 成功');
});
