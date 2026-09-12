'use strict';
'require rpc';
'require baseclass';

var NAME = 'deer';

/* ── 操作按钮 SVG ── */
var SVG_PLAY    = '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" style="vertical-align:middle"><path d="M3 2.5l10 5.5-10 5.5V2.5z"/></svg>';
var SVG_RESTART = '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" style="vertical-align:middle"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>';
var SVG_STOP    = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle"><rect x="2.5" y="2.5" width="11" height="11" rx="1"/></svg>';
var SVG_PANEL   = '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" style="vertical-align:middle"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>';
var SVG_SPINNER = '<svg class="dy-spin" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle"><circle cx="8" cy="8" r="5.5" stroke-opacity=".18"/><path d="M8 2.5A5.5 5.5 0 0 1 13.5 8"/></svg>';

/* ── RPC ── */
var getInitStatus = rpc.declare({ object: 'luci.' + NAME, method: 'getInitStatus', params: ['name'] });
var setInitAction = rpc.declare({ object: 'luci.' + NAME, method: 'setInitAction', params: ['name', 'action'], expect: { result: false } });

return baseclass.extend({
	render: function () {

		/* ── 状态徽章 ── */
		var dot = E('span', { style: [
			'display:inline-block;width:7px;height:7px;border-radius:50%;',
			'background:#aaa;flex-shrink:0;transition:background .25s;',
		].join('') });
		var statusText  = E('span', { style: 'font-weight:600;font-size:12px;' }, [_('检测中…')]);
		var statusBadge = E('span', { style: [
			'display:inline-flex;align-items:center;gap:6px;',
			'padding:3px 10px;border-radius:20px;',
			'background:rgba(128,128,128,.12);transition:background .25s;',
		].join('') }, [dot, statusText]);

		/* ── 标题区 ── */
		var titleRow = E('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:3px;' }, [
			E('span', { style: 'font-size:20px;font-weight:700;color:var(--dy-title);' }, ['Deer']),
			statusBadge,
		]);
		var subtitle = E('div', { style: 'font-size:12px;font-weight:500;color:var(--dy-muted);margin-bottom:20px;' }, [
			_('基于 Rust eBPF 的高性能透明代理解决方案（DaeNext 引擎）。'),
		]);

		/* ── 指标格子 ── */
		var versionEl = E('div', { style: 'font-size:13px;font-weight:700;line-height:1.6;color:var(--dy-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;display:block;' }, ['—']);
		var memEl     = E('div', { style: 'font-size:13px;font-weight:700;color:#5cb85c;overflow-wrap:break-word;' }, ['—']);
		var uptimeEl  = E('div', { style: 'font-size:13px;font-weight:700;color:#5cb85c;overflow-wrap:break-word;' }, ['—']);

		var SVG_MEM_ICON    = '<svg viewBox="0 0 16 16" width="12" height="12" style="vertical-align:middle;margin-right:4px;display:inline-block;background:transparent !important"><rect x="2" y="3" width="12" height="10" rx="0.8" fill="none" stroke="currentColor" stroke-width="1"/><rect x="3" y="4" width="2.2" height="8" fill="currentColor"/><rect x="5.6" y="4.5" width="2.2" height="7.5" fill="currentColor" opacity=".8"/><rect x="8.2" y="5" width="2.2" height="7" fill="currentColor" opacity=".6"/></svg>';
		var SVG_UPTIME_ICON = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" style="vertical-align:middle;margin-right:4px;display:inline-block;background:transparent !important"><circle cx="8" cy="8" r="5"/><path d="M8 5v3l2 1.5" stroke-linejoin="round"/><circle cx="8" cy="3" r="0.5" fill="currentColor"/></svg>';
		var SVG_KERNEL_ICON = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style="vertical-align:middle;margin-right:4px;display:inline-block;background:transparent !important"><circle cx="8" cy="8" r="2.2"/><circle cx="8" cy="3" r="0.9"/><circle cx="12.5" cy="8" r="0.9"/><circle cx="8" cy="13" r="0.9"/><circle cx="3.5" cy="8" r="0.9"/><line x1="8.8" y1="5" x2="11.5" y2="6.8" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/><line x1="11.5" y1="9" x2="8.8" y2="11" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/><line x1="5" y1="11" x2="5" y2="9" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/><line x1="5" y1="5" x2="5" y2="7" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/></svg>';

		function mkMetric(label, valueEl, icon) {
			var labelWrap = E('div', { style: 'font-size:11px;font-weight:600;letter-spacing:.03em;color:var(--dy-muted);margin-bottom:6px;display:flex;align-items:center;' });
			if (icon) labelWrap.innerHTML = icon;
			labelWrap.appendChild(document.createTextNode(label));
			return E('div', { style: 'background:var(--dy-bg2);border:1px solid var(--dy-border);border-radius:5px;padding:12px 14px;min-width:0;' }, [
				labelWrap,
				valueEl,
			]);
		}
		var metrics = E('div', { class: 'dy-metrics' }, [
			mkMetric(_('内存占用'), memEl, SVG_MEM_ICON),
			mkMetric(_('运行时间'), uptimeEl, SVG_UPTIME_ICON),
			mkMetric(_('引擎版本'), versionEl, SVG_KERNEL_ICON),
		]);

		/* ── 分割线 ── */
		var divider = E('hr', { style: 'border:none;border-top:1px solid var(--dy-border);margin:0 0 16px;' });

		/* ── 服务区块（开机自启 = rc.d 软链） ── */
		var toggleThumb = E('span', { style: [
			'position:absolute;top:2px;left:2px;',
			'width:16px;height:16px;border-radius:50%;',
			'background:#fff;',
			'transition:left .18s cubic-bezier(.4,0,.2,1);',
			'box-shadow:0 1px 3px rgba(0,0,0,.28);',
		].join('') });

		var toggleTrack = E('span', { style: [
			'position:relative;display:inline-block;flex-shrink:0;',
			'width:36px;height:20px;border-radius:10px;',
			'background:rgba(128,128,128,.25);',
			'transition:background .18s;cursor:pointer;',
		].join('') }, [toggleThumb]);

		var _toggleOn = false;
		function setToggle(checked) {
			_toggleOn = checked;
			toggleTrack.style.background = checked ? '#27ae60' : 'rgba(128,128,128,.25)';
			toggleThumb.style.left       = checked ? '18px' : '2px';
		}

		toggleTrack.addEventListener('click', function () {
			var next = !_toggleOn;
			setToggle(next);
			setInitAction(NAME, next ? 'enable' : 'disable');
		});

		var serviceSection = E('div', { style: 'margin-bottom:16px;' }, [
			E('div', { style: 'font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--dy-muted);margin-bottom:8px;' }, [_('服务')]),
			E('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
				toggleTrack,
				E('span', { style: 'font-size:13px;cursor:pointer;user-select:none;' }, [_('开机自启')]),
			]),
		]);

		/* ── 状态控制 ── */
		var BTN_DEFS = [
			{ key: 'start',   svg: SVG_PLAY,    label: _('启动'), color: '#27ae60', hover: 'rgba(39,174,96,.10)'  },
			{ key: 'restart', svg: SVG_RESTART, label: _('重启'), color: '#2980b9', hover: 'rgba(41,128,185,.10)' },
			{ key: 'stop',    svg: SVG_STOP,    label: _('停止'), color: '#c0392b', hover: 'rgba(192,57,43,.10)'  },
			{ key: 'panel',   svg: SVG_PANEL,   label: _('面板'), color: '#8e44ad', hover: 'rgba(142,68,173,.10)' },
		];
		var buttons = {};
		var btnRow  = E('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' });

		BTN_DEFS.forEach(function (def) {
			var btn = E('button', {
				style: [
					'display:inline-flex;align-items:center;gap:6px;',
					'padding:7px 16px;border:1px solid ' + def.color + ';border-radius:5px;',
					'font-size:13px;font-family:inherit;font-weight:500;',
					'cursor:pointer;color:' + def.color + ';background:transparent;',
					'transition:background .15s,transform .1s,opacity .15s;opacity:.45;',
				].join(''),
				disabled: true,
			});
			btn._svg   = def.svg;
			btn._label = def.label;
			btn._hover = def.hover;
			btn.innerHTML = def.svg + ' ' + def.label;
			btn.addEventListener('mouseenter', function () { if (!btn.disabled) btn.style.background = def.hover; });
			btn.addEventListener('mouseleave', function () { btn.style.background = 'transparent'; });
			btn.addEventListener('mousedown',  function () { if (!btn.disabled) btn.style.transform = 'scale(.97)'; });
			btn.addEventListener('mouseup',    function () { btn.style.transform = ''; });
			buttons[def.key] = btn;
			btnRow.appendChild(btn);
		});

		var ctrlSection = E('div', {}, [
			E('div', { style: 'font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--dy-muted);margin-bottom:8px;' }, [_('状态控制')]),
			btnRow,
		]);

		var card = E('div', {}, [titleRow, subtitle, metrics, divider, serviceSection, ctrlSection]);

		/* ── Uptime ── */
		var uptimeTimer = null, uptimeAnchor = 0;
		function pad(n) { return n < 10 ? '0' + n : '' + n; }
		function fmtUptime() {
			var s   = Math.max(0, Math.floor((Date.now() - uptimeAnchor) / 1000));
			var y   = Math.floor(s / 31536000);
			var d   = Math.floor((s % 31536000) / 86400);
			var h   = Math.floor((s % 86400) / 3600);
			var m   = Math.floor((s % 3600) / 60);
			var sec = s % 60;
			var out = '';
			if (y) out += y + _('年') + ' ';
			if (d || y) out += d + _('天') + ' ';
			return out + pad(h) + ':' + pad(m) + ':' + pad(sec);
		}
		function startUptime(secs) {
			uptimeAnchor = Date.now() - (secs > 0 ? secs * 1000 : 0);
			uptimeEl.textContent = fmtUptime();
			if (uptimeTimer === null) uptimeTimer = setInterval(function () {
				if (!document.body.contains(card)) { clearInterval(uptimeTimer); uptimeTimer = null; return; }
				uptimeEl.textContent = fmtUptime();
			}, 1000);
		}
		function stopUptime() {
			clearInterval(uptimeTimer); uptimeTimer = null; uptimeEl.textContent = '—';
		}

		/* ── 面板跳转（daed Web UI，默认 :2023） ── */
		var panelTarget = { listen: '' };
		function openPanel() {
			var listen = (panelTarget.listen || '0.0.0.0:2023');
			var port   = listen.substring(listen.lastIndexOf(':') + 1) || '2023';
			var host   = window.location.hostname;
			setTimeout(function () { window.open('http://' + host + ':' + port + '/', '_blank'); }, 0);
		}

		/* ── 状态管理 ── */
		var lastRunning     = null;
		var actionInFlight  = false;
		var fastPollTimer   = null;
		var statusPending   = false;
		var lastActionTime  = 0;
		var ACTION_COOLDOWN = 1500;

		function applyButtonStates(running, installed) {
			if (actionInFlight) return;
			var dis = { start: running, restart: !running, stop: !running };
			Object.keys(buttons).forEach(function (k) {
				var b   = buttons[k];
				var off = (k === 'panel') ? !running : (!installed || dis[k]);
				b.disabled         = off;
				b.style.opacity    = off ? '.45' : '1';
				b.style.cursor     = off ? 'not-allowed' : 'pointer';
				b.style.background = 'transparent';
				b.innerHTML = b._svg + ' ' + b._label;
			});
		}
		function lockAllButtons() {
			Object.keys(buttons).forEach(function (k) {
				var b = buttons[k];
				b.disabled = true; b.style.opacity = '.45'; b.style.cursor = 'not-allowed';
			});
		}

		var BADGE = {
			running: { dot: '#62c462', bg: 'rgba(39,174,96,.16)',  text: _('运行中'),  color: '#62c462', anim: 'dy-blink 2s ease-in-out infinite' },
			stopped: { dot: '#e05c58', bg: 'rgba(192,57,43,.16)',  text: _('未运行'),  color: '#e87370', anim: 'none' },
			working: { dot: '#f0ad4e', bg: 'rgba(243,156,18,.14)', text: _('操作中…'), color: '#f0ad4e', anim: 'none' },
		};
		function setBadge(state) {
			var c = BADGE[state] || BADGE.stopped;
			dot.style.background         = c.dot;
			dot.style.animation          = c.anim;
			statusBadge.style.background = c.bg;
			statusText.textContent       = c.text;
			statusText.style.color       = c.color;
		}

		function applyStatus(data) {
			var st        = (data && data[NAME]) || {};
			var running   = !!st.running;
			var installed = !!st.installed;

			versionEl.textContent = st.version || _('未安装');
			versionEl.title       = st.version ? ('daed ' + st.version) : '';
			panelTarget.listen    = st.listen || '';

			setToggle(!!st.enabled);
			setBadge(running ? 'running' : 'stopped');
			if (running) {
				startUptime(typeof st.uptime === 'number' ? st.uptime : 0);
				memEl.textContent = (st.mem && String(st.mem) !== '0') ? st.mem + ' MB' : '—';
			} else {
				if (lastRunning !== false) { stopUptime(); memEl.textContent = '—'; }
			}
			lastRunning = running;
			applyButtonStates(running, installed);
		}

		function stopFastPoll() {
			if (fastPollTimer) { clearInterval(fastPollTimer); fastPollTimer = null; }
		}
		function waitForState(expectedRunning, timeoutMs) {
			stopFastPoll();
			var deadline = Date.now() + (timeoutMs || 10000);
			fastPollTimer = setInterval(function () {
				if (!document.body.contains(card)) { stopFastPoll(); return; }
				if (Date.now() > deadline) {
					stopFastPoll(); actionInFlight = false; lastActionTime = Date.now();
					L.resolveDefault(getInitStatus(NAME), {}).then(applyStatus);
					return;
				}
				L.resolveDefault(getInitStatus(NAME), {}).then(function (data) {
					var st = (data && data[NAME]) || {};
					if (!!st.running === expectedRunning) {
						stopFastPoll(); actionInFlight = false; lastActionTime = Date.now();
						// daed 启动后 RSS 会爬坡（读表 / 加载配置），单次读到的可能是低值。
						// 追赶轮询：每 1.5s 拉一次并立即渲染，直到读数稳定（连续两次差 <1MB）
						// 或拉满 6 次（9s）。
						var settleTries = 0, lastMem = null, settleTimer = null;
						settleTimer = setInterval(function () {
							if (!document.body.contains(card)) { clearInterval(settleTimer); return; }
							settleTries++;
							L.resolveDefault(getInitStatus(NAME), {}).then(function (data) {
								var st2 = (data && data[NAME]) || {};
								applyStatus(data);
								if (settleTries >= 6) { clearInterval(settleTimer); return; }
								var m = parseFloat(st2.mem);
								if (lastMem !== null && m > 0 && Math.abs(m - lastMem) < 1) {
									clearInterval(settleTimer);
								}
								lastMem = m;
							});
						}, 1500);
					}
				});
			}, 400);
		}

		function bindAction(key, action) {
			buttons[key].addEventListener('click', function () {
				if (actionInFlight) return;
				if (Date.now() - lastActionTime < ACTION_COOLDOWN) return;
				actionInFlight = true;
				stopFastPoll();
				lockAllButtons();
				buttons[key].innerHTML = SVG_SPINNER + ' ' + buttons[key]._label + '…';
				setBadge('working');
				setInitAction(NAME, action)
					.then(function (ok) {
						if (!ok) console.warn('[deer] action "' + action + '" returned false');
						if (action === 'restart') {
							var phase2done = false;
							fastPollTimer = setInterval(function () {
								if (phase2done) return;
								L.resolveDefault(getInitStatus(NAME), {}).then(function (data) {
									var st = (data && data[NAME]) || {};
									if (!st.running || phase2done) {
										stopFastPoll();
										if (!phase2done) { phase2done = true; waitForState(true, 12000); }
									}
								});
							}, 400);
							setTimeout(function () {
								if (!phase2done) { phase2done = true; stopFastPoll(); waitForState(true, 12000); }
							}, 5000);
						} else {
							waitForState(action === 'start', 12000);
						}
					})
					.catch(function (err) {
						console.error('[deer] RPC error:', err);
						actionInFlight = false; lastActionTime = Date.now();
						L.resolveDefault(getInitStatus(NAME), {}).then(applyStatus);
					});
			});
		}
		bindAction('start',   'start');
		bindAction('restart', 'restart');
		bindAction('stop',    'stop');
		buttons['panel'].addEventListener('click', openPanel);

		function refresh() {
			if (statusPending || actionInFlight) return;
			statusPending = true;
			return L.resolveDefault(getInitStatus(NAME), {}).then(function (data) {
				statusPending = false; applyStatus(data);
			}, function () { statusPending = false; });
		}
		refresh();

		// 自管理轮询：不依赖 LuCI poll 模块
		var autoTimer = setInterval(function () {
			if (!document.body.contains(card)) { clearInterval(autoTimer); return; }
			refresh();
		}, 3000);

		return card;
	},
});
