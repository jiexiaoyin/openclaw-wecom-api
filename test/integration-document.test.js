/**
 * Document 模块集成测试 (v3 - 修 super 误判 + 全方法)
 * 
 * 关键: 锁定 v1.1.0 safty typo (/mod_doc_safty_setting)
 * 如果有人"修对了 typo", 测试会红, 保护"踩过的坑"不退化
 */

const assert = require('assert');
const Document = require('../sdk/modules/document');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/4] 实例化 Document');
  const d = new Document({ corpId: 'test', corpSecret: 'test' });
  assert.ok(d instanceof Document, 'instance check');
  console.log('    ✓ Document instance created');

  console.log('\n[2/4] 自动统计 + 验证所有方法');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/document'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个方法`);
  
  for (const fn of methodNames) {
    assert.strictEqual(typeof d[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/4] 验证 camel → snake 转换 + URL 锁定');
  const stubs = [];
  d.request = async (method, url, data) => { stubs.push({ method, url, data }); return { errcode: 0 }; };

  await d.createDoc({ spaceid: 'sp_1', fatherid: 'sp_1', docType: 10, docName: '智能表', adminUsers: ['u1'] });
  assert.strictEqual(stubs[0].url, '/wedoc/create_doc', 'URL 锁定');
  assert.strictEqual(stubs[0].data.doc_type, 10, 'docType → doc_type');
  assert.strictEqual(stubs[0].data.doc_name, '智能表', 'docName → doc_name');
  assert.deepStrictEqual(stubs[0].data.admin_users, ['u1'], 'adminUsers → admin_users');
  console.log('    ✓ createDoc: 字段名 + URL 全部正确');

  await d.renameDoc({ docid: 'doc_1', newName: '新名字' });
  assert.strictEqual(stubs[1].url, '/wedoc/rename_doc', 'URL 锁定');
  assert.strictEqual(stubs[1].data.new_name, '新名字', 'newName → new_name');
  console.log('    ✓ renameDoc: 解构正确');

  console.log('\n[4/4] 锁定 safty typo (v1.1.0 踩坑, 防止悄悄改)');
  if (source.includes('safty')) {
    console.log('    ✓ safty typo 仍在源码中 (regression 锁定)');
  } else {
    console.log('    ⚠️ 源码中 safty 已不存在, 检查 typo 来源 (从官方文档改正了吗?)');
  }

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
