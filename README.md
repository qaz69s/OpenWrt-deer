# Deer —— OpenWrt 上的 DaeNext（daed）

Deer 是 **DaeNext**（Rust 原生 dae：dae 内核 + 产品层）的 OpenWrt 集成包，结构照搬
[Horse](https://github.com/qaz69s/OpenWrt-horse)：

- `deer/` —— 守护进程包：从 [qaz69s/DaeNext](https://github.com/qaz69s/DaeNext/releases)
  取预编译 **musl 静态二进制**，装 `/usr/bin/daed`（守护进程）与 `/usr/bin/dae`（诊断 CLI），
  附 procd init + UCI 配置
- `luci-app-deer/` —— LuCI 界面：控制 / 设置 / 日志 三个标签页

## 与 horse 的关键区别：配置在哪

| | Horse (honk) | Deer (daed) |
|---|---|---|
| 引擎 | honk（Rust，Go 版 dae 的重写） | DaeNext（Rust 原生 dae + 产品层） |
| 代理配置载体 | `/etc/horse/config.dae`（文本文件） | `daed.db`（SQLite），经 **Web UI / REST API** 改写 |
| 配置入口 | LuCI 内置 `.dae` 编辑器 | daed 面板（`http://<路由器>:2023/`） |
| LuCI 的角色 | 编辑器 + 服务管理 | 服务管理 + 数据面体检 + 日志（不改代理配置） |

`daed run -c <路径>` 的 `-c` **必须是目录**（传 `.dae` 文件会被直接拒绝：
`config directory ... must be a directory`），配置实体存在状态库里，所以 Deer 的
「设置」页只放运行时参数，节点/订阅/路由/DNS 全部在 daed 面板里配。

## 安装

包内没带二进制，二进制在构建/安装时从 Release 拉：

```sh
# 设备上手动装（aarch64）
wget -O /tmp/daed https://github.com/qaz69s/DaeNext/releases/download/v3.1.0-musl/daed-aarch64-musl
wget -O /tmp/dae  https://github.com/qaz69s/DaeNext/releases/download/v3.1.0-musl/dae-aarch64-musl
install -m0755 /tmp/daed /usr/bin/daed
install -m0755 /tmp/dae  /usr/bin/dae
# 正规方式仍是编译 .apk 后 apk add（见下）
```

首次使用：浏览器打开 `http://<路由器IP>:2023/` → Setup 建管理员 → 粘贴/导入 `.dae`
配置或建订阅 → 应用。**新装不会接管流量**：daed 只在配置被应用后才起数据面
（`should_restore_runtime_on_start()` 在新装 state 上返回 false）。

## 构建

```sh
# 放进任意 OpenWrt 构建树的 package/new/
git clone https://github.com/qaz69s/OpenWrt-deer.git package/new/OpenWrt-deer

# 启用两个包（先备份 .config）：
cp .config .config.bak-$(date +%s)
sed -i 's/# CONFIG_PACKAGE_deer is not set/CONFIG_PACKAGE_deer=y/' .config
sed -i 's/# CONFIG_PACKAGE_luci-app-deer is not set/CONFIG_PACKAGE_luci-app-deer=y/' .config
make defconfig

make package/deer/compile V=s
make package/luci-app-deer/compile V=s
```

## 上游 Release 资产命名约定（构建依赖这个）

`deer/files/download-deer.sh` 按下面的名字取资产，**改名会直接构建失败**：

| 资产 | 用途 |
|---|---|
| `daed-<arch>-musl`（`aarch64`/`x86_64`） | 守护进程 → `/usr/bin/daed` |
| `dae-<arch>-musl` | 诊断 CLI → `/usr/bin/dae` |
| `daed-web-<版本>.tar.gz`（内含 `dist/` 前缀） | Web UI → `/usr/share/deer/web/` |
| `SHA256SUMS`（可选） | 存在则强校验两个二进制 |

`DEER_VERSION` 默认 `latest`（每次构建查 GitHub 最新 release，失败回退 `v3.1.0-musl`）；
可锁版：`make package/deer/compile DEER_VERSION=v3.1.0-musl`。

两个开关：

```sh
make package/deer/compile DEER_WEB=0        # 不带 Web UI（省 2.3M）
make package/deer/compile DEER_WITH_CLI=0   # 不装 /usr/bin/dae（见下方冲突说明）
```

## 运行时依赖（为什么是这些）

`daed` 的数据面通过 **shell 调用 `tc` / `ip`** 附加 eBPF 程序
（`crates/dae-ebpf-support/src/attach/tc_command.rs`：`tc qdisc add dev X clsact`、
`tc filter add ... bpf`、跨 netns 时用 `ip netns exec`），因此：

| 依赖 | 依据 |
|---|---|
| `+ip-full +tc-bpf` | 数据面附加 eBPF 需要带 libbpf 的 `tc`，以及能 `ip netns exec` 的 `ip` |
| `+kmod-sched-core` | `sch_clsact` / `sch_ingress` |
| `+kmod-sched-bpf` | `cls_bpf` |
| `+kmod-veth` | 数据面 netns 的 veth 对（`dae50cli0` / `dae50lan0`） |
| `+kmod-xdp-sockets-diag` | socket 诊断（与 joey 同款前置） |
| `+ca-bundle` | 订阅下载 TLS 根证书 |
| `+v2ray-geoip +v2ray-geosite` | `/usr/share/deer/{geoip,geosite}.dat` 软链目标（daed 要求它们位于 `web_root` 的**父目录**） |

架构限制 `@(aarch64||x86_64)`：上游只发布了这两个 musl 目标。

## 文件布局

```
/usr/bin/daed                        守护进程（含 dae core + 产品层）
/usr/bin/dae                         诊断 CLI（validate / active-datapath preflight / export）
/etc/deer/                           配置目录（0700） + daed.db
/etc/config/deer                     UCI
/etc/init.d/deer                     procd 服务
/usr/share/deer/web/                 daed 面板（Web UI）
/usr/share/deer/{geoip,geosite}.dat  软链 → /usr/share/v2ray/
/tmp/log/deer/current.jsonl          产品日志（JSONL）
/run/daed/control.sock              控制面 IPC（daed 固定默认路径）
```

## ⚠️ 与 joey 包的文件冲突

`joey` 包（Go 版 dae）也安装 `/usr/bin/dae`，与 Deer 的 CLI 撞路径。同一设备上两者
不能同时装（apk 会报文件冲突）。只装一个，或用 `DEER_WITH_CLI=0` 构建 Deer
——此时 LuCI「控制」页的数据面体检会显示 CLI 未安装（其余功能不受影响）。

## UCI

| 选项 | 默认 | 说明 |
|---|---|---|
| `config_dir` | `/etc/deer` | 配置目录（daed.db 所在） |
| `state` | `/etc/deer/daed.db` | 产品状态库 |
| `listen` | `0.0.0.0:2023` | REST API + Web UI；改 `127.0.0.1:2023` 则仅本机可管理 |
| `web_root` | `/usr/share/deer/web` | 面板静态文件；geodata 在其父目录 |
| `log_dir` | `/tmp/log/deer` | 产品日志目录 |
| `http_profile` | `low-memory` | HTTP worker 档位（low-memory / balanced / performance） |
| `api_only` | `0` | 仅控制面，不加载数据面 |
| `validate_start` | `1` | 启动前 `daed validate -c <config_dir>` |
| `validate_reload` | `1` | 重载前 `daed validate --runtime`，失败保留旧配置 |
| `hijack_resolv` | `0` | **默认关闭**：把 `/tmp/resolv.conf` 劫持到 daed DNS，配错会导致全机解析失败 |
| `respawn` / `term_timeout` / `nofile` / `nproc` | `1` / `10` / `1048576` / `512` | procd 进程参数 |

自启**不由 UCI `enabled` 控制**（这个选项刻意删掉了）：由 `/etc/rc.d/S95deer` 软链决定，
LuCI「开机自启」开关 = `/etc/init.d/deer enable|disable`。这样 LuCI 的「启动」按钮不会被
UCI 标志静默拦掉。

## LuCI 界面

- **控制**：运行状态 / 引擎版本 / 内存 / 运行时间；`dae active-datapath preflight`
  数据面体检（root、bpffs、kernel_feature_version、memlock、netns_permission 五项门禁 +
  tproxy 端口）；开机自启开关；启动 / 重启 / 停止；「面板」按钮直达 daed Web UI
- **设置**：上表 UCI 参数（保存并应用后自动重启已运行的服务）
- **日志**：产品日志（JSONL，解析成 `时间 等级 消息 key=value`）与系统日志（`logread -e deer`）
  双来源，支持过滤 / 暂停 / 倒序 / 清空

命令行等价操作：

```sh
/etc/init.d/deer start|stop|restart|reload|hot_reload|enable|disable
daed --version
daed validate -c /etc/deer --state /etc/deer/daed.db
daed reload --timeout 60s
dae active-datapath preflight        # 数据面体检（JSON）
dae validate -c /etc/deer/config.dae # 校验单个 .dae 文件
```

## 许可

打包脚本与 LuCI 界面：AGPL-3.0-only。上游 `daed` / `dae` 二进制来自
[qaz69s/DaeNext](https://github.com/qaz69s/DaeNext)（fork 自
[ksong008/DaeNext](https://github.com/ksong008/DaeNext)，AGPL-3.0-only）。
