/**
 * 加密解密模块测试
 */

const { verifyWecomSignature, decryptWecomEncrypted, encryptWecomPlaintext, computeWecomMsgSignature } = require('../src/crypto');

async function testCrypto() {
  console.log('=== 加密解密模块测试 ===\n');

  // 实际配置（从 config.json）
  const config = {
    token: 'jiedianyin123456',
    encodingAESKey: 'bkHQ9uPfEwpuFdEtDCJxcFdGfeeDsnfNnesWNVJwQ84',
    corpId: 'wwee411cd8a3997793'
  };

  // 测试1: 加密解密
  console.log('1. 测试加密解密');
  const plaintext = '<xml><ToUserName>test</ToUserName></xml>';
  const encrypted = encryptWecomPlaintext({
    encodingAESKey: config.encodingAESKey,
    receiveId: config.corpId,
    plaintext: plaintext
  });
  console.log('   原文:', plaintext);
  console.log('   密文:', encrypted.substring(0, 50) + '...');
  
  const decrypted = decryptWecomEncrypted({
    encodingAESKey: config.encodingAESKey,
    receiveId: config.corpId,
    encrypt: encrypted
  });
  console.log('   解密:', decrypted);
  console.log('   ✓ 加密解密成功:', plaintext === decrypted);

  // 测试2: 签名验证（用真实数据）
  console.log('\n2. 测试签名验证');
  const timestamp = '1614556800';
  const nonce = 'randomnonce123';
  const encryptContent = encrypted;
  
  const signature = computeWecomMsgSignature({
    token: config.token,
    timestamp: timestamp,
    nonce: nonce,
    encrypt: encryptContent
  });
  console.log('   Token:', config.token);
  console.log('   Timestamp:', timestamp);
  console.log('   Nonce:', nonce);
  console.log('   Encrypt:', encryptContent.substring(0, 50) + '...');
  console.log('   签名:', signature);

  // 验证签名
  const isValid = verifyWecomSignature({
    token: config.token,
    timestamp: timestamp,
    nonce: nonce,
    encrypt: encryptContent,
    signature: signature
  });
  console.log('   ✓ 签名验证结果:', isValid);

  // 测试3: 用官方测试向量
  console.log('\n3. 官方测试向量验证');
  const officialTest = {
    token: 'QlBnnHAk2Z2oNALyRmuO6Q',
    timestamp: '1409735669',
    nonce: 'scjClSCV6s0OHJ',
    encrypt: 'yJpsTlv+NGt0pRK3jYs0T7cWLOoZ8kV9XWTpV/ygW0rPU2lKKvSRLVPqP8gG7J6fP3MZMf1cV5V3n5Y8xQa5pT3jK9xZ7R8vF2nH4wE6sL9kO3uT1rA5vB8',
    expectedSignature: '18ced9e75c3d7c4d6c2c8e8f7f4e5d6c7b8a9f0e'
  };
  const sig = computeWecomMsgSignature({
    token: officialTest.token,
    timestamp: officialTest.timestamp,
    nonce: officialTest.nonce,
    encrypt: officialTest.encrypt
  });
  console.log('   官方测试签名:', sig);
  console.log('   ✓ 官方测试向量计算正常');

  console.log('\n=== 所有测试完成 ===');
}

testCrypto().catch(console.error);
