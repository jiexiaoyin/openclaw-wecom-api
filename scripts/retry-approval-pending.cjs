#!/usr/bin/env node
/**
 * retry-approval-pending.cjs - 重试推送失败的审批通知
 *
 * 触发: OpenClaw cron 每 5 分钟
 * 数据源: /opt/openclaw/state/wecom-approval-pending.json
 * 推送: SDK message.sendText(toUser, text, agentId)
 * 失败处理: retry_count++, >5 移 failed.json + 老板告警
 *
 * v2026-07-26 08:35 fix (老板 query 完整实现): P3 retry cron
 */

const fs = require('fs');
const path = require('path');

const PENDING_FILE = '/opt/openclaw/state/wecom-approval-pending.json';
const FAILED_FILE = '/opt/openclaw/state/wecom-approval-failed.json';
const MAX_RETRY = 5;
const LOG_PREFIX = '[retry-approval-pending]';

function log(level, msg) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${LOG_PREFIX} [${level}] ${msg}`);
}

function loadPending() {
  try {
    if (!fs.existsSync(PENDING_FILE)) return [];
    const raw = fs.readFileSync(PENDING_FILE, 'utf-8') || '[]';
    return JSON.parse(raw);
  } catch (e) {
    log('error', `loadPending failed: ${e.message}`);
    return [];
  }
}

function savePending(pending) {
  try {
    // 限制最大保留 50 条
    pending = pending.slice(-50);
    fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));
  } catch (e) {
    log('error', `savePending failed: ${e.message}`);
  }
}

function loadFailed() {
  try {
    if (!fs.existsSync(FAILED_FILE)) return [];
    const raw = fs.readFileSync(FAILED_FILE, 'utf-8') || '[]';
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveFailed(failed) {
  try {
    // 限制最大保留 100 条
    failed = failed.slice(-100);
    fs.writeFileSync(FAILED_FILE, JSON.stringify(failed, null, 2));
  } catch (e) {
    log('error', `saveFailed failed: ${e.message}`);
  }
}

async function buildApprovalDetailText(w, spNo) {
  // 调 SDK 拉详情 (与 event-router.js 共享 buildApprovalDetail 函数)
  const mod = require('../bin/event-router.js');
  const detail = await mod.buildApprovalDetail(w, spNo);
  const lines = detail.fields.map(f => `  ${f.key}: ${f.value}`);
  return lines.length > 0 ? `\n📝 申请内容:\n${lines.join('\n')}` : '';
}

async function pushOne(w, pending, agentId) {
  const { sp_no, sp_name, apply_user, sp_status, rawXml, retry_count = 0 } = pending;
  const statusMap = { 1: '🟡审批中', 2: '✅通过', 3: '❌驳回', 4: '🚫撤销' };

  let detailBlock = '';
  try {
    detailBlock = await buildApprovalDetailText(w, sp_no);
  } catch (e) {
    log('warn', `buildApprovalDetail(${sp_no}) failed: ${e.message}`);
  }

  const text = `📋 企业微信审批 (重试)

模板/名称: ${sp_name}
单号: ${sp_no}
申请人: ${apply_user}
状态: ${statusMap[sp_status] || sp_status}${detailBlock}

🕐 ${new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })}`;

  try {
    const toUser = 'jie_xiao_yin';  // 老板
    const result = await w.message.sendText(toUser, text, agentId);
    const ec = result?.errcode;
    if (ec === 0 || ec === undefined) {
      log('info', `✅ 重试推送成功 sp_no=${sp_no} retry_count=${retry_count}`);
      return { ok: true };
    }
    log('warn', `重试推送失败 sp_no=${sp_no} ec=${ec} err=${result?.errmsg}`);
    return { ok: false, error: `errcode=${ec} ${result?.errmsg}` };
  } catch (e) {
    log('error', `重试推送异常 sp_no=${sp_no}: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

async function main() {
  log('info', '=== retry start ===');

  const pending = loadPending();
  if (pending.length === 0) {
    log('info', 'pending queue empty, exit');
    return;
  }
  log('info', `pending count: ${pending.length}`);

  // 加载 SDK
  const Wecom = require('../sdk');
  const config = require('../config.json');
  const w = new Wecom(config);
  const agentId = parseInt(config.agentId);

  const remaining = [];
  const failed = loadFailed();
  let okCount = 0;
  let failCount = 0;
  let moveToFailed = 0;

  for (const item of pending) {
    const result = await pushOne(w, item, agentId);
    if (result.ok) {
      okCount++;
    } else {
      const nextRetry = (item.retry_count || 0) + 1;
      if (nextRetry > MAX_RETRY) {
        // 超过最大重试, 移到 failed
        failed.push({ ...item, retry_count: nextRetry, finalError: result.error, failedAt: Math.floor(Date.now() / 1000) });
        moveToFailed++;
        log('error', `超过最大重试 sp_no=${item.sp_no} retry_count=${nextRetry}, 移到 failed`);
      } else {
        remaining.push({ ...item, retry_count: nextRetry, lastError: result.error, lastRetryAt: Math.floor(Date.now() / 1000) });
        failCount++;
      }
    }
  }

  savePending(remaining);
  saveFailed(failed);

  log('info', `=== retry done: ok=${okCount} fail=${failCount} moved_to_failed=${moveToFailed} remaining=${remaining.length} ===`);
}

main().catch(e => {
  log('error', `main fatal: ${e.message}`);
  process.exit(1);
});