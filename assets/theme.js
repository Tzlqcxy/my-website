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
    var switches = [];   // 已挂载的色板，用于同步选中态

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

    /* ---------- 应用主题 ---------- */
    function varsOf(t) {
        return {
            '--primary': t.primary,
            '--primary-dark': t.dark,
            '--primary-light': t.light,
            '--primary-rgb': t.rgb,
            '--primary-glow': 'rgba(' + t.rgb + ', 0.25)',
            '--primary-border': 'rgba(' + t.rgb + ', 0.12)',
            '--primary-border-hover': 'rgba(' + t.rgb + ', 0.25)',
            '--border-color': 'rgba(' + t.rgb + ', 0.08)',
            '--text-accent': t.accent,
            '--text-secondary': t.secondary,
            '--text-muted': t.muted
        };
    }

    function applyTheme(t, persist) {
        var root = document.documentElement;
        var vars = varsOf(t);
        for (var k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) root.style.setProperty(k, vars[k]);
        root.setAttribute('data-theme', t.id);
        current = { id: t.id, name: t.name, primary: t.primary };
        colorsCache = { primary: t.primary, dark: t.dark, light: t.light, rgb: t.rgb };
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
    function buildSwitch() {
        var wrap = document.createElement('div');
        wrap.className = 'gt-switch';
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', '主题配色');

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

    // 1) 立刻应用，避免首屏闪一下绿色再变蓝
    applyTheme(resolveSaved(), false);

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
    });

    window.GeekTheme = {
        presets: PRESETS,
        set: set,
        get: function () { return { id: current.id, name: current.name, primary: current.primary }; },
        colors: function () { return colorsCache; },   // 给 canvas / JS 用的当前主题色
        apply: function () { return applyTheme(resolveSaved(), false); },
        mount: mount
    };
    window.setTheme = set;   // 兼容旧页面的调用
})();
