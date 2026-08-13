/**
 * wecom-skill v1.2.0 — wedoc 事件存储（node:sqlite 内置，零依赖）
 *
 * 表设计要点：
 * 1. UNIQUE INDEX (change_type, from_user, create_time) — 利用 WeCom POST 3-retry 语义去重
 * 2. INSERT OR IGNORE — 重试时直接丢弃，不报错
 * 3. DocId/FieldId/RecordId 可能多个（XML 重复元素）— 序列化为 JSON 字符串存一列
 * 4. rawXml 保留完整解密后明文 — 调试 / 未来字段扩展
 *
 * 使用：bin/wecom-daemon.js 写、bin/wecom-cli.js events 域读
 */
'use strict';

const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  app_id TEXT,
  event TEXT,
  change_type TEXT,
  from_user TEXT,
  agent_id TEXT,
  create_time INTEGER,
  doc_id TEXT,
  sheet_id TEXT,
  field_id TEXT,
  record_id TEXT,
  form_id TEXT,
  raw_xml TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedup
  ON events(change_type, from_user, create_time)
  WHERE change_type IS NOT NULL AND from_user IS NOT NULL AND create_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_change_type_time
  ON events(change_type, received_at);
CREATE INDEX IF NOT EXISTS idx_events_doc_id ON events(doc_id);
`;

/**
 * 创建事件存储
 * @param {string} dbPath sqlite 文件路径
 */
function createEventsStore(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);

  const insert = db.prepare(`INSERT OR IGNORE INTO events
    (app_id, event, change_type, from_user, agent_id, create_time, doc_id, sheet_id, field_id, record_id, form_id, raw_xml)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);

  const selectById = db.prepare(`SELECT * FROM events WHERE id = ?`);

  const selectList = db.prepare(`SELECT * FROM events
    WHERE (?1 IS NULL OR change_type = ?1)
      AND (?2 IS NULL OR doc_id = ?2)
      AND (?3 IS NULL OR received_at >= ?3)
    ORDER BY received_at DESC LIMIT ?4`);

  const selectStats = db.prepare(`SELECT
    change_type, COUNT(*) as cnt, MAX(received_at) as last_seen
    FROM events WHERE received_at >= ?1
    GROUP BY change_type ORDER BY cnt DESC`);

  return {
    insert(e) {
      // node:sqlite 不接受 undefined 绑定值 — 转 null
      const norm = (v) => (v === undefined ? null : v);
      return insert.run(
        norm(e.appId), norm(e.event), norm(e.changeType), norm(e.fromUser), norm(e.agentId), norm(e.createTime),
        norm(e.docId), norm(e.sheetId), norm(e.fieldId), norm(e.recordId), norm(e.formId), norm(e.rawXml),
      );
    },
    get(id) { return selectById.get(id); },
    list({ changeType, docId, since, limit = 50 } = {}) {
      return selectList.all(changeType ?? null, docId ?? null, since ?? null, limit);
    },
    stats({ since } = {}) { return selectStats.all(since ?? 0); },
    close() { db.close(); },
  };
}

module.exports = { createEventsStore };
