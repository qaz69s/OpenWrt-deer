# This is free software, licensed under the GNU AFFERO GENERAL PUBLIC LICENSE v3.

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-deer
PKG_VERSION:=0.1.0
PKG_RELEASE:=2

LUCI_TITLE:=LuCI app for Deer (DaeNext / daed)
LUCI_DEPENDS:=+luci-base +deer
LUCI_PKGARCH:=all

PKG_LICENSE:=AGPL-3.0
PKG_MAINTAINER:=OpenWrt-deer contributors

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/install
	$(call Package/$(PKG_NAME)/install/Default,$(1))

	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./root/usr/libexec/rpcd/luci.deer $(1)/usr/libexec/rpcd/luci.deer

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-deer.json $(1)/usr/share/rpcd/acl.d/luci-app-deer.json

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-deer.json $(1)/usr/share/luci/menu.d/luci-app-deer.json

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./root/etc/uci-defaults/90_deer $(1)/etc/uci-defaults/90_deer
endef

# call BuildPackage - OpenWrt buildroot signature
