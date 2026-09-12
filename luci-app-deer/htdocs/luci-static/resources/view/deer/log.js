'use strict';
'require rpc';
'require ui';
'require baseclass';

var NAME = 'deer';

var getLog      = rpc.declare({ object: 'luci.' + NAME, method: 'getLog', params: ['source'] });
var clearLogRpc = rpc.declare({ object: 'luci.' + NAME, method: 'clearLog', expect: { result: false } });

var SVG_PAUSE     = '<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx=".5"/><rect x="9.5" y="2" width="3.5" height="12" rx=".5"/></svg>';
var SVG_PLAY      = '<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M3 2.5l10 5.5-10 5.5V2.5z"/></svg>';
var SVG_SORT_DESC = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="12" x2="6" y2="12"/></svg>';
var SVG_SORT_ASC  = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="4" x2="6" y2="4"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>';
var SVG_TRASH     = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 4 3.5 4 14 4"/><path d="M13 4l-.867 9.5H3.867L3 4"/><path d="M6.5 7v5m3-5v5"/><path d="M5.5 4V3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v1"/></svg>';
var SVG_REFRESH   = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/><polyline points="13.6 1.8 13.6 4.6 10.8 4.6"/></svg>';

var LEVEL_CFG = {
	error: { tagBg: '#c0392b', rowBg: 'rgba(192,57,43,.09)',  color: '#e87370' },
	warn:  { tagBg: '#e67e22', rowBg: 'rgba(230,126,34,.09)', color: '#e8a13c' },
	info:  { tagBg: '#2980b9', rowBg: '',                     color: '' },
	debug: { tagBg: '#7f8c8d', rowBg: '',                     color: 'var(--dy-dim)' },
	trace: { tagBg: '#5a6268', rowBg: '',                     color: 'var(--dy-dim)' },
};
var LEVEL_LABEL = { error: 'E', warn: 'W', info: 'I', debug: 'D', trace: 'T' };

function normalizeLevel(lv) {
	var l = String(lv || '').toLowerCase();
	if (l === 'warning') l = 'warn';
	if (l === 'err' || l === 'fatal' || l === 'critical') l = 'error';
	return LEVEL_CFG[l] ? l : 'info';
}

function hhmmss(ts) {
	if (!ts) return '--:--:--';
	var m = String(ts).match(/(\d{2}:\d{2}:\d{2})/);
	return m ? m[1] : String(ts).replace('T', ' ').slice(0, 19);
}

/* daed 产品日志是真 JSONL：{"fields":{...},"id":N,"level":"info","message":"...","ts":"..."} */
function parseJsonlLine(raw) {
	var obj;
	try { obj = JSON.parse(raw); } catch (e) { return { raw: raw }; }
	if (!obj || typeof obj !== 'object') return { raw: raw };

	var fields = [];
	if (obj.fields && typeof obj.fields === 'object') {
		Object.keys(obj.fields).forEach(function (k) {
			var v = obj.fields[k];
			if (v === null || v === undefined || v === '') return;
			fields.push(k + '=' + (typeof v === 'object' ? JSON.stringify(v) : String(v)));
		});
	}

	return {
		time:    hhmmss(obj.ts),
		level:   normalizeLevel(obj.level),
		message: obj.message || '',
		fields:  fields.join('  '),
		id:      obj.id,
	};
}

