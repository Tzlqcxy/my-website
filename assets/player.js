/* ============================================================
   全站音乐播放器（由 theme.js 自动注入，无需页面单独引入）
   - 左下角浮窗：♪ 钮 + 展开卡片（播放/上下曲/进度/音量/循环/清单）
   - 清单：assets/playlist.js 的 window.GEEK_PLAYLIST
   - 清单为空时追加一首内置 WebAudio 合成演示曲，保证开箱有声
   - 记忆音量/曲目/循环模式；MediaSession 系统媒体控制
   - 页面写 <html data-player="off"> 可关闭
   ============================================================ */
(function () {
    'use strict';
    if (document.documentElement.getAttribute('data-player') === 'off') return;

    var LS_VOL = 'gt_player_vol';
    var LS_IDX = 'gt_player_idx';
    var LS_LOOP = 'gt_player_loop';
    var LOOP_ICONS = ['fa-repeat', 'fa-repeat', 'fa-random'];   // 列表 / 单曲 / 随机
    var LOOP_NAMES = ['列表循环', '单曲循环', '随机播放'];

    var playlist = [];
    var idx = 0;
    var loopMode = 'list';
    var seeking = false;
    var errStreak = 0;          // 连续加载失败计数，防止死循环跳曲
    var audio = new Audio();
    audio.preload = 'metadata';

    /* ---------- 内置演示曲：WebAudio 合成 PCM → WAV blob ---------- */
    function synthDemo() {
        var sr = 22050, bpm = 84;
        var beat = 60 / bpm, eighth = beat / 2, bar = beat * 4;
        var bars = 8, dur = bar * bars + 0.6;
        var n = Math.floor(sr * dur);
        var buf = new Float32Array(n);
        var N = {
            A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, F3: 174.61, F4: 349.23,
            G3: 196, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.26
        };
        /* 每小节 8 个八分音符，0 表示休止 */
        var melody = [
            N.A4, N.C5, N.E5, 0, N.D5, N.C5, N.A4, N.G4,
            N.E4, 0, N.G4, N.A4, N.C5, 0, N.A4, 0,
            N.G4, N.A4, N.C5, 0, N.D5, N.E5, N.D5, N.C5,
            N.A4, 0, N.G4, 0, N.E4, 0, N.D4, N.C4,
            N.E4, N.G4, N.A4, 0, N.C5, 0, N.D5, N.E5,
            N.G4, 0, N.E5, 0, N.D5, N.C5, N.A4, N.G4,
            N.A4, 0, N.C5, N.D5, N.E5, 0, N.G4, N.A4,
            N.C5, 0, N.A4, N.G4, N.A4, 0, 0, 0
        ];
        var bass = [N.A3, N.A3, N.F3, N.F3, N.C4, N.C4, N.G3, N.G3];

        var i, t;
        /* 旋律：铃铛音色（基频 + 2次谐波），指数衰减，允许余音重叠 */
        for (i = 0; i < melody.length; i++) {
            if (!melody[i]) continue;
            var f = melody[i], t0 = Math.floor(i * eighth * sr);
            var len = Math.floor(eighth * 2.4 * sr);
            for (var j = 0; j < len && t0 + j < n; j++) {
                var dt = j / sr;
                var env = Math.exp(-3.2 * dt);
                buf[t0 + j] += 0.26 * env * (Math.sin(2 * Math.PI * f * dt) + 0.35 * Math.sin(4 * Math.PI * f * dt));
            }
        }
        /* 低音：每小节一个长音，柔和起音 */
        for (i = 0; i < bass.length; i++) {
            var bf = bass[i], b0 = Math.floor(i * bar * sr);
            var bl = Math.floor(bar * 1.02 * sr);
            for (var k = 0; k < bl && b0 + k < n; k++) {
                var bt = k / sr;
                var benv = Math.min(bt / 0.06, 1) * Math.exp(-1.1 * bt);
                buf[b0 + k] += 0.2 * benv * (Math.sin(2 * Math.PI * bf * bt) + 0.25 * Math.sin(4 * Math.PI * bf * bt));
            }
        }
        /* 软限幅 + 首尾淡入淡出 */
        var peak = 0;
        for (i = 0; i < n; i++) { var a = Math.abs(buf[i]); if (a > peak) peak = a; }
        if (peak > 0.9) for (i = 0; i < n; i++) buf[i] *= 0.9 / peak;
        var fade = Math.floor(0.4 * sr);
        for (i = 0; i < fade; i++) {
            buf[i] *= i / fade;
            buf[n - 1 - i] *= i / fade;
        }

        /* 编码 16bit 单声道 WAV */
        var bytes = 44 + n * 2;
        var wav = new ArrayBuffer(bytes), v = new DataView(wav);
        var wstr = function (o, s) { for (var c = 0; c < s.length; c++) v.setUint8(o + c, s.charCodeAt(c)); };
        wstr(0, 'RIFF'); v.setUint32(4, bytes - 8, true); wstr(8, 'WAVE');
        wstr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
        v.setUint16(22, 1, true); v.setUint32(24, sr, true);
        v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        wstr(36, 'data'); v.setUint32(40, n * 2, true);
        for (i = 0; i < n; i++) {
            var s = Math.max(-1, Math.min(1, buf[i]));
            v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
        }
        return URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    }

    var DEMO = { title: '八音盒 · 演示曲', artist: 'WebAudio 合成', src: null, loop: true };

    /* ---------- 存储 ---------- */
    function lsGet(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式忽略 */ } }

    /* ---------- UI ---------- */
    var root, fab, card, nameEl, artistEl, seek, tCur, tDur,
        playBtn, prevBtn, nextBtn, loopBtn, listBtn, vol, listEl;

    function fmt(s) {
        if (!isFinite(s)) return '-:--';
        s = Math.max(0, Math.floor(s));
        return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2);
    }

    function build() {
        root = document.createElement('div');
        root.className = 'gt-player';
        root.innerHTML =
            '<button type="button" class="gt-pfab" title="音乐播放器" aria-label="音乐播放器">' +
            '<span class="gt-pnote"><i class="fas fa-music"></i></span>' +
            '<span class="gt-peq"><i></i><i></i><i></i></span>' +
            '</button>' +
            '<div class="gt-pcard" hidden>' +
            '<div class="gt-phead"><span class="gt-pdisc"><i class="fas fa-compact-disc"></i></span>' +
            '<span class="gt-pmeta"><span class="gt-pname">—</span><span class="gt-partist"></span></span></div>' +
            '<input class="gt-pseek" type="range" min="0" max="1000" value="0" aria-label="播放进度">' +
            '<div class="gt-ptimes"><span class="gt-pt-cur">0:00</span><span class="gt-pt-dur">-:--</span></div>' +
            '<div class="gt-pctl">' +
            '<button type="button" class="gt-pbtn" data-act="prev" title="上一首"><i class="fas fa-step-backward"></i></button>' +
            '<button type="button" class="gt-pbtn gt-pplay" data-act="play" title="播放/暂停"><i class="fas fa-play"></i></button>' +
            '<button type="button" class="gt-pbtn" data-act="next" title="下一首"><i class="fas fa-step-forward"></i></button>' +
            '<span class="gt-pspace"></span>' +
            '<button type="button" class="gt-pbtn" data-act="loop" title="列表循环"><i class="fas fa-repeat"></i></button>' +
            '<button type="button" class="gt-pbtn" data-act="list" title="播放清单"><i class="fas fa-list"></i></button>' +
            '<i class="fas fa-volume-up gt-pvolicon"></i>' +
            '<input class="gt-pvol" type="range" min="0" max="100" value="80" aria-label="音量">' +
            '</div>' +
            '<div class="gt-plist" hidden></div>' +
            '</div>';
        document.body.appendChild(root);

        fab = root.querySelector('.gt-pfab');
        card = root.querySelector('.gt-pcard');
        nameEl = root.querySelector('.gt-pname');
        artistEl = root.querySelector('.gt-partist');
        seek = root.querySelector('.gt-pseek');
        tCur = root.querySelector('.gt-pt-cur');
        tDur = root.querySelector('.gt-pt-dur');
        playBtn = root.querySelector('[data-act="play"] i');
        prevBtn = root.querySelector('[data-act="prev"] i');
        nextBtn = root.querySelector('[data-act="next"] i');
        loopBtn = root.querySelector('[data-act="loop"] i');
        listBtn = root.querySelector('[data-act="list"] i');
        vol = root.querySelector('.gt-pvol');
        listEl = root.querySelector('.gt-plist');

        fab.addEventListener('click', function () {
            root.classList.toggle('open');
        });
        document.addEventListener('click', function (e) {
            if (root.classList.contains('open') && !root.contains(e.target)) root.classList.remove('open');
        });

        root.addEventListener('click', function (e) {
            var b = e.target.closest('[data-act]');
            if (!b) return;
            if (b.dataset.act === 'play') toggle();
            if (b.dataset.act === 'prev') play((idx - 1 + playlist.length) % playlist.length);
            if (b.dataset.act === 'next') play((idx + 1) % playlist.length);
            if (b.dataset.act === 'loop') cycleLoop();
            if (b.dataset.act === 'list') {
                listEl.hidden = !listEl.hidden;
                listBtn.classList.toggle('on', !listEl.hidden);
            }
        });

        seek.addEventListener('input', function () { seeking = true; tCur.textContent = fmt(seek.value / 1000 * audio.duration); });
        seek.addEventListener('change', function () {
            if (isFinite(audio.duration)) audio.currentTime = seek.value / 1000 * audio.duration;
            seeking = false;
        });
        vol.addEventListener('input', function () {
            audio.volume = vol.value / 100;
            lsSet(LS_VOL, vol.value);
        });
        listEl.addEventListener('click', function (e) {
            var b = e.target.closest('[data-i]');
            if (b) play(Number(b.getAttribute('data-i')));
        });
    }

    function renderList() {
        var html = '';
        for (var i = 0; i < playlist.length; i++) {
            var t = playlist[i];
            html += '<button type="button" class="gt-ptr' + (i === idx ? ' cur' : '') + '" data-i="' + i + '">' +
                '<span class="gt-ptr-no">' + (i === idx ? '<i class="fas fa-play"></i>' : i + 1) + '</span>' +
                '<span class="gt-ptr-t">' + t.title + (t.demo ? ' <small>内置</small>' : '') + '</span>' +
                '<span class="gt-ptr-a">' + t.artist + '</span></button>';
        }
        listEl.innerHTML = html;
    }

    function syncUI(playing) {
        var t = playlist[idx] || DEMO;
        nameEl.textContent = t.title;
        artistEl.textContent = t.artist;
        playBtn.className = playing ? 'fas fa-pause' : 'fas fa-play';
        fab.classList.toggle('playing', !!playing);
        var li = LOOP_ICONS[loopMode === 'list' ? 0 : loopMode === 'one' ? 1 : 2];
        loopBtn.className = 'fas ' + li + (loopMode === 'one' ? ' on' : '');
        root.querySelector('[data-act="loop"]').title = LOOP_NAMES[loopMode === 'list' ? 0 : loopMode === 'one' ? 1 : 2];
        var rows = listEl.querySelectorAll('.gt-ptr');
        for (var i = 0; i < rows.length; i++) {
            rows[i].classList.toggle('cur', i === idx);
            rows[i].querySelector('.gt-ptr-no').innerHTML = i === idx ? '<i class="fas fa-play"></i>' : (i + 1);
        }
        audio.loop = loopMode === 'one' || !!t.loop;
    }

    /* ---------- 播放控制 ---------- */
    function load(i) {
        idx = ((i % playlist.length) + playlist.length) % playlist.length;
        lsSet(LS_IDX, String(idx));
        var t = playlist[idx];
        audio.src = t.src;
        syncUI(false);
        tDur.textContent = '-:--';
        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: t.title, artist: t.artist,
                    artwork: [{ src: 'favicon.svg', type: 'image/svg+xml' }]
                });
            } catch (e) { /* 忽略 */ }
        }
    }

    function play(i) {
        if (i !== undefined && i !== idx) load(i);
        errStreak = 0;
        audio.play().catch(function () { /* 自动播放被拦截等，静默 */ });
    }

    function toggle() {
        if (audio.paused) play();
        else audio.pause();
    }

    function cycleLoop() {
        loopMode = loopMode === 'list' ? 'one' : loopMode === 'one' ? 'shuffle' : 'list';
        lsSet(LS_LOOP, loopMode);
        syncUI(!audio.paused);
    }

    function nextTrack(auto) {
        if (loopMode === 'shuffle' && playlist.length > 1) {
            var r;
            do { r = Math.floor(Math.random() * playlist.length); } while (r === idx);
            play(r);
            return;
        }
        if (auto && idx === playlist.length - 1) { play(0); return; }
        play((idx + 1) % playlist.length);
    }

    /* ---------- 音频事件 ---------- */
    audio.addEventListener('play', function () { syncUI(true); if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'playing'; } catch (e) { } } });
    audio.addEventListener('pause', function () { syncUI(false); if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'paused'; } catch (e) { } } });
    audio.addEventListener('timeupdate', function () {
        if (seeking || !isFinite(audio.duration)) return;
        seek.value = String(Math.round(audio.currentTime / audio.duration * 1000));
        tCur.textContent = fmt(audio.currentTime);
    });
    audio.addEventListener('loadedmetadata', function () {
        tDur.textContent = fmt(audio.duration);
        seeking = false;
    });
    audio.addEventListener('ended', function () { nextTrack(true); });
    audio.addEventListener('error', function () {
        if (!audio.src || !playlist.length) return;
        nameEl.textContent = playlist[idx].title + ' ⚠️ 加载失败';
        if (++errStreak < playlist.length) setTimeout(function () { nextTrack(false); }, 1200);
    });

    /* ---------- MediaSession ---------- */
    if ('mediaSession' in navigator) {
        try {
            navigator.mediaSession.setActionHandler('play', function () { play(); });
            navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
            navigator.mediaSession.setActionHandler('previoustrack', function () { play((idx - 1 + playlist.length) % playlist.length); });
            navigator.mediaSession.setActionHandler('nexttrack', function () { nextTrack(false); });
        } catch (e) { /* 忽略 */ }
    }

    /* ---------- 初始化 ---------- */
    function init() {
        playlist = (window.GEEK_PLAYLIST || []).filter(function (t) { return t && t.src && t.title; });
        playlist.push(DEMO);
        DEMO.src = synthDemo();

        build();

        vol.value = lsGet(LS_VOL, '80');
        audio.volume = Number(vol.value) / 100;
        loopMode = lsGet(LS_LOOP, 'list');
        if (loopMode !== 'list' && loopMode !== 'one' && loopMode !== 'shuffle') loopMode = 'list';
        var saved = parseInt(lsGet(LS_IDX, '0'), 10);
        load(saved >= 0 && saved < playlist.length ? saved : 0);
        renderList();
    }

    /* 先加载清单，再等 DOM 就绪后初始化（theme.js 在 head 里注入，body 可能尚未解析） */
    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }
    var ps = document.createElement('script');
    ps.src = 'assets/playlist.js';
    ps.onload = function () { ready(init); };
    ps.onerror = function () { ready(init); };
    document.head.appendChild(ps);
})();
