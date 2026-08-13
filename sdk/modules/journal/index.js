/**
 * 汇报管理模块
 * API 章节：OA - 汇报
 * 包含：批量获取汇报记录、获取记录详情、获取统计数据、下载汇报微盘文件
 *
 * v1.5.0 新增：M1 计划通讯录+审批+汇报 中的"汇报"模块
 * 文档源：https://developer.work.weixin.qq.com/document/path/93338
 *
 * 说明：
 * - 汇报应用是审批的延伸：审批通过后自动生成汇报记录
 * - 4 个端点：批量获取单号 / 获取详情 / 获取统计 / 下载微盘文件
 * - 与 approval 模块的差异：approval 走 /cgi-bin/oa/*，本模块也走 /cgi-bin/oa/journal/*
 */

const WeComSDK = require('../../sdk');

class Journal extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 汇报记录管理 ==========

  /**
   * 批量获取汇报记录单号
   * 根据时间范围获取该段时间内企业内的全部汇报记录单号
   * @param {number} startTime 开始时间戳（秒）
   * @param {number} endTime 结束时间戳（秒）
   * @param {string[]} filters 可选过滤条件，例：['sp_no', 'apply_user']
   * @param {number} offset 偏移量
   * @param {number} limit 每页数量（默认 100，最大 1000）
   */
  async getRecordList(startTime, endTime, filters = [], cursor = 0, limit = 100) {
    if (!startTime || !endTime) {
      throw new Error('startTime and endTime are required');
    }
    // v1.5.2 修复：filter → filters (文档要求 filters[])，offset → cursor
    // 文档要求：开始/结束间隔不能超过 1 个月
    const span = endTime - startTime;
    if (span > 31 * 24 * 3600) {
      throw new Error(`startTime-endTime 跨度 ${span}s 超过 1 个月上限，请拆分调用`);
    }
    return this.post('/oa/journal/get_record_list', {
      starttime: startTime,
      endtime: endTime,
      filters: filters.length > 0 ? filters : undefined,
      cursor,
      limit
    });
  }

  /**
   * 获取汇报记录详情
   * 支持通过 sp_no（汇报记录单号）列表 批量获取详情
   * @param {string[]} recordIds 汇报记录单号列表（最多 100 个）
   */
  async getRecordDetail(journaluuid) {
    if (!journaluuid) {
      throw new Error('journaluuid is required (document only supports single uuid, not batch)');
    }
    // v1.5.2 修复：sp_no_list (array) → journaluuid (string, 文档仅支持单值)
    return this.post('/oa/journal/get_record_detail', {
      journaluuid,
    });
  }

  // ========== 汇报统计 ==========

  /**
   * 获取汇报统计数据
   * 获取指定时间范围内，按汇报类型/申请人/审批人维度统计的汇报数据
   * @param {number} startTime 开始时间戳（秒）
   * @param {number} endTime 结束时间戳（秒）
   * @param {object} groupBy 分组维度
   *   - dimension: 'record_type' | 'apply_user' | 'sp_status'
   *   - apply_user: 申请人 userid（apply_user 分组时必填）
   *   - record_type: 汇报类型编号（record_type 分组时必填）
   * @param {number} offset 偏移量
   * @param {number} limit 每页数量（默认 100，最大 1000）
   */
  async getStatList(templateId, startTime, endTime) {
    if (!templateId) {
      throw new Error('templateId is required (文档必填)');
    }
    if (!startTime || !endTime) {
      throw new Error('startTime and endTime are required');
    }
    // v1.5.2 修复：完全重写签名 — 文档要求 { template_id, starttime, endtime }
    //   旧设计: 复杂 groupBy.dimension 需选 record_type/apply_user/sp_status → 但文档没这逻辑
    //   新设计: 直接接 template_id/开始/结束
    return this.post('/oa/journal/get_stat_list', {
      template_id: templateId,
      starttime: startTime,
      endtime: endTime,
    });
  }

  // ========== 汇报附件下载 ==========

  /**
   * 下载汇报微盘文件
   * 汇报应用的微盘文件下载接口
   * @param {string} fileId 汇报记录详情中获取到的 fileid
   */
  async downloadWedriveFile(journaluuid, fileId) {
    if (!journaluuid || !fileId) {
      throw new Error('journaluuid and fileId are required');
    }
    // v1.5.2 修复：加 journaluuid 必填项（文档要求 { journaluuid, fileid }）
    return this.post('/oa/journal/download_wedrive_file', {
      journaluuid,
      fileid: fileId,
    });
  }
}

module.exports = Journal;