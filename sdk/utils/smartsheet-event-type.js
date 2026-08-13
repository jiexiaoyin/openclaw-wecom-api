/**
 * 智能表格事件类型映射 (v2026-07-26 10:31)
 *
 * 企微 wedoc 回调事件类型:
 *   - add_record: 新增记录
 *   - update_record: 修改记录
 *   - delete_record: 删除记录
 *
 * v1.2.2+ 之前是 sidecar-notifier.js fmtChangeType() 内部函数
 * v2026-07-26 抽到独立 module (SOP-7: 枚举映射必须 100% 覆盖)
 */
const SMARTSHEET_EVENT_TYPE_MAP = {
  'add_record': '➕ 新增记录',
  'update_record': '✏️ 修改记录',
  'delete_record': '🗑️ 删除记录'
};

/**
 * 安全获取智能表格事件类型显示
 * @param {string} type - 事件类型 (add_record|update_record|delete_record)
 * @returns {string} - 映射文本或 `未知事件(${type})` fallback
 */
function getSmartSheetEventType(type) {
  if (!type) return '未知事件(空)';
  if (SMARTSHEET_EVENT_TYPE_MAP[type]) return SMARTSHEET_EVENT_TYPE_MAP[type];
  return `未知事件(${type})`;
}

module.exports = {
  SMARTSHEET_EVENT_TYPE_MAP,
  getSmartSheetEventType
};