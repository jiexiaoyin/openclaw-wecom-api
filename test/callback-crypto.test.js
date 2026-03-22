/**
 * Callback 模块加密解密测试
 */

const Callback = require('../src/modules/callback');

async function testCallbackCrypto() {
  console.log('=== Callback 模块加密解密测试 ===\n');

  const config = {
    token: 'jiedianyin123456',
    encodingAESKey: 'bkHQ9uPfEwpuFdEtDCJxcFdGfeeDsnfNnesWNVJwQ84',
    corpId: 'wwee411cd8a3997793',
    agentId: '1000039'
  };

  const callback = new Callback(config);

  // 测试1: 加密消息
  console.log('1. 测试加密消息');
  const plaintext = '<xml><ToUserName>test</ToUserName><FromUserName>user</FromUserName></xml>';
  const encrypted = callback.encrypt(plaintext, 'testnonce', '1234567890');
  console.log('   原文:', plaintext);
  console.log('   加密结果:');
  console.log('   - encrypt:', encrypted.encrypt.substring(0, 50) + '...');
  console.log('   - signature:', encrypted.signature);
  console.log('   - nonce:', encrypted.nonce);
  console.log('   - timestamp:', encrypted.timestamp);

  // 测试2: 解密消息
  console.log('\n2. 测试解密消息');
  try {
    const decrypted = callback.decrypt(encrypted.encrypt);
    console.log('   解密结果:', decrypted);
    console.log('   ✓ 解密成功:', plaintext === decrypted);
  } catch (e) {
    console.log('   ✗ 解密失败:', e.message);
  }

  // 测试3: 签名验证（模拟收到消息）
  console.log('\n3. 测试签名验证');
  const msgSignature = encrypted.signature;
  const timestamp = encrypted.timestamp;
  const nonce = encrypted.nonce;
  const encrypt = encrypted.encrypt;
  
  const isValid = callback.verifyMessage(msgSignature, timestamp, nonce, encrypt);
  console.log('   传入签名:', msgSignature);
  console.log('   验证结果:', isValid);
  console.log('   ✓ 签名验证', isValid ? '通过' : '失败');

  console.log('\n=== Callback 模块测试完成 ===');
}

testCallbackCrypto().catch(console.error);
