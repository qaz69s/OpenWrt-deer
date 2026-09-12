'use strict';
'require view';
'require view.deer.status';
'require view.deer.log';

/* ── View 主体：控制 / 日志 两个标签页 ── */
return view.extend({
	load: function () {
		return Promise.all([
			L.require('view.deer.status'),
			L.require('view.deer.log'),
		]);
	},

	render: function (mods) {
		var statusMod = mods[0];
		var logMod    = mods[1];

		/* 注入全局样式（仅一次） */
		if (!document.getElementById('deer-global-style')) {
			var s = document.createElement('style');
			s.id  = 'deer-global-style';
			s.textContent = [
				':root{',
				'--dy-bg:#2a2a2a;',
				'--dy-bg2:#333333;',
				'--dy-bg3:#3a3a3a;',
				'--dy-border:#444444;',
				'--dy-text:#e8e8e8;',
				'--dy-title:#ffffff;',
				'--dy-muted:#aaaaaa;',
				'--dy-dim:#666666;',
				'--dy-scroll-track:#2a2a2a;',
				'--dy-scroll-thumb:#555555;',
				'--dy-scroll-thumb-h:#777777;',
				'--dy-log-divider:rgba(255,255,255,.05);',
				'}',

				'@media(prefers-color-scheme:light){:root{',
				'--dy-bg:#ffffff;',
				'--dy-bg2:#f5f6f8;',
				'--dy-bg3:#eaecef;',
				'--dy-border:#d0d2d8;',
				'--dy-text:#1a1a1a;',
				'--dy-title:#000000;',
				'--dy-muted:#606268;',
				'--dy-dim:#909399;',
				'--dy-scroll-track:#f0f1f3;',
				'--dy-scroll-thumb:#c0c2c8;',
				'--dy-scroll-thumb-h:#a0a2a8;',
				'--dy-log-divider:rgba(0,0,0,.06);',
				'}}',

				'.dy-card{',
				'background:var(--dy-bg);border:1px solid var(--dy-border);',
				'border-radius:8px;padding:20px;color:var(--dy-text);',
				'font-weight:450;',
				'}',

				'.dy-nav{display:flex;position:relative;margin-bottom:20px;overflow-x:auto;overflow-y:visible;-webkit-overflow-scrolling:touch;scrollbar-width:none;}',
				'.dy-nav::-webkit-scrollbar{display:none;}',
				'.dy-nav::after{content:"";position:absolute;bottom:0;left:0;right:0;height:2px;background:rgba(128,128,128,.18);pointer-events:none;}',

				'.dy-tab{',
				'padding:10px 16px !important;',
				'border:none !important;border-top:none !important;border-left:none !important;',
				'border-right:none !important;border-bottom:2px solid transparent !important;',
				'border-radius:0 !important;',
				'background:none !important;background-color:transparent !important;',
				'box-shadow:none !important;outline:none !important;',
				'cursor:pointer !important;',
				'font-size:14px !important;font-family:inherit !important;',
				'color:var(--dy-text) !important;opacity:.55;font-weight:600;',
				'white-space:nowrap;flex-shrink:0;position:relative;z-index:1;',
				'-webkit-tap-highlight-color:transparent;',
				'transition:opacity .15s,border-color .15s;}',

				'.dy-tab:focus{outline:none !important;box-shadow:none !important;}',
				'.dy-tab:hover{opacity:.8 !important;border-bottom-color:transparent !important;background:none !important;background-color:transparent !important;}',

				'.dy-tab.dy-active{',
				'opacity:1 !important;',
				'color:#5cb85c !important;',
				'border-bottom:2px solid #5cb85c !important;',
				'background:none !important;background-color:transparent !important;',
				'box-shadow:none !important;}',

				'@keyframes dy-spin{to{transform:rotate(360deg)}}',
				'.dy-spin{display:inline-block;animation:dy-spin .65s linear infinite;}',
				'@keyframes dy-blink{0%,100%{opacity:1}50%{opacity:.35}}',
				'@keyframes dy-pulse{0%,100%{opacity:1}50%{opacity:.4}}',
				'.dy-lat-loading{animation:dy-pulse 1s ease-in-out infinite;}',

				'.dy-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;}',
				'@media(max-width:640px){.dy-metrics{grid-template-columns:1fr 1fr !important;}}',
				'@media(max-width:480px){.dy-card{padding:12px;} .dy-nav{margin-bottom:12px;} .dy-tab{padding:9px 12px !important;font-size:13px !important;}}',

				'.dy-log-body::-webkit-scrollbar{width:7px;height:7px;}',
				'.dy-log-body::-webkit-scrollbar-track{background:var(--dy-bg2);border-radius:4px;}',
				'.dy-log-body::-webkit-scrollbar-thumb{background:var(--dy-scroll-thumb);border-radius:4px;}',
				'.dy-log-body::-webkit-scrollbar-thumb:hover{background:var(--dy-scroll-thumb-h);}',
				'.dy-log-body::-webkit-scrollbar-corner{background:var(--dy-bg2);}',
				'.dy-log-search::placeholder{color:var(--dy-dim);}',
			].join('');
			document.head.appendChild(s);
		}

		var tabs = [
			{ label: _('控制'), fn: function () { return statusMod.render(); } },
			{ label: _('日志'), fn: function () { return logMod.render(); }, lazy: true, isLog: true },
		];

		var navBtns   = [];
		var tabPanels = [];
		var logPanel  = null;

		tabs.forEach(function (t, i) {
			var isFirst = (i === 0);
			var ready   = !t.lazy;
			var panel   = E('div', { style: 'display:' + (isFirst ? 'block' : 'none') + ';' },
				(isFirst || !t.lazy) ? [t.fn()] : []);

			if (t.isLog && !t.lazy) logPanel = panel.firstChild || null;

			var btn = E('button', { class: 'dy-tab' + (isFirst ? ' dy-active' : '') }, [t.label]);

			btn.addEventListener('click', function () {
				if (logPanel && logPanel._setVisible) logPanel._setVisible(false);

				navBtns.forEach(function (b)  { b.classList.remove('dy-active'); });
				tabPanels.forEach(function (p) { p.style.display = 'none'; });
				btn.classList.add('dy-active');
				panel.style.display = 'block';

				if (!ready) {
					ready = true;
					var node = t.fn();
					if (node) {
						panel.appendChild(node);
						if (t.isLog) logPanel = node;
					}
				}

				if (t.isLog && logPanel && logPanel._setVisible) logPanel._setVisible(true);
			});

			navBtns.push(btn);
			tabPanels.push(panel);
		});

		return E('div', { class: 'dy-card' }, [
			E('div', { class: 'dy-nav' }, navBtns),
			E('div', {}, tabPanels),
		]);
	},
});
