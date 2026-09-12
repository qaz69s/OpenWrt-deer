# SPDX-License-Identifier: AGPL-3.0-only
#
# Copyright (C) 2026 OpenWrt-deer contributors

include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/package.mk

PKG_NAME    := deer
# DaeNext 引擎版本：默认每次构建都查询 GitHub 获取该 fork 的最新 release。
# 可命令行覆盖锁定（可复现构建）：
#   make package/deer/compile DEER_VERSION=v3.1.0-musl
# 查询失败时回退 v3.1.0-musl，保证离线/限流时也能构建。
DEER_VERSION ?= latest
ifeq ($(DEER_VERSION),latest)
DEER_LATEST := $(shell v=$$(curl -fsSL --retry 2 --connect-timeout 5 https://api.github.com/repos/qaz69s/DaeNext/releases 2>/dev/null | grep -m1 '"tag_name"' | cut -d'"' -f4); [ -n "$$v" ] && echo "$$v" || echo v3.1.0-musl)
DEER_VERSION := $(DEER_LATEST)
endif
# apk 版本号格式要求严格：每个点分段必须以数字开头，且 `_` 后缀只接受
# alpha/beta/pre/rc/cvs/svn/git/hg/p 白名单（实测 apk mkpkg 拒绝 `3.1.0_musl`
# 与 `3.1.0-musl`，只有 `3.1.0` 通过）。因此 PKG_VERSION 只取 tag 的数字主干；
# tag 里的 `-musl` 这类构建后缀无法在版本号中表达。
# v3.1.0-musl -> 3.1.0 ；v3.2.0 -> 3.2.0
PKG_VERSION := $(shell echo '$(DEER_VERSION)' | sed -E 's/^v//; s/[-_].*$$//')
# 同一数字版本重新发布（例如重打 tag）时用 DEER_RELEASE 递增：
#   make package/deer/compile DEER_RELEASE=2
DEER_RELEASE ?= 1
PKG_RELEASE := $(DEER_RELEASE)

PKG_LICENSE    := AGPL-3.0-only
PKG_MAINTAINER := OpenWrt-deer contributors

# ── 架构映射：OpenWrt ARCH → DaeNext release asset 后缀 ────────────────
# 注意：不在解析期用 $(error)（扫描阶段 $(ARCH) 为空会让包不被注册），
# 不支持的架构统一在 Build/Prepare 阶段报错。
# ⚠️ 必须先精确匹配 x86_64：它自身含下划线，用 $(firstword $(subst _, ,...)) 会
# 被拆成 `x86` 从而匹配失败（实测踩过）。
ifeq ($(ARCH),x86_64)
  DEER_TARGET := x86_64
else ifeq ($(ARCH),aarch64)
  DEER_TARGET := aarch64
else
  # 复合架构名（如 aarch64_cortex-a53 / aarch64_cortex-a72）取首段主架构
  DEER_ARCH_BASE := $(firstword $(subst _, ,$(ARCH)))
  ifeq ($(DEER_ARCH_BASE),aarch64)
    DEER_TARGET := aarch64
  else
    DEER_TARGET :=
  endif
endif

# ── 可覆盖开关 ────────────────────────────────────────────────────────
# DEER_WEB=0      不打包 daed Web UI（仅 REST API，体积小 2.3M）
# DEER_WITH_CLI=0 不安装 /usr/bin/dae 诊断 CLI（避免与 joey 包的文件冲突）
DEER_WEB      ?= 1
DEER_WITH_CLI ?= 1
# 前端资产名 daed-web-<版本>.tar.gz：版本 = release tag 去前导 v 与 -musl 后缀
DEER_WEB_VERSION := $(shell echo '$(DEER_VERSION)' | sed -E 's/^v//; s/-musl$$//')

define Package/deer
  SECTION  := net
  CATEGORY := Network
  SUBMENU  := Web Servers/Proxies
  TITLE    := Deer - DaeNext (daed) Rust-native eBPF transparent proxy
  URL      := https://github.com/qaz69s/DaeNext
  # 运行时依赖：
  #  ip-full/tc-bpf —— daed 的 eBPF 数据面通过 `tc qdisc add ... clsact` /
  #                   `tc filter add ... bpf` / `ip netns exec` 附加程序（shell 调用）
  #  kmod-sched-core —— sch_clsact / sch_ingress
  #  kmod-sched-bpf  —— cls_bpf
  #  kmod-veth       —— 数据面 netns 的 veth 对（dae50cli0/dae50lan0）
  #  geoip/geosite   —— /usr/share/deer/*.dat 软链目标
  DEPENDS  := @(aarch64||x86_64) \
	+ca-bundle +ip-full +tc-bpf \
	+kmod-sched-core +kmod-sched-bpf +kmod-veth +kmod-xdp-sockets-diag \
	+v2ray-geoip +v2ray-geosite
endef

define Package/deer/description
  Prebuilt DaeNext binaries installed as /usr/bin/daed (daemon, dae core +
  product layer with REST API and Web UI) and /usr/bin/dae (diagnostic CLI),
  together with a procd init script and UCI configuration. Install
  luci-app-deer for the LuCI interface.
endef

define Package/deer/conffiles
/etc/config/deer
endef

define Build/Prepare
	[ -n "$(DEER_TARGET)" ] || { \
		echo "Deer: 不支持的架构 $(ARCH)，仅支持 aarch64 / x86_64" >&2; \
		exit 1; \
	}
	DEER_VERSION="$(DEER_VERSION)" DEER_WEB_VERSION="$(DEER_WEB_VERSION)" \
	DEER_WITH_WEB="$(DEER_WEB)" \
		$(CURDIR)/files/download-deer.sh "$(DEER_TARGET)" "$(DL_DIR)" "$(PKG_BUILD_DIR)"
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/deer/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/daed $(1)/usr/bin/daed
ifeq ($(DEER_WITH_CLI),1)
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/dae $(1)/usr/bin/dae
endif

	$(INSTALL_DIR) $(1)/etc/deer
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) $(CURDIR)/files/deer.config $(1)/etc/config/deer

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(CURDIR)/files/deer.init $(1)/etc/init.d/deer

	$(INSTALL_DIR) $(1)/usr/share/deer
	$(LN) ../v2ray/geoip.dat $(1)/usr/share/deer/geoip.dat
	$(LN) ../v2ray/geosite.dat $(1)/usr/share/deer/geosite.dat

ifeq ($(DEER_WEB),1)
	$(INSTALL_DIR) $(1)/usr/share/deer/web
	$(CP) $(PKG_BUILD_DIR)/web/. $(1)/usr/share/deer/web/
endif
endef

define Package/deer/postinst
#!/bin/sh
[ -z "$${IPKG_INSTROOT}" ] && {
	mkdir -p /etc/deer
	chmod 0700 /etc/deer 2>/dev/null || true
	[ -x /etc/init.d/deer ] && /etc/init.d/deer enable 2>/dev/null || true
	# 升级场景：服务已在跑则重启，让新二进制的 Web UI / API 生效
	if /etc/init.d/deer running 2>/dev/null; then
		/etc/init.d/deer restart 2>/dev/null || true
	fi
}
exit 0
endef

define Package/deer/prerm
#!/bin/sh
[ -z "$${IPKG_INSTROOT}" ] && {
	[ -x /etc/init.d/deer ] && {
		/etc/init.d/deer stop    2>/dev/null || true
		/etc/init.d/deer disable 2>/dev/null || true
	}
	# 清理 geodata 兜底软链（仅当仍指向本包依赖的 v2ray geodata 时）
	[ "$$(readlink /usr/share/daed/geoip.dat 2>/dev/null)" = "../v2ray/geoip.dat" ] && rm -f /usr/share/daed/geoip.dat
	[ "$$(readlink /usr/share/daed/geosite.dat 2>/dev/null)" = "../v2ray/geosite.dat" ] && rm -f /usr/share/daed/geosite.dat
	rmdir /usr/share/daed 2>/dev/null || true
}
exit 0
endef

$(eval $(call BuildPackage,deer))
