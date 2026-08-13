/**
 * School 模块集成测试
 * 覆盖: 21 个 async 方法 (含 v1.5.2 coverage-enhance batch4 新加 9 个)
 *
 * 模式: 实例化 + 方法计数 + stub URL 锁定 + 本轮新方法验证
 * 按 customer.test.js 范例, 按 2026-07-15 15:31 老板指令 P2
 *
 * @author openclaw-bot 2026-07-15
 */

const assert = require('assert');
const School = require('../sdk/modules/school');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/4] 实例化 School');
  const s = new School({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(s instanceof School, 'instance check');
  console.log('    ✓ School instance created');

  console.log('\n[2/4] 验证全部 async 方法存在');
  const fs = require('fs');
  const path = require('path');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/school'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个`);
  for (const fn of methodNames) {
    assert.strictEqual(typeof s[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  // 验证 v1.5.2 batch4 新加 9 个方法都存在
  const newMethods = [
    'createSchoolDepartment', 'deleteSchoolDepartment', 'updateSchoolDepartment',
    'getSchoolUserInfo', 'setSchoolConfig', 'batchSchoolUser',
    'createSchoolUser', 'deleteSchoolUser', 'updateSchoolUser',
  ];
  for (const m of newMethods) {
    assert.strictEqual(typeof s[m], 'function', `${m} 应是函数 (v1.5.2 新加)`);
  }
  console.log(`    ✓ v1.5.2 batch4 新加 9 个方法全部存在: ${newMethods.join(', ')}`);

  console.log('\n[3/4] Stub request + 验证 URL 锁定');
  const stubs = [];
  s.request = async function (...args) {
    let entry;
    if (args.length === 3 && typeof args[0] === 'string') {
      entry = { method: args[0], url: args[1], data: args[2] };
    } else if (args.length === 2) {
      entry = { method: 'POST', url: args[0], data: args[1] };
    } else {
      entry = args[0];
    }
    stubs.push(entry);
    return { errcode: 0, errmsg: 'ok' };
  };
  s.post = async function (url, data) {
    return this.request('POST', url, data);
  };

  const tcs = [
    // 原始 12 个方法
    { name: 'sendSchoolNotice', args: ['u_teacher', 'stu_001', { title: '通知', content: '明天上课', msgType: 'text' }], method: 'POST', url: '/school/send_notice' },
    { name: 'getSchoolNoticeResult', args: ['msg_001'], method: 'POST', url: '/school/get_notice_result' },
    { name: 'recallSchoolNotice', args: ['msg_001'], method: 'POST', url: '/school/recall_notice' },
    { name: 'getClassList', args: ['school_001'], method: 'POST', url: '/school/get_class_list' },
    { name: 'getStudentList', args: ['class_001'], method: 'POST', url: '/school/get_student_list' },
    { name: 'getParentList', args: ['stu_001'], method: 'POST', url: '/school/get_parent_list' },
    { name: 'getTeacherList', args: ['school_001'], method: 'POST', url: '/school/get_teacher_list' },
    { name: 'createHealthReportTask', args: ['school_001', 'class_001', { template_id: 'tpl_001' }], method: 'POST', url: '/school/add_health_report_task' },
    { name: 'getHealthReportStat', args: ['task_001'], method: 'POST', url: '/school/get_health_report_stat' },
    { name: 'getHealthReportDetail', args: ['task_001', 'stu_001'], method: 'POST', url: '/school/get_health_report_detail' },
    { name: 'publishScore', args: ['school_001', 'stu_001', { chinese: 88, math: 92 }], method: 'POST', url: '/school/publish_score' },
    { name: 'getScoreList', args: ['school_001', 'stu_001'], method: 'POST', url: '/school/get_score_list' },
    // v1.5.2 batch4 新加 9 个
    { name: 'createSchoolDepartment', args: ['school_001', { name: '高一三班' }], method: 'POST', url: '/school/department/create' },
    { name: 'deleteSchoolDepartment', args: ['school_001', 'dept_001'], method: 'POST', url: '/school/department/delete' },
    { name: 'updateSchoolDepartment', args: ['school_001', 'dept_001', { name: '改名' }], method: 'POST', url: '/school/department/update' },
    { name: 'getSchoolUserInfo', args: ['u1,u2'], method: 'POST', url: '/school/getuserinfo' },
    { name: 'setSchoolConfig', args: [{ school_id: 'school_001', config_key: 'value' }], method: 'POST', url: '/school/set' },
    { name: 'batchSchoolUser', args: ['school_001', 1, 'u1,u2'], method: 'POST', url: '/school/user/batch' },
    { name: 'createSchoolUser', args: ['school_001', 1, 'u_teacher_001'], method: 'POST', url: '/school/user/create' },
    { name: 'deleteSchoolUser', args: ['school_001', 1, 'u_teacher_001'], method: 'POST', url: '/school/user/delete' },
    { name: 'updateSchoolUser', args: ['school_001', 1, 'u_teacher_001', { name: 'New Name' }], method: 'POST', url: '/school/user/update' },
  ];

  for (const tc of tcs) {
    stubs.length = 0;
    await s[tc.name](...tc.args);
    assert.strictEqual(stubs[0].method, tc.method, `${tc.name} method 应为 ${tc.method}`);
    assert.ok(stubs[0].url.includes(tc.url) || stubs[0].url === tc.url, `${tc.name} URL 应含 ${tc.url}, 实际=${stubs[0].url}`);
    console.log(`    ✓ ${tc.name} → ${stubs[0].method} ${stubs[0].url}`);
  }

  console.log('\n[4/4] sendSchoolNotice 多 content type 验证');
  stubs.length = 0;
  await s.sendSchoolNotice('u1', 'stu1', { msgType: 'image', mediaId: 'media_abc' });
  assert.strictEqual(stubs[0].data.msgtype, 'image', 'msgtype 应为 image');
  assert.strictEqual(stubs[0].data.image.media_id, 'media_abc', 'image media_id 应传出');
  console.log('    ✓ sendSchoolNotice(image) → msgtype=image, image.media_id=media_abc');

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
