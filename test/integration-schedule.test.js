/**
 * Schedule 模块集成测试
 * 覆盖: sdk/modules/schedule/index.js 暴露的 SDK methods
 * 模式: stub this.request + URL 锁定验证
 *
 * @author openclaw-bot 2026-07-16
 */

const assert = require('assert');
const Schedule = require('../sdk/modules/schedule');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/4] 实例化 Schedule');
  const s = new Schedule({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(s instanceof Schedule, 'instance check');
  console.log('    ✓ Schedule instance created');

  console.log('\n[2/4] 验证全部 async 方法存在');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/schedule'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个: ${methodNames.join(', ')}`);
  for (const fn of methodNames) {
    assert.strictEqual(typeof s[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/4] Stub request + 验证 URL 锁定 (4 个 case)');
  const stubs = [];
  s.request = async (method, url, data) => {
    stubs.push({ method, url, data });
    return { errcode: 0, errmsg: 'ok' };
  };

  // Case 1: createEvent → updateEvent → getEventDetail (CRUD 流程)
  stubs.length = 0;
  await s.createEvent({
    organizer: 'user_leader',
    title: '周会',
    startTime: '2026-07-20T10:00:00+08:00',
    endTime: '2026-07-20T11:00:00+08:00',
    attendees: ['u1', 'u2'],
    description: '每周例会',
    location: '会议室A'
  });
  assert.strictEqual(stubs[0].method, 'POST', 'createEvent method');
  assert.strictEqual(stubs[0].url, '/oa/schedule/add', 'createEvent URL');
  assert.strictEqual(stubs[0].data.schedule.title, '周会', 'createEvent title');
  assert.strictEqual(stubs[0].data.schedule.organizer, 'user_leader', 'createEvent organizer');
  console.log('    ✓ createEvent → POST /oa/schedule/add {schedule:{title,organizer,...}}');

  stubs.length = 0;
  await s.updateEvent('schedule_abc', {
    title: '周会（改）',
    startTime: '2026-07-20T14:00:00+08:00',
    endTime: '2026-07-20T15:00:00+08:00'
  });
  assert.strictEqual(stubs[0].url, '/oa/schedule/update', 'updateEvent URL');
  assert.strictEqual(stubs[0].data.schedule.schedule_id, 'schedule_abc', 'updateEvent schedule_id');
  assert.strictEqual(stubs[0].data.schedule.title, '周会（改）', 'updateEvent title');
  console.log('    ✓ updateEvent → POST /oa/schedule/update {schedule:{schedule_id,title,...}}');

  stubs.length = 0;
  await s.getEventDetail('schedule_abc');
  assert.strictEqual(stubs[0].url, '/oa/schedule/get', 'getEventDetail URL');
  assert.strictEqual(stubs[0].data.schedule_id, 'schedule_abc', 'getEventDetail schedule_id');
  console.log('    ✓ getEventDetail → POST /oa/schedule/get');

  // Case 2: deleteEvent
  stubs.length = 0;
  await s.deleteEvent('schedule_abc');
  assert.strictEqual(stubs[0].url, '/oa/schedule/del', 'deleteEvent URL');
  assert.strictEqual(stubs[0].data.schedule_id, 'schedule_abc', 'deleteEvent schedule_id');
  console.log('    ✓ deleteEvent → POST /oa/schedule/del');

  // Case 3: 日历管理 - createCalendar → getCalendar → deleteCalendar
  stubs.length = 0;
  await s.createCalendar({ title: '我的日历', summary: '工作日历', color: 1 });
  assert.strictEqual(stubs[0].url, '/oa/calendar/add', 'createCalendar URL');
  assert.strictEqual(stubs[0].data.calendar.summary, '工作日历', 'createCalendar summary');
  console.log('    ✓ createCalendar → POST /oa/calendar/add');

  stubs.length = 0;
  await s.getCalendar('cal_xyz');
  assert.strictEqual(stubs[0].url, '/oa/calendar/get', 'getCalendar URL');
  assert.deepStrictEqual(stubs[0].data.cal_id_list, ['cal_xyz'], 'getCalendar cal_id_list');
  console.log('    ✓ getCalendar → POST /oa/calendar/get');

  stubs.length = 0;
  await s.deleteCalendar('cal_xyz');
  assert.strictEqual(stubs[0].url, '/oa/calendar/del', 'deleteCalendar URL');
  assert.strictEqual(stubs[0].data.calendar_id, 'cal_xyz', 'deleteCalendar calendar_id');
  console.log('    ✓ deleteCalendar → POST /oa/calendar/del');

  // Case 4: getCalendarEvents + addEventAttendees + removeEventAttendees
  stubs.length = 0;
  await s.getCalendarEvents('cal_xyz', 1753036800, 1753123200);
  assert.strictEqual(stubs[0].url, '/oa/schedule/list', 'getCalendarEvents URL');
  assert.strictEqual(stubs[0].data.calendar_id, 'cal_xyz', 'getCalendarEvents calendar_id');
  console.log('    ✓ getCalendarEvents → POST /oa/schedule/list');

  stubs.length = 0;
  await s.addEventAttendees('schedule_abc', ['u3', 'u4']);
  assert.strictEqual(stubs[0].url, '/oa/schedule/add_attendees', 'addEventAttendees URL');
  console.log('    ✓ addEventAttendees → POST /oa/schedule/add_attendees');

  stubs.length = 0;
  await s.removeEventAttendees('schedule_abc', ['u1']);
  assert.strictEqual(stubs[0].url, '/oa/schedule/del_attendees', 'removeEventAttendees URL');
  console.log('    ✓ removeEventAttendees → POST /oa/schedule/del_attendees');

  console.log('\n[4/4] updateCalendar URL 验证');
  stubs.length = 0;
  await s.updateCalendar('cal_xyz', { summary: '新标题' });
  assert.strictEqual(stubs[0].url, '/oa/calendar/update', 'updateCalendar URL');
  console.log('    ✓ updateCalendar → POST /oa/calendar/update');

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