return baseclass.extend({
	render: function () {
		var source       = 'product';
		var paused       = false;
		var newestFirst  = true;
		var searchTerm   = '';
		var autoTimer    = null;
		var visible      = true;
		var lastRaw      = null;
		var pendingFetch = false;

		var body = E('div', { class: 'dy-log-body', style: [
			'background:var(--dy-bg2);border:1px solid var(--dy-border);border-radius:5px;',
			'padding:8px 10px;height:calc(100vh - 320px);min-height:320px;overflow:auto;',
			'font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;',
			'font-size:12px;line-height:1.75;',
			'scrollbar-width:thin;',
			'scrollbar-color:var(--dy-scroll-thumb) var(--dy-scroll-track);',
		].join('') }, [
			E('div', { style: 'color:var(--dy-dim);' }, [_('加载中…')]),
		]);

		var pathEl = E('span', { style: 'font-size:11px;color:var(--dy-dim);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, ['—']);
		var metaEl = E('span', { style: 'font-size:11px;color:var(--dy-muted);flex-shrink:0;' }, ['']);

		function mkToolBtn(svg, title) {
			var b = E('button', { type: 'button', title: title, style: [
				'display:inline-flex;align-items:center;justify-content:center;',
				'padding:3px 7px;border-radius:4px;cursor:pointer;',
				'border:1px solid var(--dy-border);background:transparent;color:var(--dy-muted);',
				'line-height:1;transition:background .12s,color .12s;',
			].join('') });
			b._svg = svg;
			b.innerHTML = svg;
			b.addEventListener('mouseenter', function () { b.style.background = 'rgba(128,128,128,.12)'; b.style.color = 'var(--dy-text)'; });
			b.addEventListener('mouseleave', function () { b.style.background = 'transparent'; b.style.color = 'var(--dy-muted)'; });
			return b;
		}

		function renderEmpty(msg) {
			while (body.firstChild) body.removeChild(body.firstChild);
			body.appendChild(E('div', { style: 'color:var(--dy-dim);' }, [msg]));
		}

		function renderLines(raw) {
			var lines = String(raw || '').split('\n').filter(function (l) { return l.length > 0; });

			if (searchTerm) {
				var needle = searchTerm.toLowerCase();
				lines = lines.filter(function (l) { return l.toLowerCase().indexOf(needle) !== -1; });
			}
			if (newestFirst) lines = lines.slice().reverse();

			while (body.firstChild) body.removeChild(body.firstChild);

			if (lines.length === 0) {
				renderEmpty(_('（暂无日志）'));
				metaEl.textContent = '0 ' + _('行');
				return;
			}

			var frag = document.createDocumentFragment();
			var shown = 0;
			lines.forEach(function (raw2) {
				if (shown >= 400) return;
				shown++;

				var parsed = (source === 'product') ? parseJsonlLine(raw2) : { raw: raw2 };
				var cfg    = LEVEL_CFG[parsed.level] || LEVEL_CFG.info;

				var timeEl = E('span', { style: 'color:var(--dy-dim);flex-shrink:0;' }, [parsed.time || '']);
				var tag    = null;
				if (parsed.level) {
					tag = E('span', { style: [
						'background:' + cfg.tagBg + ';color:#fff;',
						'border-radius:3px;padding:0 4px;font-size:10px;font-weight:700;',
						'flex-shrink:0;margin-right:6px;',
					].join('') }, [LEVEL_LABEL[parsed.level] || 'I']);
				}

				var content;
				if (parsed.raw !== undefined) {
					content = E('span', { style: 'white-space:pre-wrap;word-break:break-all;' }, [parsed.raw]);
				} else {
					content = E('span', { style: 'white-space:pre-wrap;word-break:break-all;color:' + (cfg.color || 'inherit') });
					content.appendChild(document.createTextNode(parsed.message));
					if (parsed.fields) {
						content.appendChild(E('span', { style: 'color:var(--dy-muted);' }, ['  ' + parsed.fields]));
					}
				}

				var row = E('div', {
					style: 'display:flex;align-items:flex-start;gap:8px;padding:2px 4px;border-radius:3px;' +
						'border-bottom:1px solid var(--dy-log-divider);' +
						(cfg.rowBg ? 'background:' + cfg.rowBg + ';' : ''),
				}, [timeEl, tag, content].filter(Boolean));

				frag.appendChild(row);
			});

			body.appendChild(frag);
			metaEl.textContent = shown + ' ' + _('行');
		}

		function fetchLog() {
			if (pendingFetch) return Promise.resolve();
			pendingFetch = true;
			return L.resolveDefault(getLog(source), {}).then(function (data) {
				pendingFetch = false;
				if (data && data.path) pathEl.textContent = data.path;
				var raw = (data && data.log) || '';
				if (paused) { lastRaw = raw; return; }
				lastRaw = raw;
				renderLines(raw);
			}, function (err) {
				pendingFetch = false;
				renderEmpty(_('读取日志失败：%s').format(err));
			});
		}

		/* ── 工具条 ── */
		var srcLabel = E('span', { style: 'font-size:12px;color:var(--dy-muted);' }, [_('来源')]);
		var srcSel = E('select', { style: [
			'padding:3px 6px;border-radius:4px;border:1px solid var(--dy-border);',
			'background:var(--dy-bg2);color:var(--dy-text);font-size:12px;font-family:inherit;',
		].join('') }, [
			E('option', { value: 'product' }, [_('产品日志 (JSONL)')]),
			E('option', { value: 'syslog' },  [_('系统日志 (logread)')]),
		]);
		srcSel.addEventListener('change', function () {
			source = srcSel.value;
			body.innerHTML = '';
			body.appendChild(E('div', { style: 'color:var(--dy-dim);' }, [_('加载中…')]));
			fetchLog();
		});

		var pauseBtn   = mkToolBtn(SVG_PAUSE, _('暂停自动刷新'));
		var sortBtn    = mkToolBtn(SVG_SORT_DESC, _('切换排序：倒序 / 正序'));
		var refreshBtn = mkToolBtn(SVG_REFRESH, _('立即刷新'));
		var trashBtn   = mkToolBtn(SVG_TRASH, _('清空产品日志')); 

		pauseBtn.addEventListener('click', function () {
			paused = !paused;
			pauseBtn.innerHTML = paused ? SVG_PLAY : SVG_PAUSE;
			pauseBtn.title = paused ? _('继续自动刷新') : _('暂停自动刷新');
			if (!paused && lastRaw !== null) renderLines(lastRaw);
		});

		sortBtn.addEventListener('click', function () {
			newestFirst = !newestFirst;
			sortBtn.innerHTML = newestFirst ? SVG_SORT_DESC : SVG_SORT_ASC;
			if (lastRaw !== null) renderLines(lastRaw);
		});

		refreshBtn.addEventListener('click', function () { fetchLog(); });

		trashBtn.addEventListener('click', function () {
			if (!confirm(_('确定清空产品日志（current.jsonl）？'))) return;
			clearLogRpc().then(function (ok) {
				if (!ok) { ui.addNotification(null, E('p', {}, [_('清空失败（文件不存在或无权限）')]), 'warning'); return; }
				lastRaw = '';
				renderLines('');
			});
		});

		var searchEl = E('input', {
			type: 'text',
			class: 'dy-log-search',
			placeholder: _('过滤…'),
			style: [
				'margin-left:auto;padding:3px 8px;border-radius:4px;',
				'border:1px solid var(--dy-border);background:var(--dy-bg2);color:var(--dy-text);',
				'font-size:12px;font-family:inherit;min-width:120px;max-width:200px;',
			].join(''),
		});
		searchEl.addEventListener('input', function () {
			searchTerm = this.value.trim();
			if (lastRaw !== null) renderLines(lastRaw);
		});

		var toolbar = E('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;' }, [
			srcLabel, srcSel, pauseBtn, sortBtn, refreshBtn, trashBtn, searchEl,
			E('div', { style: 'width:100%;display:flex;align-items:center;gap:10px;' }, [pathEl, metaEl]),
		]);

		var panel = E('div', {}, [toolbar, body]);

		/* ── 自动刷新（仅在本标签可见时跑） ── */
		function startTimer() {
			if (autoTimer !== null) return;
			autoTimer = setInterval(function () {
				if (!document.body.contains(panel)) { clearInterval(autoTimer); autoTimer = null; return; }
				if (!visible || paused) return;
				fetchLog();
			}, 2000);
		}
		function stopTimer() {
			if (autoTimer !== null) { clearInterval(autoTimer); autoTimer = null; }
		}

		panel._setVisible = function (v) {
			visible = !!v;
			if (visible) { fetchLog(); startTimer(); }
			else stopTimer();
		};

		fetchLog();
		startTimer();

		return panel;
	},
});
