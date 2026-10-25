/* ============================================================
   GeekTool 站点 · 全局换肤（唯一实现）
   用法：<link rel="stylesheet" href="assets/theme.css">
        <script src="assets/theme.js"></script>   ← 放在 <head> 里同步加载，避免首屏闪烁
   槽位：任意位置放 <div data-theme-switcher></div> 即内联渲染色板；
        没有槽位的页面自动在右下角出现浮动换肤钮（<html data-theme-ui="none"> 可关闭）
   接口：window.GeekTheme.presets / .set(id|hex) / .set('custom', '#rrggbb') / .get()
        window.setTheme  ← 兼容旧调用
   ============================================================ */
(function () {
    'use strict';

    var LS_THEME = 'preferred_theme';
    var LS_CUSTOM = 'custom_theme_color';
    var LS_PRIMARY = 'current_primary_color';
    var LS_NAME = 'current_theme_name';
    var LS_MODE = 'preferred_mode';
    var LS_LG = 'preferred_liquid_glass';

    /* 预设：green/blue 的 accent、secondary、muted 沿用仓库里既有的手调值；
       其余 4 个预设由同一套关系式（accent=hsl(h,75%,82%) …）推导，保证色系一致 */
    var PRESETS = [
        { id: 'green', name: '🌿 绿', dot: '#00e5b0', primary: '#00e5b0', dark: '#00b894', light: '#55efc4', rgb: '0, 255, 200', accent: '#b0f0e0', secondary: '#6a8e8a', muted: '#4a7a7a' },
        { id: 'blue', name: '💠 蓝', dot: '#3b6eff', primary: '#3b6eff', dark: '#2952d0', light: '#7aa2ff', rgb: '59, 110, 255', accent: '#b0caf5', secondary: '#6a7f9e', muted: '#4a5f7a' },
        { id: 'purple', name: '🟣 紫', dot: '#a855f7', primary: '#a855f7', dark: '#7c3aed', light: '#c084fc', rgb: '168, 85, 247', accent: '#d2aff4', secondary: '#806996', muted: '#614979' },
        { id: 'orange', name: '🟠 橙', dot: '#f97316', primary: '#f97316', dark: '#ea580c', light: '#fb923c', rgb: '249, 115, 22', accent: '#f4cbaf', secondary: '#967b69', muted: '#795d49' },
        { id: 'pink', name: '🩷 粉', dot: '#ec4899', primary: '#ec4899', dark: '#db2777', light: '#f472b6', rgb: '236, 72, 153', accent: '#f4afd1', secondary: '#96697f', muted: '#794961' },
        { id: 'cyan', name: '🩵 青', dot: '#06b6d4', primary: '#06b6d4', dark: '#0891b2', light: '#22d3ee', rgb: '6, 182, 212', accent: '#afe9f4', secondary: '#699096', muted: '#497279' }
    ];

    var current = { id: 'green', name: '🌿 绿', primary: '#00e5b0' };
    var colorsCache = { primary: '#00e5b0', dark: '#00b894', light: '#55efc4', rgb: '0, 255, 200' };
    var lastTheme = PRESETS[0];   // 最近一次完整应用的主题对象，切模式时重算变量用
    var mode = 'dark';            // 'dark' | 'light'
    var switches = [];   // 已挂载的色板，用于同步选中态
    var lgPending = null;   // 液态玻璃鼠标高光的 rAF 节流句柄
    var lgOn = true;        // 液态玻璃总开关

    /* ---------- 颜色工具 ---------- */
    function hexToRgb(hex) {
        var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
        if (!m) return null;
        var h = m[1];
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), hex: '#' + h.toLowerCase() };
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h, s, l = (mx + mn) / 2;
        if (mx === mn) { h = s = 0; }
        else {
            var d = mx - mn;
            s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
            if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (mx === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    function hslToHex(h, s, l) {
        h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
        var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        return '#' + [r, g, b].map(function (v) {
            return Math.round((v + m) * 255).toString(16).padStart(2, '0');
        }).join('');
    }

    /* 自定义颜色 → 完整色系（关系式与预设一致） */
    function customTheme(hex) {
        var c = hexToRgb(hex);
        if (!c) return PRESETS[0];
        var hsl = rgbToHsl(c.r, c.g, c.b);
        return {
            id: 'custom',
            name: '🎨 自定义',
            dot: c.hex,
            primary: c.hex,
            dark: hslToHex(hsl.h, Math.min(hsl.s, 95), Math.max(hsl.l * 0.78, 22)),
            light: hslToHex(hsl.h, hsl.s * 0.8, Math.min(hsl.l * 1.3, 72)),
            rgb: c.r + ', ' + c.g + ', ' + c.b,
            accent: hslToHex(hsl.h, 75, 82),
            secondary: hslToHex(hsl.h, 18, 50),
            muted: hslToHex(hsl.h, 25, 38)
        };
    }

    /* 标签页图标跟着主题走；没 JS 时 <link href="favicon.svg"> 是兜底 */
    function paintIcon(color) {
        var links = document.querySelectorAll('link[data-theme-icon]');
        if (!links.length) return;
        var c = encodeURIComponent(color);
        // 显式写 width/height：部分浏览器（如 Safari）对没有固有尺寸的 SVG 图标会不渲染
        var svg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' width='64' height='64'%3E" +
            "%3Crect x='1' y='1' width='62' height='62' rx='15' fill='%230b0d12' stroke='" + c + "' stroke-opacity='.35' stroke-width='2'/%3E" +
            "%3Cpath d='M17 21 L29 32 L17 43' fill='none' stroke='" + c + "' stroke-width='6.5' stroke-linecap='round' stroke-linejoin='round'/%3E" +
            "%3Cpath d='M35 46 L49 46' fill='none' stroke='" + c + "' stroke-width='6.5' stroke-linecap='round'/%3E%3C/svg%3E";
        Array.prototype.forEach.call(links, function (l) {
            if (l.getAttribute('href') !== svg) l.setAttribute('href', svg);
        });
    }

    /* ---------- 应用主题 ---------- */
    function varsOf(t, m) {
        var light = m === 'light';
        var hue = { h: 165, s: 100 };
        var c = hexToRgb(t.primary);
        if (c) hue = rgbToHsl(c.r, c.g, c.b);
        /* 白天模式下背景翻亮，原本为深底手调的浅色文字必须换成深色变体才可读 */
        var text = light ? {
            accent: hslToHex(hue.h, Math.min(hue.s, 70), 30),
            secondary: hslToHex(hue.h, 14, 36),
            muted: hslToHex(hue.h, 18, 48)
        } : {
            accent: t.accent,
            secondary: t.secondary,
            muted: t.muted
        };
        return {
            '--primary': t.primary,
            '--primary-dark': t.dark,
            /* primary-light 在页面里多作文字用，白天模式下压暗保证对比度 */
            '--primary-light': light ? hslToHex(hue.h, Math.min(hue.s * 0.9, 90), 38) : t.light,
            '--primary-rgb': t.rgb,
            '--primary-glow': 'rgba(' + t.rgb + ', ' + (light ? '0.18' : '0.25') + ')',
            '--primary-border': 'rgba(' + t.rgb + ', ' + (light ? '0.22' : '0.12') + ')',
            '--primary-border-hover': 'rgba(' + t.rgb + ', ' + (light ? '0.42' : '0.25') + ')',
            '--border-color': 'rgba(' + t.rgb + ', ' + (light ? '0.16' : '0.08') + ')',
            '--text-accent': text.accent,
            '--text-secondary': text.secondary,
            '--text-muted': text.muted
        };
    }

    function applyTheme(t, persist) {
        var root = document.documentElement;
        lastTheme = t;
        var vars = varsOf(t, mode);
        for (var k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) root.style.setProperty(k, vars[k]);
        root.setAttribute('data-theme', t.id);
        current = { id: t.id, name: t.name, primary: t.primary };
        colorsCache = { primary: t.primary, dark: t.dark, light: t.light, rgb: t.rgb };
        paintIcon(t.primary);
        try {
            document.dispatchEvent(new CustomEvent('geekthemechange', { detail: colorsCache }));
        } catch (e) { /* 老浏览器忽略 */ }

        if (persist) {
            try {
                if (t.id === 'custom') {
                    localStorage.setItem(LS_THEME, 'custom');
                    localStorage.setItem(LS_CUSTOM, t.primary);
                } else {
                    localStorage.setItem(LS_THEME, t.id);
                    localStorage.removeItem(LS_CUSTOM);
                }
                localStorage.setItem(LS_PRIMARY, t.primary);
                localStorage.setItem(LS_NAME, t.name);
            } catch (e) { /* 隐私模式下忽略 */ }
        }
        syncUI();
        return t;
    }

    function preset(id) {
        for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
        return null;
    }

    /* ---------- 白天 / 黑夜模式 ---------- */
    /* 读取已保存的模式；没选过则跟随系统 */
    function resolveMode() {
        try {
            var m = localStorage.getItem(LS_MODE);
            if (m === 'light' || m === 'dark') return m;
        } catch (e) { /* 隐私模式下忽略 */ }
        try {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
        } catch (e) { /* 老浏览器忽略 */ }
        return 'dark';
    }

    function applyMode(m, persist) {
        mode = m === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-mode', mode);
        /* 背景之外，文本/边框族变量也随模式重算 */
        applyTheme(lastTheme, false);
        if (persist) {
            try { localStorage.setItem(LS_MODE, mode); } catch (e) { /* 隐私模式下忽略 */ }
        }
        syncUI();
    }

    function toggleMode() {
        applyMode(mode === 'light' ? 'dark' : 'light', true);
    }

    /* ---------- 液态玻璃开关 ---------- */
    /* 优先级：用户点过的记忆 > 页面静态声明（<html data-lg="off">）> 默认开 */
    function resolveLg() {
        try {
            var s = localStorage.getItem(LS_LG);
            if (s === 'on' || s === 'off') return s;
        } catch (e) { /* 隐私模式下忽略 */ }
        return document.documentElement.getAttribute('data-lg') === 'off' ? 'off' : 'on';
    }

    function applyLg(state, persist) {
        lgOn = state !== 'off';
        document.documentElement.setAttribute('data-lg', lgOn ? 'on' : 'off');
        if (persist) {
            try { localStorage.setItem(LS_LG, lgOn ? 'on' : 'off'); } catch (e) { /* 隐私模式下忽略 */ }
        }
        syncUI();
    }

    function toggleLg() {
        applyLg(lgOn ? 'off' : 'on', true);
    }

    /* 读取已保存的主题（兼容历史键值与旧页面写过的格式） */
    function resolveSaved() {
        var id, custom, savedPrimary;
        try {
            id = localStorage.getItem(LS_THEME);
            custom = localStorage.getItem(LS_CUSTOM);
            savedPrimary = localStorage.getItem(LS_PRIMARY);
        } catch (e) { return PRESETS[0]; }

        if (id === 'custom') {
            var hex = custom || savedPrimary;
            if (hex && hexToRgb(hex)) return customTheme(hex);
        }
        if (id && preset(id)) return preset(id);
        // 旧版 index.html 只存过 hex（preferred_theme 被写成颜色，或仅剩 current_primary_color）
        if (hexToRgb(id || '')) return customTheme(id);
        if (savedPrimary && hexToRgb(savedPrimary)) return customTheme(savedPrimary);
        return PRESETS[0];
    }

    /* ---------- 色板 UI ---------- */
    function buildModeBtn() {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'gt-mode';
        b.addEventListener('click', function () { toggleMode(); });
        return b;
    }

    function buildLgBtn() {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'gt-lg';
        b.textContent = '💧';
        b.addEventListener('click', function () { toggleLg(); });
        return b;
    }

    function buildSwitch() {
        var wrap = document.createElement('div');
        wrap.className = 'gt-switch';
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', '主题配色');

        wrap.appendChild(buildModeBtn());
        wrap.appendChild(buildLgBtn());
        PRESETS.forEach(function (p) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'gt-dot';
            b.setAttribute('data-gt-preset', p.id);
            b.setAttribute('aria-label', p.name.replace(/^\S+\s*/, '') + '主题');
            b.title = p.name;
            b.style.setProperty('--gt-dot-color', p.dot);
            b.addEventListener('click', function () { set(p.id); });
            wrap.appendChild(b);
        });

        var lab = document.createElement('label');
        lab.className = 'gt-picker-wrap';
        lab.title = '自定义颜色';
        var input = document.createElement('input');
        input.type = 'color';
        input.className = 'gt-picker';
        input.addEventListener('input', function () { set('custom', input.value); });
        lab.appendChild(input);
        wrap.appendChild(lab);

        var text = document.createElement('span');
        text.className = 'gt-label';
        wrap.appendChild(text);

        switches.push(wrap);
        return wrap;
    }

    function buildDock() {
        var dock = document.createElement('div');
        dock.className = 'gt-dock';
        var fab = document.createElement('button');
        fab.type = 'button';
        fab.className = 'gt-fab';
        fab.title = '切换主题配色';
        fab.setAttribute('aria-label', '切换主题配色');
        fab.appendChild(document.createElement('span'));
        fab.addEventListener('click', function (e) {
            e.stopPropagation();
            dock.classList.toggle('open');
        });
        dock.appendChild(fab);
        dock.appendChild(buildSwitch());
        document.body.appendChild(dock);

        document.addEventListener('click', function (e) {
            if (!dock.contains(e.target)) dock.classList.remove('open');
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') dock.classList.remove('open');
        });
        return dock;
    }

    /* 紧凑形态：窄容器（游戏卡片等）里只占一个圆钮，点开弹出色板 */
    function buildPop() {
        var pop = document.createElement('div');
        pop.className = 'gt-pop';
        var fab = document.createElement('button');
        fab.type = 'button';
        fab.className = 'gt-fab';
        fab.title = '切换主题配色';
        fab.setAttribute('aria-label', '切换主题配色');
        fab.appendChild(document.createElement('span'));
        fab.addEventListener('click', function (e) {
            e.stopPropagation();
            pop.classList.toggle('open');
        });
        pop.appendChild(fab);
        pop.appendChild(buildSwitch());
        document.addEventListener('click', function (e) {
            if (!pop.contains(e.target)) pop.classList.remove('open');
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') pop.classList.remove('open');
        });
        return pop;
    }

    function syncUI() {
        switches.forEach(function (wrap) {
            var mb = wrap.querySelector('.gt-mode');
            if (mb) {
                mb.textContent = mode === 'light' ? '☀️' : '🌙';
                mb.title = mode === 'light' ? '切换到黑夜模式' : '切换到白天模式';
                mb.setAttribute('aria-label', mb.title);
            }
            var lb = wrap.querySelector('.gt-lg');
            if (lb) {
                lb.setAttribute('aria-pressed', lgOn ? 'true' : 'false');
                lb.title = lgOn ? '液态玻璃：开（点击关闭）' : '液态玻璃：关（点击开启）';
                lb.setAttribute('aria-label', lb.title);
            }
            var dots = wrap.querySelectorAll('.gt-dot');
            Array.prototype.forEach.call(dots, function (d) {
                var on = d.getAttribute('data-gt-preset') === current.id;
                d.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            var label = wrap.querySelector('.gt-label');
            if (label) label.textContent = current.name;
            var picker = wrap.querySelector('.gt-picker');
            if (picker && picker.value !== current.primary) picker.value = current.primary;
        });
    }

    function mount() {
        var slots = document.querySelectorAll('[data-theme-switcher]');
        Array.prototype.forEach.call(slots, function (slot) {
            // 形态由页面显式声明（窄容器写 data-theme-switcher="compact"），不做猜测：
            // 之前用「插入前后容器高度差」自动降级，会把 tool 这类原本就有外边距的头部误判成窄容器
            if (/compact/i.test(slot.getAttribute('data-theme-switcher') || '')) {
                slot.appendChild(buildPop());
            } else {
                // 宽容器：同时挂一份紧凑形态，窄屏（≤600px）由 CSS 换成紧凑，避免色板换行把头部撑高
                slot.className += (slot.className ? ' ' : '') + 'gt-slot-full';
                slot.appendChild(buildSwitch());
                var alt = buildPop();
                alt.className += ' gt-pop-alt';
                slot.appendChild(alt);
            }
        });
        if (!slots.length && document.documentElement.getAttribute('data-theme-ui') !== 'none') {
            buildDock();
        }
        syncUI();
    }

    /* ---------- 对外接口 ---------- */
    function set(id, customHex) {
        if (id === 'custom') return applyTheme(customTheme(customHex || current.primary), true);
        var p = preset(id);
        if (!p && hexToRgb(id)) return applyTheme(customTheme(id), true);   // 直接传 hex 也支持
        return applyTheme(p || PRESETS[0], true);
    }

    // 1) 立刻应用，避免首屏闪一下绿色再变蓝；模式先定，变量按模式算
    applyMode(resolveMode(), false);
    applyTheme(resolveSaved(), false);

    // 1.5) 液态玻璃：按记忆/页面声明初始化 + 鼠标高光跟随（关闭时零开销）
    applyLg(resolveLg(), false);
    document.addEventListener('pointermove', function (e) {
        if (!lgOn || lgPending || !e.target || !e.target.closest) return;
        lgPending = requestAnimationFrame(function () {
            lgPending = null;
            var el = e.target.closest('.card, .glass-card');
            if (!el) return;
            var r = el.getBoundingClientRect();
            if (!r.width || !r.height) return;
            el.style.setProperty('--lg-mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
            el.style.setProperty('--lg-my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
        });
    }, { passive: true });

    // 2) 解析完 DOM 再挂控件
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }

    // 3) 多标签页同步
    window.addEventListener('storage', function (e) {
        if (e.key === LS_THEME || e.key === LS_CUSTOM || e.key === LS_PRIMARY) {
            applyTheme(resolveSaved(), false);
        }
        if (e.key === LS_MODE) {
            applyMode(resolveMode(), false);
        }
        if (e.key === LS_LG) {
            applyLg(resolveLg(), false);
        }
    });

    window.GeekTheme = {
        presets: PRESETS,
        set: set,
        get: function () { return { id: current.id, name: current.name, primary: current.primary }; },
        colors: function () { return colorsCache; },   // 给 canvas / JS 用的当前主题色
        mode: function () { return mode; },
        setMode: function (m) { applyMode(m, true); },
        toggleMode: toggleMode,
        lg: function () { return lgOn ? 'on' : 'off'; },
        setLg: function (s) { applyLg(s, true); },
        toggleLg: toggleLg,
        apply: function () { return applyTheme(resolveSaved(), false); },
        mount: mount
    };
    window.setTheme = set;   // 兼容旧页面的调用
})();
