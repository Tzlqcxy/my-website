/* ============================================================
   小游戏云端战绩（全站共用，配合 worker /api/game-scores）
   用法：
   1) <script src="assets/scores.js"></script>（theme.js 之后）
   2) 页面里放容器：<div class="cloud-rank" data-cloud-rank="fish"></div>
      → 自动渲染「云端排行 Top10 + 代号输入」
   3) 游戏结束时：GameScores.submit('fish', score, '可选说明')
   代号与 TypeRush 共用（localStorage typing_name）；
   调试：页面 URL 加 ?gsapi=http://127.0.0.1:8787 可指向本地 worker
   ============================================================ */
(function () {
    'use strict';

    var BASE = (window.GameScoresAPI
        || new URLSearchParams(location.search).get('gsapi')
        || 'https://api.eggfish.dpdns.org') + '/api/game-scores';
    var NAME_KEY = 'typing_name';   // 与 TypeRush 共用代号
    var caches = {};                // game -> 最近一次榜单（离线兜底）

    function getName() {
        try { return (localStorage.getItem(NAME_KEY) || '').trim(); } catch (e) { return ''; }
    }
    function setName(n) {
        try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* 隐私模式忽略 */ }
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c];
        });
    }

    function buildPanel(box) {
        var game = box.getAttribute('data-cloud-rank');
        box.innerHTML =
            '<div class="gsc-head">' +
            '<span class="gsc-title"><i class="fas fa-cloud"></i> 云端排行</span>' +
            '<label class="gsc-name"><span>代号</span>' +
            '<input type="text" maxlength="20" placeholder="游客" autocomplete="off"></label>' +
            '</div><div class="gsc-list"><div class="gsc-empty">⏳ 加载中…</div></div>';

        var input = box.querySelector('input');
        input.value = getName();
        input.addEventListener('change', function () {
            setName(input.value.trim().slice(0, 20));
            refresh();   // 换代号后重新渲染高亮
        });
        box.setAttribute('data-cloud-ready', '');
    }

    function renderList(box, game, rows, offline) {
        var list = box.querySelector('.gsc-list');
        if (!list) return;
        if (!rows || !rows.length) {
            list.innerHTML = '<div class="gsc-empty">' +
                (offline ? '⚠️ 云端暂不可达' : '暂无战绩 · 成为第一个上榜的人') + '</div>';
            return;
        }
        var me = getName();
        var medals = ['🥇', '🥈', '🥉'];
        var html = '';
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var mine = me && r.player_name === me;
            html += '<div class="gsc-row' + (mine ? ' me' : '') + '">' +
                '<span class="gsc-no">' + (i < 3 ? medals[i] : '#' + (i + 1)) + '</span>' +
                '<span class="gsc-nm">' + esc(r.player_name) + '</span>' +
                (r.detail ? '<span class="gsc-dt">' + esc(r.detail) + '</span>' : '') +
                '<span class="gsc-sc">' + esc(r.score) + '</span>' +
                '</div>';
        }
        list.innerHTML = html;
    }

    function refresh() {
        var byGame = {};
        var boxes = document.querySelectorAll('[data-cloud-rank][data-cloud-ready]');
        Array.prototype.forEach.call(boxes, function (b) {
            var g = b.getAttribute('data-cloud-rank');
            (byGame[g] = byGame[g] || []).push(b);
        });
        Object.keys(byGame).forEach(function (g) {
            fetch(BASE + '?game=' + encodeURIComponent(g) + '&limit=10')
                .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
                .then(function (rows) {
                    caches[g] = rows;
                    Array.prototype.forEach.call(byGame[g], function (b) { renderList(b, g, rows, false); });
                })
                .catch(function () {
                    // 离线兜底：有缓存用缓存，没有就提示
                    var cached = caches[g] || [];
                    Array.prototype.forEach.call(byGame[g], function (b) {
                        renderList(b, g, cached, cached.length === 0);
                    });
                });
        });
    }

    function mount() {
        var boxes = document.querySelectorAll('[data-cloud-rank]:not([data-cloud-ready])');
        if (!boxes.length) return;
        Array.prototype.forEach.call(boxes, buildPanel);
        refresh();
    }

    /* 游戏结束时调用；score<=0 静默跳过，失败不打断游戏 */
    function submit(game, score, detail) {
        score = Math.floor(Number(score) || 0);
        if (score <= 0) return Promise.resolve(null);
        var name = getName() || '游客';
        return fetch(BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game: game, player_name: name, score: score, detail: detail || '' })
        })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
            .then(function (data) { refresh(); return data; })
            .catch(function () { return null; });
    }

    window.GameScores = {
        mount: mount,
        refresh: refresh,
        submit: submit,
        getName: getName,
        setName: setName
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
    // 从游戏页返回（bfcache）时刷新榜单
    window.addEventListener('pageshow', function () { refresh(); });
})();
