#!/bin/bash
# /opt/wecom-skill/deploy.sh
#
# 一键部署到 ~/.openclaw/skills/wecom-skill/
#
# 工作流：
#   1. 修改 src/ or bin/
#   2. ./deploy.sh
#   3. 自动 syntax-check + 同步 .js + 跑测试 + restart daemon
#
# 部署版镜像 dev 结构（pure skill 范式，无 tsc 编译）。

set -e

DEVOPS_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY="/opt/openclaw/skills/wecom-skill"
DAEMON_UNIT="wecom-skill-daemon"

echo "== [1/8] 备份 deploy 到 /data =="
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/data/wecom-skill-deploy-pre-deploy-${TS}"
mkdir -p "$BACKUP_DIR"
cp -a "$DEPLOY/." "$BACKUP_DIR/" 2>/dev/null && echo "    备份完成: $BACKUP_DIR"
echo "    ↑ 出错可回滚: rm -rf $DEPLOY && cp -a $BACKUP_DIR/. $DEPLOY/"

echo "== [2/8] syntax-check 所有 src/ bin/ 文件 (fail-fast) =="
# node --check 是官方 syntax check, 不执行代码, 0 dep
# 整个 src + bin 一起查，但排除 node_modules + tmp + test (test 可能有故意语法)
CHECK_FAILED=0
while IFS= read -r -d '' f; do
  if ! /usr/bin/node --check "$f" 2>/dev/null; then
    echo "    ✗ SyntaxError: $f"
    CHECK_FAILED=1
  fi
done < <(find "$DEVOPS_DIR/sdk" "$DEVOPS_DIR/bin" -name "*.js" -not -path "*/node_modules/*" 2>/dev/null -print0)
if [ "$CHECK_FAILED" -ne 0 ]; then
  echo "    ✗ 部分文件有 syntax 错误 — 中止部署 (deploy 保持原状)"
  exit 1
fi
echo "    ✓ 全部 .js syntax OK ($(find "$DEVOPS_DIR/sdk" "$DEVOPS_DIR/bin" -name '*.js' -not -path '*/node_modules/*' 2>/dev/null | wc -l) 个文件)"

echo "== [3/8] 复制 sdk/ + bin/ 到 deploy =="
# 先 cp 到 deploy.new/ 准备，cp 成功 + 文件数对得上才 mv 替换
TMP_DEPLOY_NEW="$DEPLOY.new"
rm -rf "$TMP_DEPLOY_NEW"
mkdir -p "$TMP_DEPLOY_NEW"
if ! cp -r "$DEVOPS_DIR/sdk/." "$TMP_DEPLOY_NEW/sdk/" 2>/dev/null; then
  echo "    ✗ cp sdk 失败 — 中止"
  rm -rf "$TMP_DEPLOY_NEW"
  exit 1
fi
if ! cp -r "$DEVOPS_DIR/bin/." "$TMP_DEPLOY_NEW/bin/" 2>/dev/null; then
  echo "    ✗ cp bin 失败 — 中止"
  rm -rf "$TMP_DEPLOY_NEW"
  exit 1
fi

# 验证文件数一致
SRC_SDK=$(find "$DEVOPS_DIR/sdk" -name "*.js" -not -path "*/node_modules/*" 2>/dev/null | wc -l)
DST_SDK=$(find "$TMP_DEPLOY_NEW/sdk" -name "*.js" -not -path "*/node_modules/*" 2>/dev/null | wc -l)
if [ "$SRC_SDK" -ne "$DST_SDK" ]; then
  echo "    ✗ sdk/ 复制后文件数 ($DST_SDK) 与源 ($SRC_SDK) 不一致 — 中止"
  rm -rf "$TMP_DEPLOY_NEW"
  exit 1
fi
SRC_BIN=$(find "$DEVOPS_DIR/bin" -name "*.js" 2>/dev/null | wc -l)
DST_BIN=$(find "$TMP_DEPLOY_NEW/bin" -name "*.js" 2>/dev/null | wc -l)
if [ "$SRC_BIN" -ne "$DST_BIN" ]; then
  echo "    ✗ bin/ 复制后文件数 ($DST_BIN) 与源 ($SRC_BIN) 不一致 — 中止"
  rm -rf "$TMP_DEPLOY_NEW"
  exit 1
fi

# 原子切换: 旧 sdk/ → sdk.bak/, bin/ → bin.bak/, 然后 mv 新的进来
rm -rf "$DEPLOY/sdk.bak" "$DEPLOY/bin.bak" 2>/dev/null
mv "$DEPLOY/sdk" "$DEPLOY/sdk.bak"
mv "$DEPLOY/bin" "$DEPLOY/bin.bak"
mv "$TMP_DEPLOY_NEW/sdk" "$DEPLOY/sdk"
mv "$TMP_DEPLOY_NEW/bin" "$DEPLOY/bin"
rm -rf "$TMP_DEPLOY_NEW"
echo "    ✓ 复制完成 (sdk: $SRC_SDK files, bin: $SRC_BIN files, 原子切换, bak 保留)"

echo "== [4/8] 同步 package.json + README + SKILL.md + config.example.json =="
cp -a "$DEVOPS_DIR/package.json" "$DEPLOY/package.json"
cp -a "$DEVOPS_DIR/README.md" "$DEPLOY/README.md" 2>/dev/null
cp -a "$DEVOPS_DIR/SKILL.md" "$DEPLOY/SKILL.md" 2>/dev/null
cp -a "$DEVOPS_DIR/config.example.json" "$DEPLOY/config.example.json" 2>/dev/null
echo "    ✓ 元文件同步"

echo "== [5/8] sync package-lock.json + npm install --production (按需) =="
cp -a "$DEVOPS_DIR/package-lock.json" "$DEPLOY/package-lock.json" 2>/dev/null
cd "$DEPLOY"
if [ ! -d node_modules ] || [ "$DEVOPS_DIR/package-lock.json" -nt "$DEPLOY/node_modules" ]; then
  echo "    install --production..."
  npm install --omit=dev 2>&1 | tail -5
else
  echo "    node_modules 已最新 — 跳过"
fi

echo "== [6/8] 跑测试 =="
cd "$DEVOPS_DIR"
if npm test 2>&1 | tail -5; then
  echo "    ✓ 测试全绿"
else
  echo "    ✗ 测试失败 — 已部署，但有问题需查"
fi

echo "== [7/8] restart wecom-skill daemon =="
# systemctl restart 前 ExecStartPre 也会 syntax-check，但这里先 npm test 过了应该 OK
systemctl --user restart "$DAEMON_UNIT"
sleep 3
if systemctl --user is-active --quiet "$DAEMON_UNIT"; then
  echo "    ✓ $DAEMON_UNIT 已 active"
else
  echo "    ✗ $DAEMON_UNIT 未起 — journalctl --user -u $DAEMON_UNIT -n 30"
  exit 1
fi

echo "== [8/8] openclaw-gateway 重启 (skill 重新发现) =="
systemctl --user restart openclaw-gateway
sleep 5
if curl -sf http://127.0.0.1:18789/health 2>/dev/null | grep -q "ok"; then
  echo "    ✓ openclaw-gateway /health OK"
else
  echo "    ⚠ gateway /health 未返 OK — 查 journal"
fi

echo ""
echo "✅ 部署完成"
echo "   备份: $BACKUP_DIR"
echo "   bak: $DEPLOY/sdk.bak/ $DEPLOY/bin.bak/"
echo "   daemon: $(systemctl --user show $DAEMON_UNIT -p ActiveState --value 2>/dev/null)"