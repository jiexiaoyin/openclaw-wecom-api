/**
 * Approval templates JSON schema validator (v2026-07-26 老板 query C)
 *
 * 决策: 用 zero-deps 手写 validator 而非装 ajv (减少依赖 + 启动更快)
 *
 * 校验项 (跟 docs/approval-templates.schema.json 一致):
 *   1. 顶层必须是 object
 *   2. 每个非 _ 开头 key 必须是 array
 *   3. 每个 item 必须有 name + template_id
 *   4. template_id 必须匹配 ^\[a-zA-Z0-9_-\]{8,64}$
 *   5. 同一 JSON 内 template_id 必须唯一
 *
 * @param {object} data - 解析后的 JSON
 * @returns {{ok: boolean, errors: string[]}}
 */
function validateApprovalTemplates(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('顶层必须是 object');
    return { ok: false, errors };
  }

  const seenIds = new Set();
  const dupIds = [];

  for (const [group, items] of Object.entries(data)) {
    if (group.startsWith('_')) continue;  // _meta / _stat 元数据跳过
    if (!Array.isArray(items)) {
      errors.push(`分组 "${group}" 必须是 array, 实际是 ${typeof items}`);
      continue;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const path = `${group}[${i}]`;
      if (!it || typeof it !== 'object') {
        errors.push(`${path} 必须是 object`);
        continue;
      }
      if (typeof it.name !== 'string' || it.name.length === 0) {
        errors.push(`${path}.name 必须是 string 且非空, 实际 ${JSON.stringify(it.name)}`);
      }
      if (typeof it.template_id !== 'string' || it.template_id.length === 0) {
        errors.push(`${path}.template_id 必须是 string 且非空`);
      } else if (!/^[a-zA-Z0-9_-]{8,64}$/.test(it.template_id)) {
        errors.push(`${path}.template_id "${it.template_id}" 格式错误 (期望 8-64 位字母数字_-)`);
      } else {
        // 唯一性检查
        if (seenIds.has(it.template_id)) {
          dupIds.push(`${path}: ${it.template_id}`);
        }
        seenIds.add(it.template_id);
      }
    }
  }

  // 重复 IDs 单独报告 (按 SOP-7 "枚举唯一性" 原则)
  if (dupIds.length > 0) {
    errors.push(`template_id 重复 (${dupIds.length} 处): ${dupIds.slice(0, 3).join('; ')}${dupIds.length > 3 ? '...' : ''}`);
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { validateApprovalTemplates };
