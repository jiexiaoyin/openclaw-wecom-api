/**
 * 企业微信 ChangeType 映射 (v2026-07-26 10:25 fix: 老板 query B+C)
 *
 * 来源: callback/index.js 5 处重复定义 (handleContactChange / handleAddExternalContact
 *                                            / handleChangeMember / handleChangeDepartment / handleChangeTag)
 *
 * 重复代码 → 抽独立 module + 单测 + safe fallback
 *
 * 用途: 通讯录/外部联系人/标签/部门变更通知的 ChangeType 数字 → 中文
 *   1=新增 2=更新 3=删除
 *
 * 注意: 外部联系人用 Action 字段, ChangeType 是 1/4 而非 1/2/3 (见 ExternalContactChangeType)
 */
const ChangeTypeMap = {
  1: '新增',
  2: '更新',
  3: '删除'
};

/**
 * 外部联系人 ChangeType (与通用 ChangeType 不同, 企微官方: 1=新增 4=删除, 不含 2/3 更新)
 */
const ExternalContactChangeTypeMap = {
  1: '新增',
  4: '删除'
};

/**
 * 安全获取 ChangeType 文本
 * @param {number|string} ct - ChangeType 值
 * @param {boolean} isExternalContact - 是否外部联系人场景
 * @returns {string} - 映射文本或 `变更(N)` fallback
 */
function getChangeTypeText(ct, isExternalContact = false) {
  const map = isExternalContact ? ExternalContactChangeTypeMap : ChangeTypeMap;
  const n = Number(ct);
  if (map[n] !== undefined) return map[n];
  return `变更(${ct || '空'})`;
}

module.exports = {
  ChangeTypeMap,
  ExternalContactChangeTypeMap,
  getChangeTypeText
};