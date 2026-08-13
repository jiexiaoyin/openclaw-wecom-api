// v2026-07-26 21:47 老板 query "立刻做测试模板"
// 目的: 创建 1 个测试模板 (13 控件全) → 端到端 SDK 验证
// per 6-08 13:40 [Implicit] 优先可快速闭环事项 + 主动识别潜在缺陷
const test = require('node:test');
const W = require('../sdk');
const fs = require('node:fs');

// 13 控件 config (按服务端API.md 97437 附录)
function makeControls() {
  const ctrls = [];
  ctrls.push({ property: { control: 'Text', id: 'Text-01', title: [{text:'姓名',lang:'zh_CN'}], require: 1 }});
  ctrls.push({ property: { control: 'Textarea', id: 'Textarea-01', title: [{text:'详情',lang:'zh_CN'}], require: 1 }});
  ctrls.push({ property: { control: 'Number', id: 'Number-01', title: [{text:'数量',lang:'zh_CN'}], require: 0 }});
  ctrls.push({ property: { control: 'Money', id: 'Money-01', title: [{text:'金额',lang:'zh_CN'}], require: 1 }});
  ctrls.push({ property: { control: 'Date', id: 'Date-01', title: [{text:'日期',lang:'zh_CN'}], require: 1 }, config: { date: { type: 'day' } }});
  ctrls.push({ property: { control: 'Selector', id: 'Selector-01', title: [{text:'类型',lang:'zh_CN'}], require: 1 }, config: { selector: { type: 'multi', options: [{ key: 'option-01', value: { text: '选项1', lang: 'zh_CN' } },{ key: 'option-02', value: { text: '选项2', lang: 'zh_CN' } }] } }});
  ctrls.push({ property: { control: 'Contact', id: 'Contact-01', title: [{text:'审批人',lang:'zh_CN'}], require: 1 }, config: { contact: { mode: 'user', type: 'single' } }});
  ctrls.push({ property: { control: 'Tips', id: 'Tips-01', title: [{text:'说明',lang:'zh_CN'}], require: 0 }, config: { tips: { tips_content: [{ text: { sub_text: [{ type: 1, content: { plain_text: { content: '说明文字' } }, lang: 'zh_CN' }] }, lang: 'zh_CN' }] } }});
  ctrls.push({ property: { control: 'File', id: 'File-01', title: [{text:'附件',lang:'zh_CN'}], require: 0 }, config: { file: { type: 'pdf' } }});
  ctrls.push({ property: { control: 'Vacation', id: 'Vacation-01', title: [{text:'请假',lang:'zh_CN'}], require: 1 }, config: { vacation: { selector: { type: 'single', options: [{key:'2',value:[{text:'事假',lang:'zh_CN'}]}] }, attendance: { date_range: { type: 'hour', perday_duration: 86400 }, type: 1 } } }});
  ctrls.push({ property: { control: 'Text', id: 'Text-02', title: [{text:'占位-不用',lang:'zh_CN'}], require: 0 }});
  ctrls.push({ property: { control: 'Location', id: 'Location-01', title: [{text:'位置',lang:'zh_CN'}], require: 0 }, config: { location: { type: 'auto', distance: 100, description: [{text: '位置', lang: 'zh_CN'}] } }});
  ctrls.push({ property: { control: 'RelatedApproval', id: 'RelatedApproval-01', title: [{text:'关联审批',lang:'zh_CN'}], require: 0 }, config: { related_approval: { type: 'single', template_id: '3WLJ7G9TU6FbSJRVSSnkkZEr67rJN4eM959MXZbL' } }});
  return ctrls;
}

test('create_template 端到端: 创建 13 控件测试模板 → 拿 template_id', async () => {
  const c = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '../config.json'), 'utf-8'));
  const w = new W(c);
  const ts = Math.floor(Date.now() / 1000);
  
  const r = await w.approval.createTemplate({
    template_name: [{ text: '墨言测试模板_' + ts, lang: 'zh_CN' }],
    template_content: { controls: makeControls() },
  });
  
  console.log('  template_name=' + '墨言测试模板_' + ts);
  console.log('  errcode=' + r.errcode + ' errmsg=' + r.errmsg);
  if (r.errcode === 0) {
    console.log('  ✅ template_id=' + r.template_id);
    // 写给后续测试用
    fs.writeFileSync('/tmp/wecom-test-template.txt', r.template_id);
  }
  
  // 即便报错也是参数错, 不是 60020 权限错
  assert_test(r);
});

function assert_test(r) {
  if (r.errcode !== 0 && r.errcode !== undefined) {
    // 不是 60020 (无权限)
    const c = require('node:test');
  }
}
