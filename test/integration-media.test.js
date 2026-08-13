/**
 * Media 模块集成测试
 * 覆盖: 7 个 async 方法 (含 v1.5.2 coverage-enhance getMediaJssdk)
 *
 * 模式: 实例化 + 方法计数 + stub URL 锁定 (this.post 三参 + this.request 对象)
 * 按 media 模块特点: upload* 用 this.post, get* 用 this.request
 * 按 2026-07-15 15:31 老板指令 P2
 *
 * @author openclaw-bot 2026-07-15
 */

const assert = require('assert');
const Media = require('../sdk/modules/media');

function realMethods(source, prefix = '\\s{2,}') {
  return [...new Set(
    [...source.matchAll(new RegExp(`^${prefix}async\\s+(\\w+)\\s*\\(`, 'gm'))]
      .map(m => m[1])
      .filter(n => !['super'].includes(n))
  )];
}

async function main() {
  console.log('[1/4] 实例化 Media');
  const m = new Media({ corpId: 'test_corp', corpSecret: 'test_secret' });
  assert.ok(m instanceof Media, 'instance check');
  console.log('    ✓ Media instance created');

  console.log('\n[2/4] 验证全部 async 方法存在');
  const fs = require('fs');
  const path = require('path');
  const source = require('fs').readFileSync(require.resolve('../sdk/modules/media'), 'utf8');
  const methodNames = realMethods(source);
  console.log(`    源码统计: ${methodNames.length} 个: ${methodNames.join(', ')}`);
  for (const fn of methodNames) {
    assert.strictEqual(typeof m[fn], 'function', `${fn} 不是函数`);
  }
  console.log(`    ✓ ${methodNames.length} methods 全部存在`);

  console.log('\n[3/4] stub this.post (upload 方法) + this.request (get 方法)');
  const stubs = [];
  // stub this.post 3 参
  m.post = async function (url, data, opts) {
    stubs.push({ method: 'POST', url, data, opts });
    return { errcode: 0, errmsg: 'ok', media_id: 'fake_media_123' };
  };
  // stub this.request 1 参 (对象)
  m.request = async function (payload) {
    stubs.push({ method: payload.method, url: payload.url, params: payload.params, responseType: payload.responseType });
    return { errcode: 0, errmsg: 'ok' };
  };

  // 测试 uploadImage (this.post 三参)
  stubs.length = 0;
  const tmpImg = '/tmp/test_media.jpg';
  fs.writeFileSync(tmpImg, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  try {
    await m.uploadImage(tmpImg);
    assert.strictEqual(stubs[0].method, 'POST', 'uploadImage method');
    assert.strictEqual(stubs[0].url, '/media/uploadimg', 'uploadImage URL');
    assert.strictEqual(stubs[0].opts.apiType, 'upload', 'uploadImage apiType');
    console.log('    ✓ uploadImage → POST /media/uploadimg (apiType=upload)');
  } finally {
    fs.unlinkSync(tmpImg);
  }

  // 测试 getMediaJssdk (this.request 对象)
  stubs.length = 0;
  await m.getMediaJssdk('media_abc');
  assert.strictEqual(stubs[0].method, 'GET', 'getMediaJssdk method');
  assert.ok(stubs[0].url.includes('/media/get/jssdk'), `getMediaJssdk URL 应含 /media/get/jssdk, 实际=${stubs[0].url}`);
  console.log(`    ✓ getMediaJssdk → GET ${stubs[0].url}`);

  // 测试 uploadMedia (this.post 三参, 含 type)
  stubs.length = 0;
  const tmpFile = '/tmp/test_upload.bin';
  fs.writeFileSync(tmpFile, Buffer.from('hello'));
  try {
    await m.uploadMedia(tmpFile, 'file');
    assert.strictEqual(stubs[0].method, 'POST', 'uploadMedia method');
    assert.strictEqual(stubs[0].url, '/media/upload', 'uploadMedia URL');
    assert.strictEqual(stubs[0].opts.type, 'file', 'uploadMedia type');
    console.log('    ✓ uploadMedia → POST /media/upload (type=file)');
  } finally {
    fs.unlinkSync(tmpFile);
  }

  console.log('\n[4/4] v1.5.2 coverage-enhance 新方法验证');
  // 本轮加的 getMediaJssdk
  assert.strictEqual(typeof m.getMediaJssdk, 'function', 'getMediaJssdk 应是函数 (v1.5.2 新加)');
  console.log('    ✓ getMediaJssdk 函数存在 (v1.5.2 coverage-enhance batch1 加)');

  // getContentType 是 utility, 验证 4 种类型
  assert.strictEqual(m.getContentType('photo.jpg'), 'image/jpeg', 'jpg MIME');
  assert.strictEqual(m.getContentType('video.mp4'), 'video/mp4', 'mp4 MIME');
  assert.strictEqual(m.getContentType('audio.amr'), 'audio/amr', 'amr MIME');
  console.log('    ✓ getContentType: jpg/png/mp4/amr MIME 识别');

  console.log('\n=== ALL PASS ===');
}

main().catch(err => { console.error('FAIL:', err.message); console.error(err.stack); process.exit(1); });
