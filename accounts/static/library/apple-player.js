// Now Playing, in the manner of Apple Music: a floating mini player that morphs into a full-screen sheet, artwork that flies out of
// the tapped cover and breathes (shrinks when paused, lifts when playing), a scrubber that swells under your finger, time-scrolled
// lyrics, an Up Next queue, drag-down to dismiss, and lock-screen controls through the Media Session API.
// Loaded before library-core.js, which then uses it as the library's audio player (openTrack / setQueue / syncSession).
(function () {
  if (window.__smsLibraryAudioPlayer) return;
  var SESSION_KEY = "sms-library-audio-session", VOL_KEY = "sms-library-audio-volume", VERSION = 3;
  var EASE = "cubic-bezier(.32,.72,0,1)";
  var reduce = function () { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };
  function fmt(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); }
  function hexToRgb(h) { h = String(h || "#333").replace("#", ""); if (h.length === 3) h = h.replace(/(.)/g, "$1$1"); var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { var A = hexToRgb(a), B = hexToRgb(b); return "rgb(" + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }).join(",") + ")"; }

  // ---- icons ----------------------------------------------------------------------------------------------------------------------
  var svg = function (body, vb) { return '<svg viewBox="' + (vb || "0 0 24 24") + '" aria-hidden="true" focusable="false">' + body + "</svg>"; };
  var I = {
    play: svg('<path d="M7.2 4.4v15.2a1 1 0 0 0 1.5.86l12.4-7.6a1 1 0 0 0 0-1.72L8.7 3.54a1 1 0 0 0-1.5.86z" fill="currentColor"/>'),
    pause: svg('<rect x="5" y="3.6" width="5" height="16.8" rx="1.5" fill="currentColor"/><rect x="14" y="3.6" width="5" height="16.8" rx="1.5" fill="currentColor"/>'),
    next: svg('<path d="M3.5 5.6v12.8a.9.9 0 0 0 1.4.74l8.6-5.5a.9.9 0 0 0 0-1.48L4.9 4.86a.9.9 0 0 0-1.4.74z" fill="currentColor"/><path d="M12.5 5.6v12.8a.9.9 0 0 0 1.4.74l8.6-5.5a.9.9 0 0 0 0-1.48l-8.6-5.28a.9.9 0 0 0-1.4.74z" fill="currentColor"/>'),
    prev: svg('<path d="M20.5 5.6v12.8a.9.9 0 0 1-1.4.74l-8.6-5.5a.9.9 0 0 1 0-1.48l8.6-5.28a.9.9 0 0 1 1.4.74z" fill="currentColor"/><path d="M11.5 5.6v12.8a.9.9 0 0 1-1.4.74l-8.6-5.5a.9.9 0 0 1 0-1.48l8.6-5.28a.9.9 0 0 1 1.4.74z" fill="currentColor"/>'),
    shuffle: svg('<path d="M3 7h3.2c1.6 0 3 .8 3.9 2.1l3.8 5.8c.9 1.3 2.3 2.1 3.9 2.1H21M3 17h3.2c1.6 0 3-.8 3.9-2.1M13.9 9.1c.9-1.3 2.3-2.1 3.9-2.1H21M18.5 4 21 7l-2.5 3M18.5 14l2.5 3-2.5 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    repeat: svg('<path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    repeatOne: svg('<path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 10.5l1.4-.8v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
    lyrics: svg('<path d="M4 4.5h16A1.5 1.5 0 0 1 21.5 6v10a1.5 1.5 0 0 1-1.5 1.5H9.8L5 21.2V17.5H4A1.5 1.5 0 0 1 2.5 16V6A1.5 1.5 0 0 1 4 4.5z" fill="currentColor"/><path d="M7.5 9.4h6M7.5 12.6h9" stroke="#000" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/>'),
    queue: svg('<path d="M4 6.5h13M4 12h13M4 17.5h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M18.5 14.6v5.4l4.2-2.7z" fill="currentColor"/>'),
    star: svg('<path d="M12 3.4l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'),
    starOn: svg('<path d="M12 3.4l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8z" fill="currentColor"/>'),
    more: svg('<circle cx="5.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="18.5" cy="12" r="1.9" fill="currentColor"/>'),
    down: svg('<path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
    volLo: svg('<path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z" fill="currentColor"/>'),
    volHi: svg('<path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z" fill="currentColor"/><path d="M15.2 8.8a4.6 4.6 0 0 1 0 6.4M17.7 6.2a8.2 8.2 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')
  };

  // ---- state ----------------------------------------------------------------------------------------------------------------------
  var audio = new Audio();
  audio.preload = "metadata"; audio.playsInline = true;
  var S = { queue: [], original: null, idx: -1, shuffle: false, repeat: "off", view: "art", lang: "", expanded: false, loading: false, error: "", lines: [], lineT: [], active: -1, dragging: false, built: false, pendingSeek: 0, lastSave: 0 };
  var root, mini, full, sheet, bgA, bgB, bgFlip = 0, artWrap, miniArt, bigArt;
  var els = {};
  var track = function () { return S.queue[S.idx] || null; };

  // ---- build the DOM once ----------------------------------------------------------------------------------------------------------
  function build() {
    if (S.built) return;
    var host = document.getElementById("apRoot");
    if (!host) { host = document.createElement("div"); host.id = "apRoot"; document.body.appendChild(host); }
    host.innerHTML =
      '<div class="ap" id="ap" data-state="closed" data-playing="0" data-view="art">' +
      '<div class="ap-mini" id="apMini" role="region" aria-label="Now playing">' +
        '<button type="button" class="ap-mini__main" id="apMiniOpen" aria-label="Open the player"><span class="ap-mini__art" id="apMiniArt"></span><span class="ap-mini__txt"><b id="apMiniTitle"></b><span id="apMiniSub"></span></span></button>' +
        '<button type="button" class="ap-ib ap-mini__play" id="apMiniPlay" aria-label="Play">' + I.play + "</button>" +
        '<button type="button" class="ap-ib ap-mini__next" id="apMiniNext" aria-label="Next track">' + I.next + "</button>" +
        '<button type="button" class="ap-ib ap-mini__x" id="apMiniClose" aria-label="Stop and close the player">' + I.close + "</button>" +
        '<i class="ap-mini__bar" aria-hidden="true"><b id="apMiniProg"></b></i>' +
      "</div>" +
      '<section class="ap-full" id="apFull" role="dialog" aria-modal="true" aria-label="Now playing" hidden>' +
        '<div class="ap-bg" aria-hidden="true"><i class="ap-bg__l is-on" id="apBgA"></i><i class="ap-bg__l" id="apBgB"></i><i class="ap-bg__blob ap-bg__blob--1"></i><i class="ap-bg__blob ap-bg__blob--2"></i><i class="ap-bg__shade"></i></div>' +
        '<div class="ap-sheet" id="apSheet" tabindex="-1">' +
          '<div class="ap-grabzone" id="apGrabZone"><button type="button" class="ap-grab" id="apGrab" aria-label="Minimise the player"></button></div>' +
          '<div class="ap-compact" id="apCompact"><span class="ap-compact__art" id="apCompactArt"></span><span class="ap-compact__txt"><b id="apCTitle"></b><span id="apCSub"></span></span><button type="button" class="ap-ib ap-fav" id="apCFav" aria-label="Favourite">' + I.star + "</button></div>" +
          '<div class="ap-stage" id="apStage">' +
            '<div class="ap-view ap-view--art" id="apViewArt"><div class="ap-artwrap" id="apArtWrap"><div class="ap-art" id="apBigArt"></div></div></div>' +
            '<div class="ap-view ap-view--lyrics" id="apViewLyrics"><div class="ap-langs" id="apLangs"></div><div class="ap-lyrics" id="apLyrics" tabindex="0"></div></div>' +
            '<div class="ap-view ap-view--queue" id="apViewQueue"><div class="ap-qhead"><b>Playing Next</b><span><button type="button" class="ap-chip" id="apShuffle" aria-pressed="false" aria-label="Shuffle">' + I.shuffle + '</button><button type="button" class="ap-chip" id="apRepeat" aria-pressed="false" aria-label="Repeat: off">' + I.repeat + '</button></span></div><ol class="ap-qlist" id="apQueue"></ol></div>' +
          "</div>" +
          '<div class="ap-meta ap-rise" id="apMeta"><div class="ap-meta__txt"><b class="ap-title" id="apTitle"><span></span></b><span class="ap-sub" id="apSub"></span></div><button type="button" class="ap-ib ap-fav" id="apFav" aria-label="Favourite" aria-pressed="false">' + I.star + '</button><button type="button" class="ap-ib ap-moreb" id="apMore" aria-label="More" aria-haspopup="menu">' + I.more + "</button></div>" +
          '<div class="ap-scrub ap-rise" id="apScrub" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="ap-scrub__track"><b class="ap-scrub__fill" id="apFill"></b></div><div class="ap-scrub__time"><span id="apCur">0:00</span><span id="apLeft">-0:00</span></div></div>' +
          '<div class="ap-transport ap-rise"><button type="button" class="ap-tb" id="apPrev" aria-label="Previous track">' + I.prev + '</button><button type="button" class="ap-tb ap-tb--play" id="apPlay" aria-label="Play"><span class="ap-ico ap-ico--play">' + I.play + '</span><span class="ap-ico ap-ico--pause">' + I.pause + '</span><i class="ap-spin" aria-hidden="true"></i></button><button type="button" class="ap-tb" id="apNext" aria-label="Next track">' + I.next + "</button></div>" +
          '<div class="ap-vol ap-rise" id="apVol" role="slider" tabindex="0" aria-label="Volume" aria-valuemin="0" aria-valuemax="100"><span class="ap-vol__i">' + I.volLo + '</span><div class="ap-vol__track"><b id="apVolFill"></b></div><span class="ap-vol__i">' + I.volHi + "</span></div>" +
          '<div class="ap-foot ap-rise"><button type="button" class="ap-fb" id="apLyricsBtn" aria-pressed="false" aria-label="Lyrics">' + I.lyrics + '</button><span class="ap-foot__msg" id="apMsg" role="status" aria-live="polite"></span><button type="button" class="ap-fb" id="apQueueBtn" aria-pressed="false" aria-label="Up next">' + I.queue + "</button></div>" +
          '<div class="ap-menu" id="apMenu" role="menu" hidden></div>' +
        "</div>" +
      "</section></div>";
    root = $("#ap"); mini = $("#apMini"); full = $("#apFull"); sheet = $("#apSheet");
    bgA = $("#apBgA"); bgB = $("#apBgB"); artWrap = $("#apArtWrap"); bigArt = $("#apBigArt"); miniArt = $("#apMiniArt");
    ["apMiniTitle", "apMiniSub", "apMiniProg", "apMiniPlay", "apTitle", "apSub", "apCTitle", "apCSub", "apCompactArt", "apFill", "apCur", "apLeft", "apScrub", "apPlay", "apVol", "apVolFill", "apLyrics", "apLangs", "apQueue", "apShuffle", "apRepeat", "apLyricsBtn", "apQueueBtn", "apMsg", "apFav", "apCFav", "apMenu", "apStage"].forEach(function (id) { els[id] = document.getElementById(id); });
    wire();
    S.built = true;
  }

  // ---- rendering the current track ----------------------------------------------------------------------------------------------------
  function artHtml(t) { return window.KL && KL.albumArtHtml ? KL.albumArtHtml(t) : '<span class="ap-art__fallback">' + esc((t.title || "?").slice(0, 1)) + "</span>"; }
  function setBg(t) {
    var a = (t && t.art) || { c1: "#3c1c4a", c2: "#1a0b24" };
    var on = bgFlip ? bgB : bgA, off = bgFlip ? bgA : bgB;
    bgFlip = bgFlip ? 0 : 1;
    var next = bgFlip ? bgB : bgA, prev = bgFlip ? bgA : bgB;
    next.style.background = "radial-gradient(120% 90% at 20% 0%," + mix(a.c1, "#ffffff", 0.18) + "," + a.c1 + " 38%," + a.c2 + " 100%)";
    next.classList.add("is-on"); prev.classList.remove("is-on");
    root.style.setProperty("--ap-accent", mix(a.c1, "#ffffff", 0.62));
  }
  function renderTrack() {
    var t = track(); if (!t) return;
    var sub = [t.singer, t.deity].filter(Boolean).join(" · ") || t.subtitle || "";
    els.apMiniTitle.textContent = t.title; els.apMiniSub.textContent = sub;
    els.apTitle.firstChild.textContent = t.title; els.apSub.textContent = sub;
    els.apCTitle.textContent = t.title; els.apCSub.textContent = sub;
    miniArt.innerHTML = artHtml(t); bigArt.innerHTML = artHtml(t); els.apCompactArt.innerHTML = artHtml(t);
    setBg(t);
    root.dataset.state === "closed" && (root.dataset.state = "mini");
    // a long title drifts sideways, like Apple Music's marquee
    requestAnimationFrame(function () {
      var tt = els.apTitle, inner = tt.firstChild;
      tt.classList.remove("is-marquee"); inner.style.removeProperty("--ap-shift");
      var over = inner.scrollWidth - tt.clientWidth;
      if (over > 6) { inner.style.setProperty("--ap-shift", "-" + (over + 24) + "px"); tt.classList.add("is-marquee"); }
    });
    var fav = !!(window.KL && KL.store && KL.store.isFav(t.slug));
    [els.apFav, els.apCFav].forEach(function (b) { b.innerHTML = fav ? I.starOn : I.star; b.setAttribute("aria-pressed", String(fav)); b.classList.toggle("is-on", fav); });
    renderLyrics(); renderQueue(); updateMediaSession(); renderPlayState();
    // the new track fades in under the old one
    [bigArt, els.apMeta || $("#apMeta")].forEach(function (el) { if (!el || reduce()) return; el.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: EASE }); });
  }
  function renderPlayState() {
    var playing = !audio.paused && !audio.ended;
    root.dataset.playing = playing ? "1" : "0";
    root.classList.toggle("is-loading", S.loading && playing);
    var label = playing ? "Pause" : "Play";
    [els.apMiniPlay, els.apPlay].forEach(function (b) { b.setAttribute("aria-label", label); });
    els.apMiniPlay.innerHTML = playing ? I.pause : I.play;
    els.apMsg.textContent = S.error;
    root.classList.toggle("has-error", !!S.error);
  }
  function renderProgress() {
    var d = audio.duration || 0, c = audio.currentTime || 0, p = d ? clamp(c / d, 0, 1) : 0;
    if (!S.scrubbing) {
      els.apFill.style.transform = "scaleX(" + p + ")";
      els.apCur.textContent = fmt(c); els.apLeft.textContent = d ? "-" + fmt(d - c) : "-0:00";
      els.apScrub.setAttribute("aria-valuenow", String(Math.round(p * 100)));
    }
    els.apMiniProg.style.transform = "scaleX(" + p + ")";
    if (S.expanded && S.view === "lyrics") syncLyrics(c, d);
  }

  // ---- lyrics (scrolled by progress through the track) -----------------------------------------------------------------------------------
  function lyricLangs(t) { var l = (t && t.lyrics) || {}; return ["hindi", "english", "sanskrit", "transliteration"].filter(function (k) { return l[k] && String(l[k]).trim(); }); }
  var LANG = { hindi: "हिन्दी", english: "English", sanskrit: "संस्कृत", transliteration: "Roman" };
  function renderLyrics() {
    var t = track(), langs = lyricLangs(t), box = els.apLyrics;
    S.lines = []; S.lineT = []; S.active = -1;
    if (!langs.length) { els.apLangs.innerHTML = ""; box.innerHTML = '<p class="ap-lyrics__none">Lyrics aren’t available for this track.</p>'; $("#apLyricsBtn").classList.add("is-dim"); return; }
    $("#apLyricsBtn").classList.remove("is-dim");
    if (langs.indexOf(S.lang) < 0) S.lang = langs.indexOf("hindi") >= 0 ? "hindi" : langs[0];
    els.apLangs.innerHTML = langs.length > 1 ? langs.map(function (k) { return '<button type="button" class="ap-lang' + (k === S.lang ? " is-on" : "") + '" data-lang="' + k + '" aria-pressed="' + (k === S.lang) + '">' + LANG[k] + "</button>"; }).join("") : "";
    var html = "", idx = 0;
    String(t.lyrics[S.lang]).replace(/\r/g, "").split(/\n\s*\n/).forEach(function (para) {
      var lines = para.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      lines.forEach(function (ln) { S.lines.push(ln); html += '<p class="ap-line" data-i="' + idx + '">' + esc(ln) + "</p>"; idx++; });
      html += '<i class="ap-gap"></i>';
    });
    box.innerHTML = '<i class="ap-pad"></i>' + html + '<i class="ap-pad"></i>';
    box.scrollTop = 0;
  }
  // there are no timestamps for these tracks, so each line gets a share of the song in proportion to its length
  function lineTimes(d) {
    var total = 0, w = S.lines.map(function (l) { var x = Math.max(10, l.length); total += x; return x; });
    var intro = Math.min(8, d * 0.05), span = Math.max(1, d - intro - Math.min(4, d * 0.03)), acc = 0;
    S.lineT = w.map(function (x) { var t0 = intro + (acc / total) * span; acc += x; return t0; });
  }
  function syncLyrics(c, d) {
    if (!S.lines.length || !d) return;
    if (S.lineT.length !== S.lines.length || S.lineD !== d) { lineTimes(d); S.lineD = d; }
    var a = -1;
    for (var i = 0; i < S.lineT.length; i++) { if (c >= S.lineT[i]) a = i; else break; }
    if (a === S.active) return;
    S.active = a;
    var box = els.apLyrics;
    box.classList.toggle("has-active", a >= 0);
    $$(".ap-line", box).forEach(function (n, i) { n.classList.toggle("is-on", i === a); n.classList.toggle("is-past", i < a); });
    var el = box.querySelector('.ap-line[data-i="' + a + '"]');
    if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight * 0.32, behavior: S.userScrolled ? "auto" : "smooth" });
  }

  // ---- the Up Next list --------------------------------------------------------------------------------------------------------------
  function renderQueue() {
    var q = els.apQueue; if (!q) return;
    q.innerHTML = S.queue.map(function (t, i) {
      var cur = i === S.idx;
      return '<li class="ap-q' + (cur ? " is-cur" : "") + '"><button type="button" class="ap-q__b" data-i="' + i + '"><span class="ap-q__art">' + artHtml(t) + '</span><span class="ap-q__txt"><b>' + esc(t.title) + "</b><span>" + esc([t.singer, t.deity].filter(Boolean).join(" · ")) + '</span></span><span class="ap-eq" aria-hidden="true"><i></i><i></i><i></i></span></button></li>';
    }).join("");
    els.apShuffle.classList.toggle("is-on", S.shuffle); els.apShuffle.setAttribute("aria-pressed", String(S.shuffle));
    var rep = els.apRepeat; rep.classList.toggle("is-on", S.repeat !== "off"); rep.setAttribute("aria-pressed", String(S.repeat !== "off"));
    rep.innerHTML = S.repeat === "one" ? I.repeatOne : I.repeat; rep.setAttribute("aria-label", "Repeat: " + S.repeat);
    var cur = q.querySelector(".is-cur"); if (cur && S.expanded && S.view === "queue") cur.scrollIntoView({ block: "nearest" });
  }

  // ---- transport -----------------------------------------------------------------------------------------------------------------------
  function load(i, autoplay, seekTo) {
    S.idx = clamp(i, 0, S.queue.length - 1);
    var t = track(); if (!t) return;
    S.error = ""; S.loading = true; S.lineD = 0; S.userScrolled = false;
    audio.src = t.audioUrl; S.pendingSeek = seekTo || 0;
    renderTrack(); renderProgress();
    if (autoplay) play();
    saveSession(true);
  }
  function play() {
    var p = audio.play();
    if (p && p.catch) p.catch(function (e) { if (e && e.name === "NotAllowedError") { S.loading = false; renderPlayState(); } else onError(); });
  }
  function toggle() { if (!track()) return; if (audio.paused) { if (audio.ended) audio.currentTime = 0; play(); } else audio.pause(); }
  function next(auto) {
    if (!S.queue.length) return;
    var n = S.idx + 1;
    if (n >= S.queue.length) { if (S.repeat === "all" || !auto) n = 0; else { audio.pause(); audio.currentTime = 0; renderPlayState(); renderProgress(); return; } }
    load(n, true); bump($("#apNext"));
  }
  function prev() {
    if (!S.queue.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    load(S.idx - 1 < 0 ? S.queue.length - 1 : S.idx - 1, true); bump($("#apPrev"));
  }
  function seek(t) { if (isFinite(audio.duration)) audio.currentTime = clamp(t, 0, audio.duration); }
  function bump(el) { if (!el || reduce()) return; el.animate([{ transform: "scale(1)" }, { transform: "scale(.86)" }, { transform: "scale(1)" }], { duration: 320, easing: EASE }); }
  function toggleShuffle() {
    var t = track();
    if (!S.shuffle) {
      S.original = S.queue.slice();
      var rest = S.queue.filter(function (x) { return x !== t; });
      for (var i = rest.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp; }
      S.queue = [t].concat(rest); S.idx = 0; S.shuffle = true;
    } else {
      S.queue = (S.original || S.queue).slice(); S.idx = Math.max(0, S.queue.indexOf(t)); S.shuffle = false; S.original = null;
    }
    renderQueue(); saveSession(true);
  }
  function cycleRepeat() { S.repeat = S.repeat === "off" ? "all" : S.repeat === "all" ? "one" : "off"; renderQueue(); saveSession(true); }
  function onError() {
    S.loading = false; S.error = "Couldn’t play this track. Tap play to try again."; renderPlayState();
  }

  // ---- audio events --------------------------------------------------------------------------------------------------------------------
  audio.addEventListener("play", function () { S.error = ""; if (S.built) renderPlayState(); startRaf(); updateSessionState(); });
  audio.addEventListener("pause", function () { if (S.built) renderPlayState(); saveSession(true); updateSessionState(); });
  audio.addEventListener("waiting", function () { S.loading = true; if (S.built) renderPlayState(); });
  audio.addEventListener("playing", function () { S.loading = false; if (S.built) renderPlayState(); });
  audio.addEventListener("canplay", function () { S.loading = false; if (S.built) renderPlayState(); });
  audio.addEventListener("loadedmetadata", function () { if (S.pendingSeek && isFinite(audio.duration)) { audio.currentTime = Math.min(S.pendingSeek, audio.duration - 1); S.pendingSeek = 0; } if (S.built) renderProgress(); });
  audio.addEventListener("durationchange", function () { if (S.built) renderProgress(); });
  audio.addEventListener("error", function () { if (audio.src && track()) onError(); });
  audio.addEventListener("ended", function () { if (S.repeat === "one") { audio.currentTime = 0; play(); } else next(true); });
  audio.addEventListener("timeupdate", function () { if (!S.built) return; if (audio.paused) renderProgress(); var n = Date.now(); if (n - S.lastSave > 3000) { S.lastSave = n; saveSession(); } });
  var raf = 0;
  function startRaf() { if (raf) return; raf = requestAnimationFrame(function loop() { raf = 0; if (audio.paused || !S.built) return; renderProgress(); raf = requestAnimationFrame(loop); }); }

  // ---- scrubber and volume: thin at rest, swells under the pointer --------------------------------------------------------------------
  function slider(el, opts) {
    var active = false;
    function ratio(e) { var r = el.querySelector(opts.track).getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1); }
    el.addEventListener("pointerdown", function (e) { active = true; el.setPointerCapture(e.pointerId); el.classList.add("is-drag"); opts.move(ratio(e), true); });
    el.addEventListener("pointermove", function (e) { if (active) opts.move(ratio(e), true); });
    function end(e) { if (!active) return; active = false; el.classList.remove("is-drag"); opts.commit(ratio(e)); }
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    el.addEventListener("keydown", function (e) { var k = e.key; if (k === "ArrowRight" || k === "ArrowUp") { e.preventDefault(); opts.step(1); } else if (k === "ArrowLeft" || k === "ArrowDown") { e.preventDefault(); opts.step(-1); } });
  }
  function setVolume(v) { v = clamp(v, 0, 1); audio.volume = v; els.apVolFill.style.transform = "scaleX(" + v + ")"; els.apVol.setAttribute("aria-valuenow", String(Math.round(v * 100))); try { localStorage.setItem(VOL_KEY, String(v)); } catch (e) { /* ignore */ } }

  // ---- open and close: the mini player becomes the sheet, the artwork flies -------------------------------------------------------------
  function expand(fromEl) {
    if (S.expanded || !S.queue.length) return;
    S.expanded = true; clearTimeout(S.hideT);
    full.hidden = false; root.dataset.state = "full"; document.documentElement.classList.add("ap-lock");
    setView("art", true);
    if (!reduce()) {
      var mr = mini.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
      full.animate([{ clipPath: "inset(" + mr.top + "px " + (vw - mr.right) + "px " + (vh - mr.bottom) + "px " + mr.left + "px round 24px)" }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: 560, easing: EASE });
      $(".ap-bg", full).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 460, easing: "ease-out" });
      var src = fromEl && fromEl.getBoundingClientRect ? fromEl : miniArt, r = src.getBoundingClientRect(), t = artWrap.getBoundingClientRect();
      if (r.width > 0 && t.width > 0) artWrap.animate([{ transformOrigin: "0 0", transform: "translate(" + (r.left - t.left) + "px," + (r.top - t.top) + "px) scale(" + (r.width / t.width) + ")" }, { transformOrigin: "0 0", transform: "translate(0,0) scale(1)" }], { duration: 640, easing: EASE });
      $$(".ap-rise", sheet).forEach(function (el, i) { el.animate([{ opacity: 0, transform: "translateY(22px)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: 140 + i * 50, easing: EASE, fill: "backwards" }); });
      $("#apGrabZone").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 200, fill: "backwards" });
    }
    setTimeout(function () { sheet.focus({ preventScroll: true }); }, 60);
    renderProgress();
  }
  function finishClose() { try { full.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); }); } catch (e) { /* older browsers */ } full.hidden = true; S.expanded = false; document.documentElement.classList.remove("ap-lock"); $("#apMenu").hidden = true; sheet.style.transform = ""; sheet.style.opacity = ""; $(".ap-bg", full).style.opacity = ""; }
  function collapse(viaDrag) {
    if (!S.expanded) return;
    S.expanded = false; root.dataset.state = track() ? "mini" : "closed";
    if (reduce()) return finishClose();
    var ease = EASE;
    if (viaDrag) {
      var a = sheet.animate([{ transform: sheet.style.transform || "none", opacity: 1 }, { transform: "translateY(110%)", opacity: 0.4 }], { duration: 300, easing: ease, fill: "forwards" });
      $(".ap-bg", full).animate([{ opacity: parseFloat($(".ap-bg", full).style.opacity || 1) }, { opacity: 0 }], { duration: 300, fill: "forwards" });
      a.onfinish = finishClose; return;
    }
    var mr = mini.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, r = miniArt.getBoundingClientRect(), t = artWrap.getBoundingClientRect();
    var anim = full.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: "inset(" + mr.top + "px " + (vw - mr.right) + "px " + (vh - mr.bottom) + "px " + mr.left + "px round 24px)" }], { duration: 480, easing: ease, fill: "forwards" });
    if (r.width > 0 && t.width > 0) artWrap.animate([{ transformOrigin: "0 0", transform: "translate(0,0) scale(1)" }, { transformOrigin: "0 0", transform: "translate(" + (r.left - t.left) + "px," + (r.top - t.top) + "px) scale(" + (r.width / t.width) + ")" }], { duration: 480, easing: ease, fill: "forwards" });
    $$(".ap-rise,.ap-compact,.ap-grabzone", sheet).forEach(function (el) { el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }); });
    anim.onfinish = function () { finishClose(); anim.cancel(); $$("*", full).forEach(function (n) { n.getAnimations && n.getAnimations().forEach(function (an) { an.cancel(); }); }); };
  }
  function setView(v, instant) {
    if (v === S.view && !instant) v = "art"; // tapping the active button again returns to the artwork
    S.view = v; root.dataset.view = v;
    $("#apLyricsBtn").setAttribute("aria-pressed", String(v === "lyrics")); $("#apQueueBtn").setAttribute("aria-pressed", String(v === "queue"));
    if (v === "lyrics") { S.active = -1; renderProgress(); }
    if (v === "queue") renderQueue();
  }

  // drag the sheet down to dismiss: it follows the finger and springs back if you let go early
  function dragSetup() {
    var start = null;
    function down(e) {
      if (e.target.closest("button,a,input,.ap-scrub,.ap-vol") && !e.target.closest(".ap-grab")) return;
      if (S.view !== "art" && !e.target.closest(".ap-grabzone,.ap-compact")) return;
      start = { y: e.clientY, t: performance.now(), id: e.pointerId, dy: 0 };
    }
    function move(e) {
      if (!start || e.pointerId !== start.id) return;
      var dy = e.clientY - start.y;
      if (dy < 0) dy = dy / 6; // a little resistance upwards
      if (!S.dragging && Math.abs(dy) > 6) { S.dragging = true; sheet.setPointerCapture && sheet.setPointerCapture(e.pointerId); sheet.style.transition = "none"; }
      if (!S.dragging) return;
      start.dy = dy; sheet.style.transform = "translateY(" + Math.max(dy, -30) + "px)";
      $(".ap-bg", full).style.opacity = String(clamp(1 - dy / (window.innerHeight * 0.9), 0.15, 1));
    }
    function up(e) {
      if (!start) return;
      var v = (start.dy) / Math.max(1, performance.now() - start.t), dy = start.dy; start = null;
      if (!S.dragging) return;
      S.dragging = false; sheet.style.transition = "";
      if (dy > 130 || v > 0.7) collapse(true);
      else { sheet.animate([{ transform: "translateY(" + dy + "px)" }, { transform: "translateY(0)" }], { duration: 460, easing: "cubic-bezier(.34,1.5,.64,1)" }); sheet.style.transform = ""; $(".ap-bg", full).style.opacity = ""; }
    }
    sheet.addEventListener("pointerdown", down); sheet.addEventListener("pointermove", move); sheet.addEventListener("pointerup", up); sheet.addEventListener("pointercancel", up);
  }

  // ---- wiring --------------------------------------------------------------------------------------------------------------------------
  function wire() {
    $("#apMiniOpen").addEventListener("click", function () { expand(); });
    $("#apMiniPlay").addEventListener("click", toggle); $("#apMiniNext").addEventListener("click", function () { next(false); });
    $("#apMiniClose").addEventListener("click", stop);
    $("#apPlay").addEventListener("click", function () { toggle(); bump($("#apPlay")); });
    $("#apPrev").addEventListener("click", prev); $("#apNext").addEventListener("click", function () { next(false); });
    $("#apGrab").addEventListener("click", function () { collapse(false); });
    $("#apLyricsBtn").addEventListener("click", function () { setView("lyrics"); });
    $("#apQueueBtn").addEventListener("click", function () { setView("queue"); });
    els.apShuffle.addEventListener("click", toggleShuffle); els.apRepeat.addEventListener("click", cycleRepeat);
    [els.apFav, els.apCFav].forEach(function (b) { b.addEventListener("click", function () { var t = track(); if (t && window.KL) { KL.store.toggleFav(t.slug); renderTrack(); } }); });
    els.apQueue.addEventListener("click", function (e) { var b = e.target.closest(".ap-q__b"); if (b) { var i = +b.dataset.i; if (i === S.idx) toggle(); else load(i, true); } });
    els.apLangs.addEventListener("click", function (e) { var b = e.target.closest("[data-lang]"); if (b) { S.lang = b.dataset.lang; renderLyrics(); renderProgress(); } });
    els.apLyrics.addEventListener("click", function (e) { var l = e.target.closest(".ap-line"); if (l && audio.duration) { if (S.lineT.length !== S.lines.length) lineTimes(audio.duration); S.userScrolled = false; seek(S.lineT[+l.dataset.i]); } });
    els.apLyrics.addEventListener("wheel", function () { S.userScrolled = true; clearTimeout(S.scrollT); S.scrollT = setTimeout(function () { S.userScrolled = false; }, 2500); }, { passive: true });
    els.apLyrics.addEventListener("touchmove", function () { S.userScrolled = true; clearTimeout(S.scrollT); S.scrollT = setTimeout(function () { S.userScrolled = false; }, 2500); }, { passive: true });
    slider(els.apScrub, {
      track: ".ap-scrub__track",
      move: function (r) { S.scrubbing = true; var d = audio.duration || 0; els.apFill.style.transform = "scaleX(" + r + ")"; els.apCur.textContent = fmt(r * d); els.apLeft.textContent = "-" + fmt(d - r * d); },
      commit: function (r) { S.scrubbing = false; seek(r * (audio.duration || 0)); renderProgress(); },
      step: function (dir) { seek((audio.currentTime || 0) + dir * 10); }
    });
    slider(els.apVol, { track: ".ap-vol__track", move: function (r) { setVolume(r); }, commit: function (r) { setVolume(r); }, step: function (dir) { setVolume(audio.volume + dir * 0.1); } });
    $("#apMore").addEventListener("click", function () {
      var m = els.apMenu, t = track();
      if (!m.hidden) { m.hidden = true; return; }
      m.innerHTML = '<a role="menuitem" href="' + esc(t.href || ("/library/" + encodeURIComponent(t.slug) + "/")) + '">Open the book</a><button type="button" role="menuitem" data-m="share">Share</button><button type="button" role="menuitem" data-m="stop">Stop playback</button>';
      m.hidden = false;
      var br = $("#apMore").getBoundingClientRect(), sr = sheet.getBoundingClientRect();
      m.style.top = (br.bottom - sr.top + 8) + "px"; m.style.right = Math.max(10, sr.right - br.right) + "px";
    });
    els.apMenu.addEventListener("click", function (e) {
      var b = e.target.closest("[data-m]"); var t = track(); if (!b) return; els.apMenu.hidden = true;
      if (b.dataset.m === "stop") stop();
      if (b.dataset.m === "share") { var url = location.origin + (t.href || "/library/" + encodeURIComponent(t.slug) + "/"); if (navigator.share) navigator.share({ title: t.title, url: url }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(url); }
    });
    document.addEventListener("click", function (e) { if (!els.apMenu.hidden && !e.target.closest("#apMenu,#apMore")) els.apMenu.hidden = true; });
    document.addEventListener("keydown", function (e) {
      if (!S.expanded) return;
      var tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "Escape") { if (!els.apMenu.hidden) els.apMenu.hidden = true; else collapse(false); return; }
      if (tag === "input" || tag === "textarea") return;
      if (e.key === " " && !e.target.closest("button,[role=slider]")) { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight" && !e.target.closest("[role=slider]")) seek((audio.currentTime || 0) + 10);
      else if (e.key === "ArrowLeft" && !e.target.closest("[role=slider]")) seek((audio.currentTime || 0) - 10);
    });
    // keep Tab inside the open sheet
    full.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = $$("button:not([disabled]),a[href],[tabindex='0']", sheet).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    dragSetup();
    var vol = 1; try { var v = parseFloat(localStorage.getItem(VOL_KEY)); if (isFinite(v)) vol = v; } catch (e) { /* ignore */ }
    setVolume(vol);
  }
  function stop() {
    audio.pause(); audio.removeAttribute("src"); audio.load();
    S.queue = []; S.idx = -1; S.original = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    if (S.expanded) { collapse(false); setTimeout(function () { root.dataset.state = "closed"; }, 500); } else root.dataset.state = "closed";
    if ("mediaSession" in navigator) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = "none"; }
  }

  // ---- lock-screen / headset controls -------------------------------------------------------------------------------------------------
  function artPng(t) {
    // a PNG of the album art for the operating system's media controls
    try {
      var a = (t.art && t.art.c1) ? t.art : { c1: "#3c1c4a", c2: "#1a0b24" }, cv = document.createElement("canvas"); cv.width = cv.height = 512;
      var g = cv.getContext("2d"), grad = g.createLinearGradient(0, 0, 512, 512); grad.addColorStop(0, a.c1); grad.addColorStop(1, a.c2);
      g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = "rgba(236,200,100,.85)"; g.lineWidth = 3; g.strokeRect(28, 28, 456, 456); g.strokeStyle = "rgba(236,200,100,.4)"; g.lineWidth = 1.5; g.strokeRect(40, 40, 432, 432);
      g.fillStyle = "#ebca6c"; g.textAlign = "center"; g.font = "600 150px 'Noto Serif Devanagari', serif"; g.fillText("ॐ", 256, 235);
      g.font = "600 34px Georgia, serif";
      var words = String(t.title).split(" "), line = "", y = 330, lines = [];
      words.forEach(function (w) { var test = line ? line + " " + w : w; if (g.measureText(test).width > 380 && line) { lines.push(line); line = w; } else line = test; });
      lines.push(line); lines.slice(0, 3).forEach(function (l, i) { g.fillText(l, 256, y + i * 42); });
      return cv.toDataURL("image/png");
    } catch (e) { return ""; }
  }
  function updateMediaSession() {
    if (!("mediaSession" in navigator) || !window.MediaMetadata) return;
    var t = track(); if (!t) return;
    var src = artPng(t);
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.singer || t.deity || "SanatanSeva", album: t.category || "Library", artwork: src ? [{ src: src, sizes: "512x512", type: "image/png" }] : [] });
    var set = function (a, fn) { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) { /* not supported */ } };
    set("play", function () { play(); }); set("pause", function () { audio.pause(); });
    set("previoustrack", prev); set("nexttrack", function () { next(false); });
    set("seekbackward", function () { seek(audio.currentTime - 10); }); set("seekforward", function () { seek(audio.currentTime + 10); });
    set("seekto", function (d) { if (d && d.seekTime != null) seek(d.seekTime); });
  }
  function updateSessionState() { if ("mediaSession" in navigator) navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing"; }

  // ---- remembering where you were -------------------------------------------------------------------------------------------------------
  function slim(t) { return { slug: t.slug, title: t.title, subtitle: t.subtitle, audioUrl: t.audioUrl, category: t.category, singer: t.singer, deity: t.deity, art: t.art, lyrics: t.lyrics, href: t.href }; }
  function saveSession(force) {
    var t = track(); if (!t) return;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ v: VERSION, tracks: S.queue.slice(0, 40).map(slim), idx: S.idx, time: audio.currentTime || 0, shuffle: S.shuffle, repeat: S.repeat })); } catch (e) { /* storage full or blocked */ }
  }
  function restore() {
    if (S.queue.length) return;
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (!s || s.v !== VERSION || !s.tracks || !s.tracks.length) return;
      build(); S.queue = s.tracks; S.shuffle = !!s.shuffle; S.repeat = s.repeat || "off";
      load(clamp(s.idx || 0, 0, S.queue.length - 1), false, s.time || 0);
      root.dataset.state = "mini";
    } catch (e) { /* a corrupt session is simply ignored */ }
  }
  window.addEventListener("pagehide", function () { saveSession(true); });

  // ---- public API (what the library and the reader call) -------------------------------------------------------------------------------
  window.__smsLibraryAudioPlayer = {
    openTrack: function (t, queue, opts) {
      if (!t || !t.audioUrl) return;
      opts = opts || {}; build();
      var list = (queue && queue.length ? queue : [t]).filter(function (x) { return x && x.audioUrl; });
      var at = -1; list.forEach(function (x, i) { if (x.slug === t.slug) at = i; });
      if (at < 0) { list = [t].concat(list); at = 0; }
      var same = track() && track().slug === t.slug && !opts.force;
      if (!same) { S.shuffle = false; S.original = null; S.queue = list; load(at, opts.autoPlay !== false); }
      else if (opts.autoPlay !== false && audio.paused) play();
      if (opts.expand) expand(opts.from);
    },
    setQueue: function (list) { if (!S.built || !track()) return; var cur = track(); var q = (list || []).filter(function (x) { return x && x.audioUrl; }); var at = q.findIndex(function (x) { return x.slug === cur.slug; }); if (at >= 0) { S.queue = q; S.idx = at; renderQueue(); } },
    syncSession: function () { restore(); },
    expand: expand, collapse: function () { collapse(false); }, toggle: toggle,
    isPlaying: function () { return !audio.paused; }
  };
  document.addEventListener("DOMContentLoaded", function () { /* the DOM is built on first use or restore */ });
})();
