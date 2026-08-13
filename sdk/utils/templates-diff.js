/**
 * 审批模板 diff 工具 (v2026-07-26 老板 query 全做-B)
 *
 * 用途: 对比"本地 docs/approval-templates.json" vs "企微 SDK syncApprovalTemplates 拉回来" 的差异
 * 设计: 输入是 2 个 {template_id, controls[]}[] 数组, 输出按 ID 索引的 diff
 *
 * 老板用途:
 *   1. 每次 SDK 升级后, 检查是否有"老板后台改了但本地没更新" 的模板
 *   2. 每次 w.approval.syncApprovalTemplates() 后, 检查拉回的数据是不是符合预期
 */

const SEVERITY = {
  ADDED: 'added',         // 仅远程 (企微后台新增)
  REMOVED: 'removed',     // 仅本地 (企微后台删除)
  CHANGED: 'changed',     // 控件结构变了
  CONTROL_ADDED: 'control_added',
  CONTROL_REMOVED: 'control_removed',
  CONTROL_CHANGED: 'control_changed',
  UNCHANGED: 'unchanged'
};

/**
 * 单模板 diff: 比较 2 个 controls[]
 * @param {Array} localControls - 本地 docs 的 controls[]
 * @param {Array} remoteControls - SDK 拉回来的 controls[]
 * @returns {object}
 */
function diffTemplateControls(localControls, remoteControls) {
  const localMap = new Map();
  const remoteMap = new Map();

  for (const c of (localControls || [])) {
    if (c.control && c.id) localMap.set(c.id, c);
  }
  for (const c of (remoteControls || [])) {
    if (c.control && c.id) remoteMap.set(c.id, c);
  }

  const diffs = [];
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);
    if (local && !remote) {
      diffs.push({ severity: SEVERITY.CONTROL_REMOVED, id, local });
    } else if (!local && remote) {
      diffs.push({ severity: SEVERITY.CONTROL_ADDED, id, remote });
    } else {
      // 都存在, 比较关键字段
      const fields = ['control', 'title', 'require', 'hidden'];
      const changes = [];
      for (const f of fields) {
        if (JSON.stringify(local[f]) !== JSON.stringify(remote[f])) {
          changes.push({ field: f, local: local[f], remote: remote[f] });
        }
      }
      if (changes.length > 0) {
        diffs.push({ severity: SEVERITY.CONTROL_CHANGED, id, changes });
      }
    }
  }
  return diffs;
}

/**
 * 多模板 diff: 对比 2 个 results[] (from syncApprovalTemplates)
 * @param {Array<{template_id, controls}>} localData - 本地 docs + 推断 (本地通常没有 controls, 用空数组占位)
 * @param {Array<{template_id, controls}>} remoteData - syncApprovalTemplates 返回
 * @returns {object} - 按 severity 分组的 summary
 */
function diffTemplates(localData, remoteData) {
  const localMap = new Map();
  const remoteMap = new Map();

  for (const t of (localData || [])) {
    if (t.template_id) localMap.set(t.template_id, t);
  }
  for (const t of (remoteData || [])) {
    if (t.template_id) remoteMap.set(t.template_id, t);
  }

  const summary = {
    [SEVERITY.ADDED]: [],
    [SEVERITY.REMOVED]: [],
    [SEVERITY.CHANGED]: [],
    [SEVERITY.UNCHANGED]: []
  };

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const tid of allIds) {
    const local = localMap.get(tid);
    const remote = remoteMap.get(tid);
    if (local && !remote) {
      summary[SEVERITY.REMOVED].push({ template_id: tid, name: local.name });
    } else if (!local && remote) {
      summary[SEVERITY.ADDED].push({ template_id: tid, name: remote.name });
    } else {
      // 都存在, 比 controls
      const changes = diffTemplateControls(local.controls || [], remote.controls || []);
      if (changes.length === 0) {
        summary[SEVERITY.UNCHANGED].push({ template_id: tid, name: remote.name });
      } else {
        summary[SEVERITY.CHANGED].push({
          template_id: tid,
          name: remote.name || local.name,
          diffs: changes
        });
      }
    }
  }

  return {
    summary,
    total: allIds.size,
    unchanged_count: summary[SEVERITY.UNCHANGED].length,
    changed_count: summary[SEVERITY.CHANGED].length,
    added_count: summary[SEVERITY.ADDED].length,
    removed_count: summary[SEVERITY.REMOVED].length
  };
}

/**
 * 打印 diff 结果 (人类可读)
 * @param {object} diffResult - diffTemplates() 返回
 * @returns {string}
 */
function formatDiff(diffResult) {
  const lines = [];
  lines.push('=== 模板 diff 结果 ===');
  lines.push(`总模板: ${diffResult.total}`);
  lines.push(`  未变: ${diffResult.unchanged_count}`);
  lines.push(`  变更: ${diffResult.changed_count}`);
  lines.push(`  新增: ${diffResult.added_count}`);
  lines.push(`  删除: ${diffResult.removed_count}`);
  lines.push('');

  if (diffResult.summary.added.length > 0) {
    lines.push('--- 新增 (仅远程) ---');
    for (const t of diffResult.summary.added) {
      lines.push(`  + ${t.name} (${t.template_id})`);
    }
    lines.push('');
  }

  if (diffResult.summary.removed.length > 0) {
    lines.push('--- 删除 (仅本地) ---');
    for (const t of diffResult.summary.removed) {
      lines.push(`  - ${t.name} (${t.template_id})`);
    }
    lines.push('');
  }

  if (diffResult.summary.changed.length > 0) {
    lines.push('--- 变更 (控件结构不同) ---');
    for (const t of diffResult.summary.changed) {
      lines.push(`  ~ ${t.name} (${t.template_id}):`);
      for (const d of t.diffs) {
        if (d.severity === SEVERITY.CONTROL_ADDED) {
          lines.push(`    + 控件 ${d.id} (${d.remote.control})`);
        } else if (d.severity === SEVERITY.CONTROL_REMOVED) {
          lines.push(`    - 控件 ${d.id} (${d.local.control})`);
        } else if (d.severity === SEVERITY.CONTROL_CHANGED) {
          lines.push(`    ~ 控件 ${d.id}:`);
          for (const ch of d.changes) {
            lines.push(`        ${ch.field}: ${JSON.stringify(ch.local)} → ${JSON.stringify(ch.remote)}`);
          }
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  SEVERITY,
  diffTemplateControls,
  diffTemplates,
  formatDiff
};