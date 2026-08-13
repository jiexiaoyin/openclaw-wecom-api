/**
 * 审批节点 (SpRecord[i]) 状态映射
 *
 * v2026-07-26 10:28 fix (老板 query B+C): 跟顶层 sp_status 不同, 节点 status 在企微文档没明确说明
 * 现实数据 (sp_no=202607260001) 显示: 1=等待审批 / 2=已审批
 * 但理论上还可能: 3=已驳回 / 4=已撤回 (从回调事件中体现)
 *
 * 不同于顶层 SP_STATUS_MAP (审批整体), SpRecord NodeStatus 是审批节点的单人审批状态
 */

const SP_RECORD_NODE_STATUS_MAP = {
  1: { text: '🕐', label: '等待审批' },
  2: { text: '✅', label: '已审批' },
  3: { text: '❌', label: '已驳回' },
  4: { text: '🔙', label: '已撤回' }
};

/**
 * 安全获取节点 status 显示
 * @param {number|string} spStatus - SpRecord[i].sp_status 值
 * @returns {{text: string, label: string}} - icon + 文字
 */
function getNodeStatusInfo(spStatus) {
  const n = Number(spStatus);
  if (SP_RECORD_NODE_STATUS_MAP[n]) return SP_RECORD_NODE_STATUS_MAP[n];
  // 未知: 假设 1 (等待审批) 兼容 fallback, 但加 '?' 让老板知道有意外
  return { text: '❓', label: `未知(${spStatus || '空'})` };
}

module.exports = {
  SP_RECORD_NODE_STATUS_MAP,
  getNodeStatusInfo
};