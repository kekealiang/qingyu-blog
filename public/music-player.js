/* ============================================================
 * Qingyu'Blog · 右下角悬浮音乐播放器（阶段二）
 * ------------------------------------------------------------
 * 依赖：/api/music 公开接口（返回 { ok, music: [...] }）
 *       与 app.js 共用主题 CSS 变量（--card/--fg/--accent 等），自动适配明暗与主题色
 * 交互：
 *   · 右下角隐藏一个悬浮圆形按钮（音符图标；播放中显示旋转动画）
 *   · 点击按钮弹出播放面板：曲目信息 · 进度条 · 上一首/播放暂停/下一首 · 音量 · 播放列表
 *   · 记忆上次播放（曲目 + 进度 + 音量），刷新后恢复但不自动播放
 *   · 后台路由（/admin、/write、编辑页）自动隐藏；无音乐或接口失败时完全隐藏
 * ============================================================ */
(function () {
  'use strict';
  if (window.__musicPlayer) return;

  var ICONS = {
    music: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5h3.4v15H7zM13.6 4.5H17v15h-3.4z"/></svg>',
    prev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5v14M19 5l-9 7 9 7z"/></svg>',
    next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 5v14M5 5l9 7-9 7z"/></svg>',
    volume: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    close: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5L5 19"/></svg>'
  };
  function icon(name, size) {
    var s = ICONS[name];
    if (!s) return '';
    if (size && size > 0) {
      // 按需替换 SVG 尺寸（封面/列表用 14-17px，按钮/FAB 用默认 18-22px）
      return s.replace(/(<svg\s+width=")\d+(" height=")\d+/, '$1' + size + '$2' + size);
    }
    return s;
  }

  var tracks = [];
  var currentIndex = -1;
  var playing = false;
  var seeking = false;
  var audio = new Audio();
  var root, fabWrap, fab, panel, playBtn, seekInput, volInput, curTimeEl, durTimeEl, panelList, panelTitle, panelArtist, panelCover, panelCount;
  var VOL_KEY = 'qy.music.volume';
  var LAST_KEY = 'qy.music.last';
  var visible = false;
  var retractTimer = null;
  function canHover() {
    try { return window.matchMedia && window.matchMedia('(hover: hover)').matches; } catch (e) { return false; }
  }

  /* ---------- 工具 ---------- */
  function tt(key) {
    try { return window.__i18n && window.__i18n.t ? window.__i18n.t(key) : key; } catch (e) { return key; }
  }
  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isBackstagePath(p) {
    p = String(p == null ? location.pathname : p);
    if (p.indexOf('/admin') === 0 || p === '/write') return true;
    var m = p.match(/^\/posts\/[^/]+\/(edit)$/);
    return !!m;
  }
  function currentPath() {
    if (location.hash && location.hash.indexOf('#/') === 0) return location.hash.slice(1);
    return location.pathname;
  }

  /* ---------- DOM：悬浮按钮 + 弹出面板 ---------- */
  function buildDOM() {
    root = document.createElement('div');
    root.id = 'musicPlayer';
    root.className = 'mp-root';
    root.innerHTML =
      '<div class="mp-fab-wrap" id="mpFabWrap">' +
        '<button type="button" class="mp-fab" id="mpFab" title="' + esc(tt('player.playlist')) + '" aria-label="' + esc(tt('player.playlist')) + '">' +
          '<span class="mp-fab-icon" id="mpFabIcon">' + icon('music') + '</span>' +
        '</button>' +
      '</div>' +
      '<div class="mp-panel" id="mpPanel" role="dialog" aria-hidden="true" aria-labelledby="mpTitle">' +
        '<div class="mp-panel-head">' +
          '<span class="mp-cover" id="mpCover">' + icon('music', 17) + '</span>' +
          '<div class="mp-meta">' +
            '<div class="mp-title" id="mpTitle">' + esc(tt('player.none')) + '</div>' +
            '<div class="mp-artist" id="mpArtist">—</div>' +
          '</div>' +
          '<button type="button" class="mp-btn mp-close" id="mpPanelClose" aria-label="' + esc(tt('player.close')) + '">' + icon('close') + '</button>' +
        '</div>' +
        '<div class="mp-progress">' +
          '<input type="range" class="mp-seek" id="mpSeek" min="0" max="1000" value="0" step="1" aria-label="' + esc(tt('player.seek')) + '">' +
          '<div class="mp-times"><span class="mp-time" id="mpCur">0:00</span><span class="mp-time" id="mpDur">0:00</span></div>' +
        '</div>' +
        '<div class="mp-controls">' +
          '<button type="button" class="mp-btn" id="mpPrev" aria-label="' + esc(tt('player.prev')) + '">' + icon('prev') + '</button>' +
          '<button type="button" class="mp-btn mp-play" id="mpPlay" aria-label="' + esc(tt('player.play')) + '">' + icon('play') + '</button>' +
          '<button type="button" class="mp-btn" id="mpNext" aria-label="' + esc(tt('player.next')) + '">' + icon('next') + '</button>' +
        '</div>' +
        '<div class="mp-foot">' +
          '<div class="mp-vol">' +
            icon('volume') +
            '<input type="range" class="mp-vol-slider" id="mpVol" min="0" max="100" step="1" value="80" aria-label="' + esc(tt('player.volume')) + '">' +
          '</div>' +
          '<span class="mp-count" id="mpCount">0</span>' +
        '</div>' +
        '<div class="mp-list" id="mpList"></div>' +
      '</div>';
    document.body.appendChild(root);
    fabWrap = document.getElementById('mpFabWrap');
    fab = document.getElementById('mpFab');
    panel = document.getElementById('mpPanel');
    playBtn = document.getElementById('mpPlay');
    seekInput = document.getElementById('mpSeek');
    volInput = document.getElementById('mpVol');
    curTimeEl = document.getElementById('mpCur');
    durTimeEl = document.getElementById('mpDur');
    panelList = document.getElementById('mpList');
    panelTitle = document.getElementById('mpTitle');
    panelArtist = document.getElementById('mpArtist');
    panelCover = document.getElementById('mpCover');
    panelCount = document.getElementById('mpCount');

    fab.addEventListener('click', togglePanel);
    // 悬浮按钮抽屉效果：hover 滑出、移开延时缩回（触摸设备靠点击展开）
    fabWrap.addEventListener('mouseenter', expandFab);
    fabWrap.addEventListener('mouseleave', function () { if (!panel.classList.contains('open')) scheduleRetract(); });
    document.getElementById('mpPanelClose').addEventListener('click', closePanel);
    document.getElementById('mpPrev').addEventListener('click', function () { step(-1); });
    document.getElementById('mpNext').addEventListener('click', function () { step(1); });
    playBtn.addEventListener('click', toggle);

    seekInput.addEventListener('input', function () { seeking = true; });
    seekInput.addEventListener('change', function () {
      if (audio.duration) {
        audio.currentTime = (seekInput.value / 1000) * audio.duration;
        updateSeekUI();
      }
      seeking = false;
    });
    volInput.addEventListener('input', function () {
      audio.volume = volInput.value / 100;
      audio.muted = false;
      try { localStorage.setItem(VOL_KEY, volInput.value); } catch (e) {}
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') && root && !root.contains(e.target)) closePanel();
    });
  }

  /* ---------- 播放控制 ---------- */
  function bindAudio() {
    audio.addEventListener('timeupdate', function () {
      if (!seeking && audio.duration) {
        seekInput.value = Math.round((audio.currentTime / audio.duration) * 1000);
        curTimeEl.textContent = fmtTime(audio.currentTime);
      }
      saveProgress();
    });
    audio.addEventListener('loadedmetadata', function () {
      durTimeEl.textContent = fmtTime(audio.duration);
      var last = loadLast();
      if (last && last.i === currentIndex && last.t > 0 && Math.abs(audio.currentTime) < 0.01 && !playing) {
        try { audio.currentTime = Math.min(last.t, audio.duration - 0.5); } catch (e) {}
      }
      updateSeekUI();
    });
    audio.addEventListener('play', function () { playing = true; setPlayIcon(true); setFabPlaying(true); });
    audio.addEventListener('pause', function () { playing = false; setPlayIcon(false); setFabPlaying(false); });
    audio.addEventListener('ended', function () { next(); });
    audio.addEventListener('error', function () {
      if (currentIndex >= 0 && tracks.length > 1) next();
      else stop();
    });
  }
  function loadLast() {
    try { var v = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); if (v && typeof v.i === 'number') return v; } catch (e) {}
    return null;
  }
  function saveProgress() {
    if (currentIndex < 0) return;
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ i: currentIndex, t: audio.currentTime || 0 })); } catch (e) {}
  }
  function clearLast() {
    try { localStorage.removeItem(LAST_KEY); } catch (e) {}
  }
  function setPlayIcon(isPlaying) {
    playBtn.innerHTML = isPlaying ? icon('pause') : icon('play');
    playBtn.setAttribute('aria-label', tt(isPlaying ? 'player.pause' : 'player.play'));
  }
  function setFabPlaying(isPlaying) {
    if (fab) fab.classList.toggle('playing', !!isPlaying);
    // 播放中：FAB 中央图标换为声波（三竖条错相跳动）——不再转圈，避免像「加载歌曲」；
    // 暂停/停止时恢复音符图标
    var ic = document.getElementById('mpFabIcon');
    if (ic) ic.innerHTML = isPlaying
      ? '<span class="mp-eq mp-fab-eq"><i></i><i></i><i></i></span>'
      : icon('music');
  }
  function playTrack(i, autoplay) {
    if (i < 0 || i >= tracks.length) return;
    currentIndex = i;
    var tr = tracks[i];
    audio.src = tr.url;
    panelTitle.textContent = tr.title || tt('player.unknown');
    panelArtist.textContent = tr.artist || '—';
    if (tr.cover) {
      panelCover.innerHTML = '<img src="' + esc(tr.cover) + '" alt="" loading="lazy">';
    } else {
      panelCover.innerHTML = icon('music', 17);
    }
    curTimeEl.textContent = '0:00';
    durTimeEl.textContent = '0:00';
    seekInput.value = 0;
    if (autoplay !== false) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    } else {
      try { audio.load(); } catch (e) {}
    }
    renderList();
    show();
  }
  function toggle() {
    if (currentIndex < 0) {
      if (tracks.length) playTrack(0, true);
      return;
    }
    if (audio.paused) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    } else {
      audio.pause();
    }
  }
  function step(dir) {
    if (!tracks.length) return;
    var i = currentIndex < 0 ? 0 : currentIndex + dir;
    if (i < 0) i = tracks.length - 1;
    if (i >= tracks.length) i = 0;
    playTrack(i, true);
  }
  function next() {
    if (!tracks.length) return;
    if (currentIndex < tracks.length - 1) playTrack(currentIndex + 1, true);
    else stop();
  }
  function stop() {
    try { audio.pause(); audio.removeAttribute('src'); } catch (e) {}
    playing = false;
    setPlayIcon(false);
    setFabPlaying(false);
    curTimeEl.textContent = '0:00';
    durTimeEl.textContent = '0:00';
    seekInput.value = 0;
    clearLast();
  }
  function updateSeekUI() {
    if (audio.duration) {
      seekInput.value = Math.round((audio.currentTime / audio.duration) * 1000);
      curTimeEl.textContent = fmtTime(audio.currentTime);
    }
  }

  /* ---------- 悬浮按钮抽屉（缩进窗口外露一点，触碰滑出） ---------- */
  function expandFab() {
    if (!fabWrap) return;
    if (retractTimer) { clearTimeout(retractTimer); retractTimer = null; }
    fabWrap.classList.add('expanded');
  }
  function scheduleRetract() {
    if (!fabWrap) return;
    if (retractTimer) clearTimeout(retractTimer);
    retractTimer = setTimeout(function () {
      retractTimer = null;
      if (!panel.classList.contains('open')) fabWrap.classList.remove('expanded');
    }, 1400);
  }
  function retractFab() {
    if (!fabWrap) return;
    if (retractTimer) { clearTimeout(retractTimer); retractTimer = null; }
    fabWrap.classList.remove('expanded');
  }

  /* ---------- 播放列表 ---------- */
  function renderList() {
    if (!panelList) return;
    if (panelCount) panelCount.textContent = tracks.length;
    if (!tracks.length) {
      panelList.innerHTML = '<div class="mp-empty">' + esc(tt('player.empty')) + '</div>';
      return;
    }
    panelList.innerHTML = tracks.map(function (tr, i) {
      var active = i === currentIndex;
      return '<button type="button" class="mp-item' + (active ? ' active' : '') + '" data-i="' + i + '">' +
        '<span class="mp-item-cover">' + (tr.cover ? '<img src="' + esc(tr.cover) + '" alt="" loading="lazy">' : icon('music', 14)) + '</span>' +
        '<span class="mp-item-meta"><span class="mp-item-title">' + esc(tr.title || tt('player.unknown')) + '</span>' +
        '<span class="mp-item-artist">' + esc(tr.artist || '—') + '</span></span>' +
        '<span class="mp-item-state">' + (active ? (playing ? '<span class="mp-eq"><i></i><i></i><i></i></span>' : icon('volume', 14)) : '') + '</span>' +
        '</button>';
    }).join('');
    var items = panelList.querySelectorAll('.mp-item');
    for (var k = 0; k < items.length; k++) {
      items[k].addEventListener('click', function () {
        playTrack(parseInt(this.getAttribute('data-i'), 10), true);
      });
    }
  }
  function openPanel() {
    if (!root || !panel) return;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    expandFab();
    renderList();
  }
  function closePanel() {
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    // 触摸设备：关面板即缩回；桌面：交由 mouseleave 延时缩回
    if (!canHover()) retractFab();
  }
  function togglePanel() {
    if (panel.classList.contains('open')) closePanel(); else openPanel();
  }

  /* ---------- 显示控制 ---------- */
  function show() {
    if (visible) return;
    visible = true;
    root.classList.add('mp-on');
    document.body.classList.add('mp-on');
  }
  function syncRoute() {
    var hide = isBackstagePath(currentPath());
    if (root) root.classList.toggle('mp-hidden', hide);
    if (hide) { closePanel(); retractFab(); }
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', init); return; }
    buildDOM();
    bindAudio();
    var vol = 80;
    try { var sv = parseInt(localStorage.getItem(VOL_KEY), 10); if (isFinite(sv) && sv >= 0 && sv <= 100) vol = sv; } catch (e) {}
    audio.volume = vol / 100;
    if (volInput) volInput.value = vol;
    syncRoute();

    try {
      var res = await fetch('/api/music?_=' + Date.now());
      if (!res.ok) return;
      var d = await res.json();
      if (!d || d.ok !== true || !d.music) return;
      tracks = (d.music || []).filter(function (x) { return x && x.url; });
      if (!tracks.length) return;
      var last = loadLast();
      if (last && last.i >= 0 && last.i < tracks.length) {
        playTrack(last.i, false);
      } else {
        renderList();
        show();
      }
    } catch (e) { /* 静默：接口不可用时隐藏播放器 */ }
  }

  window.addEventListener('qy:route', syncRoute);

  window.__musicPlayer = {
    init: init,
    sync: syncRoute,
    togglePanel: togglePanel,
    closePanel: closePanel,
    playTrack: playTrack,
    toggle: toggle
  };
  init();
})();
