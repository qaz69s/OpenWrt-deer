#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-only
#
# 下载 DaeNext 预编译静态二进制（qaz69s/DaeNext release 的裸 musl 文件）
#
# 用法: download-deer.sh <ARCH_SUFFIX> <DL_DIR> <PKG_BUILD_DIR>
#   ARCH_SUFFIX: aarch64 | x86_64
# 环境变量（Makefile 传入）:
#   DEER_VERSION       release tag，如 v3.1.0-musl
#   DEER_WEB_VERSION   Web UI 资产版本，如 3.1.0
#   DEER_WITH_WEB      1=下载并解包 Web UI
#   DEER_REPO          上游仓库，默认 qaz69s/DaeNext
#
# 资产命名约定（release 必须遵守）:
#   daed-<arch>-musl            守护进程（daed，含 dae core + 产品层）
#   dae-<arch>-musl             诊断 CLI
#   daed-web-<版本>.tar.gz      Web UI（tar 内是 dist/ 前缀目录，需 strip 1 层）
#   SHA256SUMS                  可选，存在则强校验

set -e

ARCH_SUFFIX="$1"
DL_DIR="$2"
PKG_BUILD_DIR="$3"

[ -n "$ARCH_SUFFIX" ] || { echo "download-deer: 缺少 ARCH_SUFFIX 参数" >&2; exit 1; }
[ -n "$DL_DIR" ] || { echo "download-deer: 缺少 DL_DIR 参数" >&2; exit 1; }
[ -n "$PKG_BUILD_DIR" ] || { echo "download-deer: 缺少 PKG_BUILD_DIR 参数" >&2; exit 1; }

DEER_VERSION="${DEER_VERSION:?download-deer: 缺少 DEER_VERSION}"
DEER_REPO="${DEER_REPO:-qaz69s/DaeNext}"
DEER_WITH_WEB="${DEER_WITH_WEB:-1}"
BASE_URL="https://github.com/${DEER_REPO}/releases/download/${DEER_VERSION}"

mkdir -p "$DL_DIR" "$PKG_BUILD_DIR"

log() { echo "download-deer: $*"; }

# 下载到 DL_DIR（已存在且非空则复用缓存）。失败直接退出，绝不静默继续。
fetch() {
	_url="$1"
	_dest="$2"
	if [ -s "$_dest" ]; then
		log "命中缓存 $(basename "$_dest")"
		return 0
	fi
	log "下载 $(basename "$_dest")"
	rm -f "$_dest.tmp"
	if ! curl -fsSL --retry 3 --retry-delay 2 --connect-timeout 10 \
			-o "$_dest.tmp" "$_url"; then
		rm -f "$_dest.tmp"
		echo "download-deer: 下载失败 $_url" >&2
		echo "download-deer: 请确认 release ${DEER_VERSION} 存在且资产命名符合约定" >&2
		exit 1
	fi
	mv "$_dest.tmp" "$_dest"
}

# 校验 sha256（SHA256SUMS 可选；缺失只告警，不阻塞构建）
verify_sum() {
	_file="$1"
	_name="$2"
	_sums="$DL_DIR/SHA256SUMS.$DEER_VERSION"
	[ -f "$_sums" ] || return 0
	_want="$(awk -v n="$_name" '$2 == n { print $1; exit }' "$_sums")"
	[ -n "$_want" ] || return 0
	_got="$(sha256sum "$_file" | cut -d' ' -f1)"
	if [ "$_got" != "$_want" ]; then
		echo "download-deer: sha256 不匹配 $_name" >&2
		echo "  want=$_want" >&2
		echo "  got =$_got" >&2
		return 1
	fi
	log "sha256 校验通过 $_name"
}

# 下载 + 校验；不一致时丢掉缓存重下（上游同 tag 重发资产的情况）
# 注意：verify_sum 必须能"返回失败"，不能在里面 exit，否则这里没法重试。
fetch_verified() {
	_url="$1"
	_dest="$2"
	_name="$3"
	fetch "$_url" "$_dest"
	if ! verify_sum "$_dest" "$_name"; then
		log "缓存与 SHA256SUMS 不一致，强制重新下载 $_name"
		rm -f "$_dest"
		fetch "$_url" "$_dest"
		if ! verify_sum "$_dest" "$_name"; then
			echo "download-deer: $_name 重下后仍校验失败，中止" >&2
			exit 1
		fi
	fi
}

log "版本 ${DEER_VERSION} 架构 ${ARCH_SUFFIX}"

# SHA256SUMS（best-effort，但每次都尝试刷新）
# ⚠️ 不能只在「本地不存在」时下载：上游在同 tag 下重发资产时，dl/ 里缓存的旧
# SHA256SUMS 会让新资产一律校验失败（或让旧缓存一直"校验通过"），面板永远更新不了。
SUMS_FILE="$DL_DIR/SHA256SUMS.$DEER_VERSION"
rm -f "$SUMS_FILE.tmp"
if curl -fsSL --retry 2 --connect-timeout 10 -o "$SUMS_FILE.tmp" "$BASE_URL/SHA256SUMS" 2>/dev/null; then
	mv "$SUMS_FILE.tmp" "$SUMS_FILE"
else
	rm -f "$SUMS_FILE.tmp"
	[ -s "$SUMS_FILE" ] || log "SHA256SUMS 不可用，跳过校验"
fi

# 1) 守护进程
DAED_ASSET="daed-${ARCH_SUFFIX}-musl"
fetch_verified "$BASE_URL/$DAED_ASSET" "$DL_DIR/$DAED_ASSET" "$DAED_ASSET"
install -m 0755 "$DL_DIR/$DAED_ASSET" "$PKG_BUILD_DIR/daed"

# 2) 诊断 CLI（validate / active-datapath preflight / export）
DAE_ASSET="dae-${ARCH_SUFFIX}-musl"
fetch_verified "$BASE_URL/$DAE_ASSET" "$DL_DIR/$DAE_ASSET" "$DAE_ASSET"
install -m 0755 "$DL_DIR/$DAE_ASSET" "$PKG_BUILD_DIR/dae"

# 3) Web UI（daed 面板）
if [ "$DEER_WITH_WEB" = "1" ]; then
	[ -n "$DEER_WEB_VERSION" ] || {
		echo "download-deer: 无法从 ${DEER_VERSION} 推导 Web UI 版本号" >&2
		exit 1
	}
	WEB_ASSET="daed-web-${DEER_WEB_VERSION}.tar.gz"
	# Web UI 资产也纳入 SHA256SUMS 校验：上游若重新发布同名资产（内容变了），
	# 本地 dl/ 的旧缓存会被这里拦下并强制重下，而不是把旧面板打进包。
	fetch_verified "$BASE_URL/$WEB_ASSET" "$DL_DIR/$WEB_ASSET" "$WEB_ASSET"
	rm -rf "$PKG_BUILD_DIR/web"
	mkdir -p "$PKG_BUILD_DIR/web"
	if ! tar -xzf "$DL_DIR/$WEB_ASSET" -C "$PKG_BUILD_DIR/web" --strip-components=1; then
		echo "download-deer: 解包失败 $WEB_ASSET" >&2
		exit 1
	fi
	[ -f "$PKG_BUILD_DIR/web/index.html" ] || {
		echo "download-deer: $WEB_ASSET 内未找到 index.html（Web UI 资产结构不符）" >&2
		exit 1
	}
	log "Web UI 已解包 -> $PKG_BUILD_DIR/web"
else
	log "DEER_WEB=0，跳过 Web UI"
fi

log "完成"
