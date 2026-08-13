/**
 * 企业微信审批状态映射 (v2026-07-26 10:23 fix: 老板 query "状态:6" bug)
 *
 * 完整覆盖 sp_status 枚举 (per SDK sdk/modules/approval/index.js):
 *   1=审批中 / 2=已通过 / 3=已驳回 / 4=已撤销
 *   6=通过后撤销 / 7=已删除 / 10=已支付
 *
 * v1.5.2 event-router.js statusMap 只 4 个值 → 6/7/10 fallback 显示原始数字
 * v2026-07-26 抽出到独立 module + 加单测 + safe fallback (避免再次沉默失败)
 */
const SP_STATUS_MAP = {
  1: '🟡审批中',
  2: '✅通过',
  3: '❌驳回',
  4: '🚫撤销',
  6: '🔁通过后撤销',
  7: '🗑已删除',
  10: '💰已支付'
};

/**
 * 安全获取 sp_status 文本
 * @param {number|string} status - sp_status 值
 * @returns {string} - 映射文本或 `未知状态(N)` fallback
 */
function getSpStatusText(status) {
  const n = Number(status);
  if (SP_STATUS_MAP[n] !== undefined) return SP_STATUS_MAP[n];
  return `未知状态(${status || '空'})`;
}

module.exports = {
  SP_STATUS_MAP,
  getSpStatusText
};