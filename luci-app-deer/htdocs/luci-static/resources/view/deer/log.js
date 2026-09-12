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

var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function normalizeLevel(lv) {
	var l = String(lv || '').toLowerCase();
	if (l === 'warning') l = 'warn';
	if (l === 'notice' || l === 'informational') l = 'info';
	if (l === 'err' || l === 'fatal' || l === 'critical' || l === 'crit' || l === 'alert' || l === 'emerg')
		l = 'error';
	return LEVEL_CFG[l] ? l : 'info';
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function hhmmss(ts) {
	if (!ts) return '--:--:--';
	var m = String(ts).match(/(\d{2}:\d{2}:\d{2})/);
	return m ? m[1] : String(ts).replace('T', ' ').slice(0, 19);
}

/* ── 产品日志：真 JSONL，{"fields":{...},"id":N,"level":"info","message":"...","ts":"..."} ── */
function parseProductLine(raw) {
	var obj;
	try { obj = JSON.parse(raw); } catch (e) { obj = null; }
	if (!obj || typeof obj !== 'object') {
		return { time: hhmmss(raw), level: 'info', message: String(raw), fields: '', ms: 0, source: 'product' };
	}

	var fields = [];
	if (obj.fields && typeof obj.fields === 'object') {
		Object.keys(obj.fields).forEach(function (k) {
			var v = obj.fields[k];
			if (v === null || v === undefined || v === '') return;
			fields.push(k + '=' + (typeof v === 'object' ? JSON.stringify(v) : String(v)));
		});
	}

	var ms = Date.parse(obj.ts);
	return {
		time:    hhmmss(obj.ts),
		level:   normalizeLevel(obj.level),
		message: obj.message || '',
		fields:  fields.join('  '),
		ms:      isNaN(ms) ? 0 : ms,
		source:  'product',
	};
}

/* ── 系统日志：logread 行，Sat Sep 12 14:02:50 2026 daemon.err procd: message ── */
var SYSLOG_RE = /^(?:[A-Z][a-z]{2}\s+)?([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\d{4})\s+(\S+)\.(\S+)\s+([^:]+):\s?([\s\S]*)$/;

function parseSyslogLine(raw) {
	var line = String(raw);
	var m = SYSLOG_RE.exec(line);
	if (!m) {
		return { time: hhmmss(line), level: 'info', message: line, fields: '', ms: 0, source: 'syslog' };
	}

	var month = MONTHS[String(m[1]).toLowerCase()];
	var ms = Date.parse(m[4] + '-' + pad2((month === undefined ? 0 : month) + 1) + '-' + pad2(parseInt(m[2], 10)) + 'T' + m[3]);
	return {
		time:    m[3],
		level:   normalizeLevel(m[6]),
		message: String(m[7]).trim() + ': ' + m[8],
		fields:  '',
		ms:      isNaN(ms) ? 0 : ms,
		source:  'syslog',
	};
}

function toEntries(productRaw, syslogRaw) {
	var entries = [];
	String(productRaw || '').split('\n').forEach(function (l) {
		if (l.length) entries.push(parseProductLine(l));
	});
	String(syslogRaw || '').split('\n').forEach(function (l) {
		if (l.length) entries.push(parseSyslogLine(l));
	});
	return entries;
}

return baseclass.extend({
	render: function () {
		var paused       = false;
		var newestFirst  = true;
		var searchTerm   = '';
		var autoTimer    = null;
		var visible      = true;
		var lastEntries  = null;
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

		function renderEntries(entries) {
			var list = entries.slice();

			if (searchTerm) {
				var needle = searchTerm.toLowerCase();
				list = list.filter(function (e) {
					return (e.time + ' ' + e.message + ' ' + e.fields).toLowerCase().indexOf(needle) !== -1;
				});
			}
			list.sort(function (a, b) { return newestFirst ? (b.ms - a.ms) : (a.ms - b.ms); });

			while (body.firstChild) body.removeChild(body.firstChild);

			if (list.length === 0) {
				renderEmpty(_('（暂无日志）'));
				metaEl.textContent = '0 ' + _('行');
				return;
			}

			var frag = document.createDocumentFragment();
			var shown = 0;
			list.forEach(function (entry) {
				if (shown >= 400) return;
				shown++;

				var cfg = LEVEL_CFG[entry.level] || LEVEL_CFG.info;

				var timeEl = E('span', { style: 'color:var(--dy-dim);flex-shrink:0;' }, [entry.time || '']);

				var tag = E('span', { style: [
					'background:' + cfg.tagBg + ';color:#fff;',
					'border-radius:3px;padding:0 4px;font-size:10px;font-weight:700;',
					'flex-shrink:0;',
				].join('') }, [LEVEL_LABEL[entry.level] || 'I']);

				/* 系统日志行加一个很淡的来源标记，产品日志行维持原样 */
				var srcTag = (entry.source === 'syslog')
					? E('span', { style: 'color:var(--dy-dim);font-size:10px;flex-shrink:0;opacity:.8;' }, ['sys'])
					: null;

				var content = E('span', { style: 'white-space:pre-wrap;word-break:break-all;color:' + (cfg.color || 'inherit') });
				content.appendChild(document.createTextNode(entry.message));
				if (entry.fields) {
					content.appendChild(E('span', { style: 'color:var(--dy-muted);' }, ['  ' + entry.fields]));
				}

				var row = E('div', {
					style: 'display:flex;align-items:flex-start;gap:8px;padding:2px 4px;border-radius:3px;' +
						'border-bottom:1px solid var(--dy-log-divider);' +
						(cfg.rowBg ? 'background:' + cfg.rowBg + ';' : ''),
				}, [timeEl, tag, srcTag, content].filter(Boolean));

				frag.appendChild(row);
			});

			body.appendChild(frag);
			metaEl.textContent = shown + ' ' + _('行');
		}

		/* 两个来源并行取，合成一条时间线 */
		function fetchLog() {
			if (pendingFetch) return Promise.resolve();
			pendingFetch = true;
			return Promise.all([
				L.resolveDefault(getLog('product'), {}),
				L.resolveDefault(getLog('syslog'), {}),
			]).then(function (res) {
				pendingFetch = false;
				var product = res[0] || {};
				var syslog  = res[1] || {};
				var paths = [product.path, syslog.path].filter(Boolean);
				if (paths.length) pathEl.textContent = paths.join('   ·   ');

				lastEntries = toEntries(product.log, syslog.log);
				if (!paused) renderEntries(lastEntries);
			}, function (err) {
				pendingFetch = false;
				renderEmpty(_('读取日志失败：%s').format(err));
			});
		}

		var pauseBtn   = mkToolBtn(SVG_PAUSE, _('暂停自动刷新'));
		var sortBtn    = mkToolBtn(SVG_SORT_DESC, _('切换排序：倒序 / 正序'));
		var refreshBtn = mkToolBtn(SVG_REFRESH, _('立即刷新'));
		var trashBtn   = mkToolBtn(SVG_TRASH, _('清空产品日志（系统日志由 logd 环形缓存管理，无法清空）'));

		pauseBtn.addEventListener('click', function () {
			paused = !paused;
			pauseBtn.innerHTML = paused ? SVG_PLAY : SVG_PAUSE;
			pauseBtn.title = paused ? _('继续自动刷新') : _('暂停自动刷新');
			if (!paused && lastEntries !== null) renderEntries(lastEntries);
		});

		sortBtn.addEventListener('click', function () {
			newestFirst = !newestFirst;
			sortBtn.innerHTML = newestFirst ? SVG_SORT_DESC : SVG_SORT_ASC;
			if (lastEntries !== null) renderEntries(lastEntries);
		});

		refreshBtn.addEventListener('click', function () { fetchLog(); });

		trashBtn.addEventListener('click', function () {
			if (!confirm(_('确定清空产品日志（current.jsonl）？系统日志不受影响。'))) return;
			clearLogRpc().then(function (ok) {
				if (!ok) { ui.addNotification(null, E('p', {}, [_('清空失败（文件不存在或无权限）')]), 'warning'); return; }
				lastEntries = [];
				renderEntries([]);
			});
		});

		var searchEl = E('input', {
			type: 'text',
			class: 'dy-log-search',
			placeholder: _('过滤…'),
			style: [
				'padding:3px 8px;border-radius:4px;',
				'border:1px solid var(--dy-border);background:var(--dy-bg2);color:var(--dy-text);',
				'font-size:12px;font-family:inherit;min-width:120px;max-width:200px;',
			].join(''),
		});
		searchEl.addEventListener('input', function () {
			searchTerm = this.value.trim();
			if (lastEntries !== null) renderEntries(lastEntries);
		});

		var toolbar = E('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;' }, [
			pauseBtn, sortBtn, refreshBtn, trashBtn, searchEl,
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
