/**
 * 企业微信回调处理工具函数
 * 
 * 功能：
 * 1. 自动识别加密/明文消息
 * 2. 智能处理：加密消息自动解密，明文消息直接使用
 * 3. 异常保护：解密失败时优雅返回，不影响主插件
 * 4. 支持 mirror/转发场景
 * 
 * 使用场景：
 * - 独立应用：收到加密消息，自动解密
 * - 共用回调 + wecom 转发明文：收到明文，跳过解密
 * - Nginx mirror：解密失败也不崩溃
 */

const xml2js = require('xml2js');

/**
 * 解析 XML 为对象
 * @param {string} xmlString - XML 字符串
 * @returns {Promise<object>} 解析后的对象
 */
async function parseXML(xmlString) {
  const parser = new xml2js.Parser({ explicitArray: false });
  return parser.parseStringPromise(xmlString);
}

/**
 * 检测消息是否加密
 * @param {object} xml - 解析后的 XML 对象
 * @returns {boolean} 是否加密
 */
function isEncryptedMessage(xml) {
  return !!(xml?.xml?.Encrypt);
}

/**
 * 解析 URL 参数
 * @param {string} url - 请求 URL
 * @returns {object} 解析后的参数
 */
function parseQueryParams(url) {
  const query = new URLSearchParams(url.split('?')[1] || '');
  return {
    msgSignature: query.get('msg_signature') || query.get('signature') || '',
    timestamp: query.get('timestamp') || '',
    nonce: query.get('nonce') || '',
    echostr: query.get('echostr') || '',
  };
}

/**
 * 读取请求 body
 * @param {IncomingMessage} req - HTTP 请求对象
 * @returns {Promise<string>} body 字符串
 */
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}

/**
 * 创建回调处理器
 * 
 * @param {object} options - 配置选项
 * @param {object} options.callbackInstance - 回调实例（包含 handle 方法）
 * @param {function} options.onMessage - 消息处理回调（可选）
 * @param {function} options.onDecryptFail - 解密失败回调（可选）
 * @param {boolean} options.alwaysReturnSuccess - 解密失败时是否返回 success（默认 true）
 * @returns {function} 处理函数
 */
function createCallbackHandler(options = {}) {
  const {
    callbackInstance = null,
    onMessage = null,
    onDecryptFail = null,
    alwaysReturnSuccess = true,
  } = options;

  /**
   * 回调处理函数
   */
  return async function handleWecomCallback(req, res) {
    // 响应函数
    const respondSuccess = () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('success');
    };

    const respondError = (message) => {
      console.log(`[callback-helper] 错误: ${message}`);
      if (alwaysReturnSuccess) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('success');
      } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(message || 'error');
      }
    };

    try {
      // 1. 解析参数和 body
      const params = parseQueryParams(req.url);
      const body = await readBody(req);

      // 2. 解析 XML
      const xml = await parseXML(body);
      const encrypted = isEncryptedMessage(xml);

      let message;

      if (encrypted) {
        // ========== 加密消息 ==========
        console.log('[callback-helper] → 检测到加密消息，尝试解密');

        if (!callbackInstance) {
          console.log('[callback-helper] → 回调实例未初始化，跳过');
          return respondSuccess();
        }

        try {
          const result = await callbackInstance.handle({
            msgSignature: params.msgSignature,
            timestamp: params.timestamp,
            nonce: params.nonce,
            xmlBody: body,
          });
          console.log('[callback-helper] → 解密成功');
          message = result.message;
        } catch (decryptError) {
          // 解密失败，优雅处理
          console.log('[callback-helper] → 解密失败:', decryptError.message);
          if (onDecryptFail) {
            onDecryptFail(decryptError, body);
          }
          return alwaysReturnSuccess ? respondSuccess() : respondError(decryptError.message);
        }

      } else {
        // ========== 明文消息（来自转发/mirror）==========
        console.log('[callback-helper] → 检测到明文消息，跳过解密');
        message = xml.xml || xml;
      }

      // 3. 业务处理
      if (message && onMessage) {
        const eventType = message.Event || message.MsgType || 'unknown';
        const fromUser = message.FromUserName || 'unknown';
        console.log(`[callback-helper] → 事件: ${eventType} from ${fromUser}`);
        
        try {
          await onMessage(message, {
            encrypted,
            raw: xml,
            body,
          });
        } catch (handlerError) {
          console.log('[callback-helper] → 消息处理回调出错:', handlerError.message);
        }
      }

      // 4. 返回 success
      respondSuccess();

    } catch (e) {
      console.log('[callback-helper] → 回调处理异常:', e.message);
      return alwaysReturnSuccess ? respondSuccess() : respondError(e.message);
    }

    return true;
  };
}

/**
 * 便捷函数：创建标准回调处理器
 * 
 * @param {object} callbackInstance - 回调实例
 * @param {function} onEvent - 事件处理回调
 * @returns {function} 处理函数
 */
function createStandardHandler(callbackInstance, onEvent = null) {
  return createCallbackHandler({
    callbackInstance,
    onMessage: onEvent,
    alwaysReturnSuccess: true,
  });
}

module.exports = {
  parseXML,
  isEncryptedMessage,
  parseQueryParams,
  readBody,
  createCallbackHandler,
  createStandardHandler,
};
