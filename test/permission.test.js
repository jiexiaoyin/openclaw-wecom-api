/**
 * 权限模块测试
 * 
 * 运行：node test/permission.test.js
 */

const Permission = require('../src/core/permission');

// 模拟 addressbook 模块
const mockAddressbook = {
  async getUser(userId) {
    const userMap = {
      'JieXiaoYin': { userid: 'JieXiaoYin', department: [14] },
      'ZhouZhou': { userid: 'ZhouZhou', department: [14] },
      'ZhangJing': { userid: 'ZhangJing', department: [28, 18] },
      'WeiXiaoYiRan': { userid: 'WeiXiaoYiRan', department: [19, 20] },
      'ZhuQiXia': { userid: 'ZhuQiXia', department: [8] },
      'staff001': { userid: 'staff001', department: [15] }
    };
    return userMap[userId] || null;
  },
  async getDepartmentDetail(deptId) {
    const deptMap = {
      14: { id: 14, department_chairman_userid: 'JieXiaoYin' },
      8: { id: 8, department_chairman_userid: 'ZhuQiXia' },
      28: { id: 28, department_chairman_userid: 'ZhangJing' }
    };
    return deptMap[deptId] || null;
  }
};

// 测试配置（带角色映射）
const testConfig = {
  roleMapping: {
    admin: {
      users: ['admin001']
    },
    manager: {
      departments: [14, 8],  // 华为管理组 + 总仓
      users: ['manager001']
    },
    staff: {
      departments: [],
      users: []
    }
  }
};

async function runTests() {
  console.log('=== 权限模块测试 ===\n');

  const permission = new Permission(testConfig, mockAddressbook);

  // 1. 测试角色获取
  console.log('1. 测试角色获取');
  console.log('   - admin001 (映射表admin) →', await permission.getUserRole('admin001'));
  console.log('   - manager001 (映射表manager) →', await permission.getUserRole('manager001'));
  console.log('   - JieXiaoYin (华为管理组负责人) →', await permission.getUserRole('JieXiaoYin'));
  console.log('   - staff001 (普通员工) →', await permission.getUserRole('staff001'));
  console.log('');

  // 2. 测试权限检查
  console.log('2. 测试权限检查 (contact.getClientList)');
  console.log('   - admin001 →', await permission.checkPermission('admin001', 'contact', 'getClientList'));
  console.log('   - manager001 →', await permission.checkPermission('manager001', 'contact', 'getClientList'));
  console.log('   - staff001 →', await permission.checkPermission('staff001', 'contact', 'getClientList'));
  console.log('');

  // 3. 测试管理员全权限
  console.log('3. 测试管理员全权限 (app.setAppInfo)');
  console.log('   - admin001 →', await permission.checkPermission('admin001', 'app', 'setAppInfo'));
  console.log('   - manager001 →', await permission.checkPermission('manager001', 'app', 'setAppInfo'));
  console.log('   - staff001 →', await permission.checkPermission('staff001', 'app', 'setAppInfo'));
  console.log('');

  // 4. 测试数据范围
  console.log('4. 测试数据范围');
  console.log('   - admin:', JSON.stringify(await permission.getDataScope('admin001')));
  console.log('   - manager001:', JSON.stringify(await permission.getDataScope('manager001')));
  console.log('   - staff001:', JSON.stringify(await permission.getDataScope('staff001')));
  console.log('');

  // 5. 测试数据过滤
  console.log('5. 测试数据过滤');
  const testData = [
    { userId: 'JieXiaoYin', name: '接晓银', department: 14 },
    { userId: 'staff001', name: '普通员工', department: 15 },
    { userId: 'ZhangJing', name: '张静', department: 18 },
    { userId: 'WeiXiaoYiRan', name: '王燕燕', department: 19 }
  ];
  
  console.log('   原始数据:', testData.length, '条');
  const filteredByManager = await permission.filterData(testData, 'manager001', 'userId');
  console.log('   manager001 (管辖14/8) 过滤后:', filteredByManager.length, '条');
  console.log('   过滤结果:', filteredByManager.map(d => d.name).join(', '));
  
  const filteredByStaff = await permission.filterData(testData, 'staff001', 'userId');
  console.log('   staff001 过滤后:', filteredByStaff.length, '条');
  console.log('   过滤结果:', filteredByStaff.map(d => d.name).join(', '));
  console.log('');

  // 6. 测试 requirePermission 抛出异常
  console.log('6. 测试 requirePermission 异常');
  try {
    await permission.requirePermission('staff001', 'app', 'setAppInfo');
    console.log('   ✗ 预期抛出异常但没有');
  } catch (e) {
    console.log('   ✓ staff001 调用 app.setAppInfo 正确抛出异常:', e.message);
  }
  console.log('');

  console.log('=== 测试完成 ===');
}

runTests().catch(console.error);
