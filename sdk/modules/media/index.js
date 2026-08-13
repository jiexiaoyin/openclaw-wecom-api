/**
 * 素材管理模块
 * API 章节：十 - 素材管理
 * 包含：临时素材、图片、高清语音
 */

const WeComSDK = require('../../sdk');
const fs = require('fs');
const path = require('path');

class Media extends WeComSDK {
  constructor(config) {
    super(config);
  }

  /**
   * 上传临时素材
   * @param {string} filePath 文件路径
   * @param {string} type 媒体类型: image, voice, video, file
   */
  async uploadMedia(filePath, type = 'image') {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    // v2026-07-26 10:15 fix (老板 query B): 移除多余嵌套 (post 已包 {media: ...}, formData 不要再包一层 media)
    const formData = {
      value: fileBuffer,
      options: {
        filename: fileName,
        contentType: this.getContentType(fileName)
      }
    };

    return this.post('/media/upload', { media: formData }, {
      type,
      apiType: 'upload'
    });
  }

  /**
   * 获取临时素材
   * @param {string} mediaId 媒体 id
   * @param {string} savePath 保存路径
   */
  async getMedia(mediaId, savePath) {
    const response = await this.request({
      method: 'GET',
      url: '/media/get',
      params: { media_id: mediaId },
      responseType: 'stream'
    });

    if (savePath) {
      const writer = fs.createWriteStream(savePath);
      response.data.pipe(writer);
      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve({ savePath }));
        writer.on('error', reject);
      });
    }

    return response.data;
  }

  /**
   * 上传图片
   * @param {string} filePath 图片路径
   */
  async uploadImage(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    // v2026-07-26 10:15 fix (老板 query B): 移除多余嵌套 (post 已包 {media: ...})
    const formData = {
      value: fileBuffer,
      options: {
        filename: fileName,
        contentType: 'image/jpeg'
      }
    };

    return this.post('/media/uploadimg', { media: formData }, {
      apiType: 'upload'
    });
  }

  /**
   * 获取高清语音素材
   * @param {string} mediaId 媒体 id
   * @param {string} savePath 保存路径
   */
  async getHighDefinitionVoice(mediaId, savePath) {
    const response = await this.request({
      method: 'GET',
      url: '/media/get/fcvoice',
      params: { media_id: mediaId },
      responseType: 'stream'
    });

    if (savePath) {
      const writer = fs.createWriteStream(savePath);
      response.data.pipe(writer);
      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve({ savePath }));
        writer.on('error', reject);
      });
    }

    return response.data;
  }
  /**
   * v1.5.2 coverage-enhance: 获取 JSSDK 临时素材
   * 区别于 getMedia: JSSDK 专用, 返回 buffer 供前端 wx.agentConfig 使用
   * @param {string} mediaId 临时素材 media_id (来自 JSSDK 上传)
   * @returns {Promise<object>} { errcode, errmsg, content_type, buffer }
   */
  async getMediaJssdk(mediaId) {
    return this.request({
      method: 'GET',
      url: '/media/get/jssdk',
      params: { media_id: mediaId },
      responseType: 'arraybuffer'
    });
  }


  /**
   * 异步上传临时素材
   * @param {string} filePath 文件路径
   * @param {string} type 媒体类型
   */
  async asyncUploadMedia(filePath, type = 'image') {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    // v2026-07-26 10:15 fix (老板 query B): 移除多余嵌套 (post 已包 {media: ...})
    const formData = {
      value: fileBuffer,
      options: {
        filename: fileName,
        contentType: this.getContentType(fileName)
      }
    };

    return this.post('/media/async_upload', { media: formData }, {
      type,
      apiType: 'upload'
    });
  }

  /**
   * 根据文件扩展名获取 Content-Type
   * @param {string} fileName 文件名
   */
  getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const types = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.wma': 'audio/x-wav',
      '.wav': 'audio/x-wav',
      '.amr': 'audio/amr',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip'
    };
    return types[ext] || 'application/octet-stream';
  }
}

module.exports = Media;
