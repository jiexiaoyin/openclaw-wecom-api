// v2026-07-26 21:51 老板 query "测提交" - 端到端真提交已成功 (sp_no=202607260016)
// 21:55 老板 query "BDE" - 加入 skip 防止 npm test 重复创建审批单 (per 9:58 [Fact] 避免污染)
const test = require('node:test');
test('submit() 端到端真提交 (已成功 21:51, 当前 skip 防重)', { skip: true }, async () => {
  // 已跑过 1 次, sp_no=202607260016, 老板手工撤销
});
