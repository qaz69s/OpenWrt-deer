'use strict';
'require form';
'require rpc';
'require ui';

var NAME = 'deer';

var setInitAction = rpc.declare({ object: 'luci.' + NAME, method: 'setInitAction', params: ['name', 'action'], expect: { result: false } });
var getInitStatus = rpc.declare({ object: 'luci.' + NAME, method: 'getInitStatus', params: ['name'] });

var SVG_SAVE = '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" style="vertical-align:middle"><path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.5L10.5 1H2zm8 0v3.5H13L10 1zM3 8h10v1H3V8zm0 3h7v1H3v-1z"/></svg>';
var SVG_SPINNER = '<svg class="dy-spin" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle"><circle cx="8" cy="8" r="5.5" stroke-opacity=".18"/><path d="M8 2.5A5.5 5.5 0 0 1 13.5 8"/></svg>';

return {
	render: function () {
		var m, s, o;

		/* ── 顶部说明（daed 的代理配置不在 UCI 里） ── */
		var note = E('div', { style: [
			'background:var(--dy-bg2);border:1px solid var(--dy-border);border-left:3px solid #8e44ad;',
			'border-radius:5px;padding:11px 14px;margin-bottom:18px;',
			'font-size:12px;line-height:1.8;color:var(--dy-text);',
		].join('') }, [
			E('div', { style: 'font-weight:600;margin-bottom:4px;color:var(--dy-title);' }, [_('代理配置在 daed 面板里')]),
			E('div', { style: 'color:var(--dy-muted);' }, [
				_('本节只配置 daed 的运行时参数。节点、订阅、路由规则、DNS 等代理配置请点「控制」页的「面板」按钮，在 daed Web UI 里配置（存储于 %s，SQLite 状态库）。').format('/etc/deer/daed.db'),
			]),
		]);

		/* ── 表单 ── */
		m = new form.Map('deer', _('Deer (daed) 运行时设置'),
			_('修改后需重启 daed 才生效；点击下方「保存并应用」会自动重启已运行的服务。'));

		s = m.section(form.NamedSection, 'main', 'deer', _('控制面'));

		o = s.option(form.Value, 'listen', _('监听地址'),
			_('REST API 与 Web UI 的监听地址:端口。默认 0.0.0.0:2023（局域网可访问）；'
			  + '仅本机管理可改为 127.0.0.1:2023。'));
		o.placeholder = '0.0.0.0:2023';
		o.rmempty = true;

		o = s.option(form.Value, 'config_dir', _('配置目录'),
			_('daed 的配置目录（同时存放 daed.db 与配置快照）。默认 /etc/deer。'));
		o.placeholder = '/etc/deer';
		o.rmempty = true;

		o = s.option(form.Value, 'state', _('状态库'),
			_('产品状态库路径。留空即 <配置目录>/daed.db。'));
		o.placeholder = '/etc/deer/daed.db';
		o.rmempty = true;

		o = s.option(form.Value, 'web_root', _('Web UI 目录'),
			_('daed 面板静态文件目录。geoip.dat / geosite.dat 必须位于它的父目录（/usr/share/deer/）。'));
		o.placeholder = '/usr/share/deer/web';
		o.rmempty = true;

		o = s.option(form.Value, 'log_dir', _('日志目录'),
			_('产品日志目录（current.jsonl，JSONL 格式）。/tmp 是 tmpfs，重启即清空。'));
		o.placeholder = '/tmp/log/deer';
		o.rmempty = true;

		o = s.option(form.ListValue, 'http_profile', _('HTTP 档位'),
			_('控制面 HTTP worker 的资源档位。路由器建议 low-memory。'));
		o.value('low-memory',   _('low-memory（低内存，推荐）'));
		o.value('balanced',     _('balanced（均衡）'));
		o.value('performance',  _('performance（性能）'));
		o.rmempty = true;

		o = s.option(form.Flag, 'api_only', _('仅控制面'),
			_('只跑 REST API / Web UI，不加载 eBPF 数据面（不接管流量）。调试用。'));
		o.default = '0';
		o.rmempty = false;

		s = m.section(form.NamedSection, 'main', 'deer', _('数据面与校验'));

		o = s.option(form.Flag, 'hijack_resolv', _('劫持 /tmp/resolv.conf'),
			_('把路由器自身的 DNS 解析指向 daed。⚠️ 默认关闭：daed 的 DNS 未配置正确时会导致全机解析失败（装包、更新都受影响）。'));
		o.default = '0';

		o = s.option(form.Flag, 'validate_start', _('启动前校验'),
			_('启动前执行 daed validate -c <配置目录>。新装空目录也能通过，建议保持开启。'));
		o.default = '1';

		o = s.option(form.Flag, 'validate_reload', _('重载前校验（--runtime）'),
			_('重载前执行 daed validate --runtime，失败则拒绝重载并保留旧配置。'));
		o.default = '1';

		s = m.section(form.NamedSection, 'main', 'deer', _('进程参数'));

		o = s.option(form.Flag, 'respawn', _('崩溃自动重启'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'term_timeout', _('停止超时（秒）'),
			_('procd 发送 TERM 后等待进程退出的秒数。daed 会清理 tc/eBPF 挂载点，建议不低于 10。'));
		o.datatype = 'uinteger';
		o.placeholder = '10';
		o.rmempty = true;

		o = s.option(form.Value, 'nofile', _('文件描述符上限'));
		o.datatype = 'uinteger';
		o.placeholder = '1048576';
		o.rmempty = true;

		o = s.option(form.Value, 'nproc', _('进程数上限'));
		o.datatype = 'uinteger';
		o.placeholder = '512';
		o.rmempty = true;

		/* ── 自定义动作按钮 ── */
		var statusEl = E('span', { style: 'font-size:12px;color:var(--dy-muted);' }, ['']);

		var saveBtn = E('button', { type: 'button', style: [
			'display:inline-flex;align-items:center;gap:6px;',
			'padding:7px 16px;border:none;border-radius:5px;cursor:pointer;',
			'background:#2980b9;color:#fff;font-size:13px;font-weight:500;font-family:inherit;',
			'transition:background .15s;',
		].join('') });
		saveBtn._label = _('保存并应用');
		saveBtn.innerHTML = SVG_SAVE + ' ' + saveBtn._label;
		saveBtn.addEventListener('mouseenter', function () { if (!saveBtn.disabled) saveBtn.style.background = '#2372a4'; });
		saveBtn.addEventListener('mouseleave', function () { if (!saveBtn.disabled) saveBtn.style.background = '#2980b9'; });

		saveBtn.addEventListener('click', function () {
			saveBtn.disabled = true;
			saveBtn.style.opacity = '.6';
			saveBtn.innerHTML = SVG_SPINNER + ' ' + saveBtn._label;
			statusEl.style.color = 'var(--dy-muted)';
			statusEl.textContent = _('保存中…');

			L.resolveDefault(m.parse(), false)
				.then(function (ok) {
					if (ok === false) throw new Error(_('表单校验失败'));
					return ui.changes.apply();
				})
				.then(function () {
					// 运行时参数变了 → 已运行的服务需要重启才生效
					return L.resolveDefault(getInitStatus(NAME), {}).then(function (data) {
						var st = (data && data[NAME]) || {};
						if (!st.running) return false;
						return L.resolveDefault(setInitAction(NAME, 'restart'), false);
					});
				})
				.then(function (restarted) {
					statusEl.style.color = '#5cb85c';
					statusEl.textContent = restarted ? _('✓ 已保存并重启服务') : _('✓ 已保存（服务未运行，未重启）');
					saveBtn.disabled = false;
					saveBtn.style.opacity = '1';
					saveBtn.innerHTML = SVG_SAVE + ' ' + saveBtn._label;
					setTimeout(function () { statusEl.textContent = ''; }, 4000);
				})
				.catch(function (err) {
					statusEl.style.color = '#e74c3c';
					statusEl.textContent = _('保存失败：%s').format(err);
					saveBtn.disabled = false;
					saveBtn.style.opacity = '1';
					saveBtn.innerHTML = SVG_SAVE + ' ' + saveBtn._label;
				});
		});

		var reloadBtn = E('button', { type: 'button', style: [
			'padding:7px 14px;border:1px solid var(--dy-border);border-radius:5px;cursor:pointer;',
			'background:transparent;color:var(--dy-muted);font-size:13px;font-family:inherit;',
		].join('') }, [_('放弃修改并重载')]);
		reloadBtn.addEventListener('click', function () { window.location.reload(); });

		var actions = E('div', { style: [
			'display:flex;align-items:center;gap:12px;flex-wrap:wrap;',
			'margin-top:16px;padding-top:14px;border-top:1px solid var(--dy-border);',
		].join('') }, [saveBtn, reloadBtn, statusEl]);

		var formEl = m.render();

		return E('div', {}, [note, formEl, actions]);
	},
};
