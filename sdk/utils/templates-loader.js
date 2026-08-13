/**
 * 审批模板本地加载 (v2026-07-26)
 *
 * 用途：企微 API 不提供 list templates 接口, 但 SDK 已知本地 docs/approval-templates.json
 *       (老板 10:32 从企微 admin 后台 HTML 解析的 33 个模板)
 *
 * 设计: 不接 SDK, 只在 utils 提供本地加载 (避免 SDK 实例字段污染)
 */

const path = require('path');
const fs = require('fs');
const { validateApprovalTemplates } = require('./templates-validator');

/**
 * 加载本地审批模板配置
 * @param {string} [docsPath] - docs 目录绝对路径, 默认 = wecom-skill/docs/
 * @param {object} [options]
 * @param {boolean} [options.validate=true] - 是否检查 schema (遇错误抛错)
 * @returns {object} - { 组名: [{name, template_id}], ... }
 */
function loadApprovalTemplates(docsPath, options = {}) {
  const { validate = true } = options;
  const docsDir = docsPath || path.join(__dirname, '../../docs');
  const templatesPath = path.join(docsDir, 'approval-templates.json');
  const examplePath = path.join(docsDir, 'approval-templates.schema.json');

  let raw;
  if (fs.existsSync(templatesPath)) {
    raw = JSON.parse(fs.readFileSync(templatesPath, 'utf-8'));
  } else if (fs.existsSync(examplePath)) {
    raw = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
  } else {
    return {};
  }

  // schema 校验 (老板 query C, zero-deps 验证)
  if (validate) {
    const result = validateApprovalTemplates(raw);
    if (!result.ok) {
      throw new Error(
        `approval-templates.json schema 校验失败 (${result.errors.length} 处):\n` +
        result.errors.slice(0, 10).map(e => '  - ' + e).join('\n') +
        (result.errors.length > 10 ? '\n  ... 还有 ' + (result.errors.length - 10) + ' 处' : '')
      );
    }
  }

  return raw;
}

/**
 * 扁平化所有模板 (组 → 平铺)
 * @returns {Array<{group: string, name: string, template_id: string}>}
 */
function flattenTemplates(templates) {
  const out = [];
  for (const [group, items] of Object.entries(templates || {})) {
    if (group.startsWith('_')) continue;  // 跳过 _meta / _stat
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      out.push({
        group,
        name: it.name,
        template_id: it.template_id
      });
    }
  }
  return out;
}

module.exports = { loadApprovalTemplates, flattenTemplates };