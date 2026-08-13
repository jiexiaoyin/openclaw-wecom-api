/**
 * 智能表格「接收外部数据」webhook 客户端（v1.1.0 新增）
 *
 * 第九章：与 wedoc/* 完全不同 — 走 webhook URL + key 鉴权，不依赖 access_token
 * 典型用法：智能表格 → 工作表三点菜单 → 接收外部数据 → 复制 webhook URL
 *   URL 形如: https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=xxxx
 *
 * 频率限制：
 *   - 单工作表 webhook ≤ 3000 条/分钟
 *   - 单文档所有 webhook 累计 ≤ 10000 条/分钟
 *
 * 不支持字段（写入会忽略）：
 *   公式 / 自动编号 / 查找引用 / 关联 / 创建人 / 创建时间 /
 *   最后编辑人 / 最后编辑时间 / 群聊 / 文件
 */

const axios = require('axios');

class DocumentWebhook {
  /**
   * @param {string} webhookUrl 完整 URL（含 ?key=...）
   */
  constructor(webhookUrl) {
    if (!webhookUrl || !webhookUrl.includes('key=')) {
      throw new Error('webhookUrl 必须包含 ?key=... 参数');
    }
    this.webhookUrl = webhookUrl;
  }

  /**
   * 添加记录
   * @param {Array<{values: object}>} records records[].values 是 { FIELD_ID: CellValue }
   *   CellValue 类型: string | { type:'text', text } | { type:'url', text, link }
   *   | string[] (成员) | { user_id }[] (成员完整) | Option[] | { latitude, longitude, title, source_type, id }
   *   | bool (复选框) | number (数字/进度/百分数/货币) | unix ms (日期)
   * @returns {Promise<{errcode, errmsg, add_records: CommonRecord[]}>}
   */
  async addRecords(records) {
    return this._post({ add_records: records });
  }

  /**
   * 更新记录
   * @param {Array<{record_id: string, values: object}>} records
   * @returns {Promise<{errcode, errmsg, update_records: CommonRecord[]}>}
   */
  async updateRecords(records) {
    return this._post({ update_records: records });
  }

  /**
   * 直接 POST 原始 payload（高级用户自定义用）
   */
  async sendRaw(payload) {
    return this._post(payload);
  }

  async _post(payload) {
    const { data } = await axios.post(this.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (data.errcode !== undefined && data.errcode !== 0) {
      throw new Error(`webhook 错误 [${data.errcode}]: ${data.errmsg}`);
    }
    return data;
  }
}

module.exports = DocumentWebhook;
