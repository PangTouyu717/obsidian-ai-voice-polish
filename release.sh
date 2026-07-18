#!/bin/bash
# ============================================================
# release.sh — AI Voice Polish 一键发版脚本
#
# 用法: bash release.sh <版本号> <更新说明>
# 示例: bash release.sh 0.1.19 "修复xxx"
#
# 流程: build → commit → push(自动重试) → tag → push tag → release → verify
# 任何一步失败就终止，不会留下半残的 Release
# ============================================================

set -e  # 任何错误立即退出

VERSION="$1"
NOTES="$2"

if [ -z "$VERSION" ]; then
  echo "❌ 用法: bash release.sh <版本号> <更新说明>"
  echo "   示例: bash release.sh 0.1.19 \"修复xxx\""
  exit 1
fi

echo "════════════════════════════════════════════"
echo "  发布 v$VERSION"
echo "════════════════════════════════════════════"

# ── 1. 检查当前版本号是否已更新 ──
CURRENT=$(grep '"version"' manifest.json | head -1 | grep -oP '"\d+\.\d+\.\d+"' | tr -d '"')
if [ "$CURRENT" != "$VERSION" ]; then
  echo "❌ manifest.json 版本是 $CURRENT，不是 $VERSION"
  echo "   请先更新 manifest.json / package.json / versions.json"
  exit 1
fi
echo "✅ 版本号: $VERSION"

# ── 2. 构建 ──
echo ""
echo "📦 构建中..."
npm run build
echo "✅ 构建完成"

# ── 3. 提交 ──
echo ""
echo "📝 提交中..."
git add -A
git commit -m "v$VERSION: $NOTES"
echo "✅ 已提交"

# ── 4. 推送（自动重试，最多10次） ──
echo ""
echo "📤 推送代码到 GitHub..."
RETRIES=0
MAX_RETRIES=10
until git push origin main; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo "❌ 推送失败 $MAX_RETRIES 次，终止"
    exit 1
  fi
  echo "  推送失败，${RETRIES}s 后重试 ($RETRIES/$MAX_RETRIES)..."
  sleep $RETRIES
done
echo "✅ 代码已推送"

# ── 5. 验证远程已同步 ──
REMOTE=$(git log --oneline origin/main -1)
LOCAL=$(git log --oneline main -1)
if [ "$REMOTE" != "$LOCAL" ]; then
  echo "❌ 远程和本地不一致，推送可能未成功"
  exit 1
fi
echo "✅ 远程已同步"

# ── 6. 打 tag 并推送 ──
echo ""
echo "🏷️ 打 tag: v$VERSION"
git tag "$VERSION"
RETRIES=0
until git push origin "$VERSION"; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo "❌ Tag 推送失败 $MAX_RETRIES 次，终止"
    exit 1
  fi
  echo "  Tag 推送失败，${RETRIES}s 后重试 ($RETRIES/$MAX_RETRIES)..."
  sleep $RETRIES
done
echo "✅ Tag 已推送"

# ── 7. 创建 Release ──
echo ""
echo "🚀 创建 Release..."
NOTES_SAFE=$(echo "$NOTES" | sed 's/"/\\"/g')
gh release create "$VERSION" \
  --title "$VERSION" \
  --notes "v$VERSION — $NOTES_SAFE" \
  main.js manifest.json styles.css
echo "✅ Release 已创建"

# ── 8. 验证 ──
echo ""
echo "🔍 验证中..."
sleep 3
TAG_CHECK=$(gh release view "$VERSION" --json tagName 2>&1 | grep -oP '"tagName":"\K[^"]+')
if [ "$TAG_CHECK" = "$VERSION" ]; then
  echo "✅ Release v$VERSION 验证通过"
  echo ""
  echo "════════════════════════════════════════════"
  echo "  发布成功！用户去 Obsidian 检查更新即可。"
  echo "════════════════════════════════════════════"
else
  echo "❌ Release 验证失败"
  exit 1
fi
