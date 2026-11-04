// Kindle-style reader: real pagination (CSS columns), one or two pages, themes, fonts, margins, brightness, bookmarks, highlights,
// notes, contents, search, read aloud, and a PDF mode for scanned scriptures. Progress and notes live in the shared store.
(function () {
  var root = document.getElementById("kr");
  if (!root || !window.KL) return;
  var KL = window.KL, store = KL.store, esc = KL.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var slug = root.dataset.slug;
  var stage = $("#krStage"), paper = $("#krPaper"), viewport = $("#krViewport"), flow = $("#krFlow");
  var FONTS = {
    serif: '"Newsreader","Noto Serif Devanagari",Georgia,serif',
    sans: '"Inter","Noto Sans Devanagari",system-ui,-apple-system,sans-serif',
    classic: 'Georgia,"Noto Serif Devanagari","Times New Roman",serif'
  };
  var LANG_LABEL = { hindi: "Hindi", english: "English", sanskrit: "Sanskrit", transliteration: "Transliteration" };
  var WPM = 120;

  // ---- state --------------------------------------------------------------------------------------------------------------------
  var P = function (k, d) { return store.pref("r." + k, d); };
  var prefs = {
    theme: P("theme", "sepia"), font: P("font", "serif"), size: Number(P("size", 22)), line: Number(P("line", 1.75)),
    margin: P("margin", "normal"), align: P("align", "left"), spread: P("spread", "auto"), flow: P("flow", "page"), bright: Number(P("bright", 1)), zoom: Number(P("zoom", 1)), fit: P("fit", "width"), immersive: P("immersive", false), wake: P("wake", false)
  };
  function setPref(k, v) { prefs[k] = v; store.setPref("r." + k, v); }
  var S = {
    item: null, mode: "text", lang: "hindi", langs: [], lines: [], stanzas: [], sections: [], cum: [], totalWords: 0,
    lineView: [], views: 1, view: 0, ppv: 1, step: 0, hls: [], pdfPage: 1, pdfTotal: 0, pdfDoc: null, pdfFallback: false, furthest: 0, ready: false,
    aloud: { on: false, idx: 0, paused: false, rate: 1, token: 0 }, selModel: null, editingHl: null
  };

  // ---- small helpers ------------------------------------------------------------------------------------------------------------
  var toastTimer = 0;
  function toast(msg) { var t = $("#krToast"); t.textContent = msg; t.classList.add("is-on"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("is-on"); }, 2000); }
  function debounce2(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).catch(function () { legacy(txt); });
    legacy(txt); return Promise.resolve();
  }
  function legacy(txt) { var ta = document.createElement("textarea"); ta.value = txt; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) { /* ignore */ } ta.remove(); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function isPdf() { return S.mode === "pdf"; }

  // ---- preferences -> page ------------------------------------------------------------------------------------------------------
  function applyPrefs() {
    root.dataset.theme = prefs.theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    var tc = { white: "#ffffff", sepia: "#f4ecd8", dark: "#1d1f23", black: "#000000" }[prefs.theme];
    if (meta) meta.setAttribute("content", tc);
    root.style.setProperty("--rf", FONTS[prefs.font] || FONTS.serif);
    root.style.setProperty("--rs", prefs.size + "px");
    root.style.setProperty("--rl", String(prefs.line));
    root.style.setProperty("--ra", prefs.align);
    $("#krDim").style.opacity = String(clamp(1 - prefs.bright, 0, 0.65));
    root.dataset.flow = prefs.flow;
    $("#krZoomPill").hidden = root.dataset.mode !== "pdf" || S.pdfFallback;
    $$("#krThemes button").forEach(function (b) { b.classList.toggle("is-on", b.dataset.theme === prefs.theme); b.setAttribute("aria-pressed", String(b.dataset.theme === prefs.theme)); });
    [["#krFonts", "font", prefs.font], ["#krFlowSeg", "flow", prefs.flow], ["#krLines", "line", String(prefs.line)], ["#krMargins", "margin", prefs.margin], ["#krAlign", "align", prefs.align], ["#krSpread", "spread", prefs.spread]].forEach(function (g) {
      $$(g[0] + " button").forEach(function (b) { var on = b.dataset[g[1]] === g[2]; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
    });
    $("#krBright").value = prefs.bright; $("#krSize").value = prefs.size;
    $("#krZoomVal").textContent = Math.round(prefs.zoom * 100) + "%";
    $("#krPillVal").textContent = Math.round(prefs.zoom * 100) + "%";
    $$("#krFitSeg button").forEach(function (b) { var on = b.dataset.fit === prefs.fit; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
    $$("#krImmersive button").forEach(function (b) { var on = (b.dataset.imm === "on") === !!prefs.immersive; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
    var fi = $("#krPillFit"); fi.setAttribute("aria-label", prefs.fit === "width" ? "Show the whole page" : "Fit to width"); fi.title = prefs.fit === "width" ? "Showing: fit width. Click for whole page" : "Showing: whole page. Click for fit width";
  }

  // ---- content ------------------------------------------------------------------------------------------------------------------
  function paragraphs(text) {
    return String(text || "").replace(/\r/g, "").split(/\n\s*\n/).map(function (blk) {
      return blk.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    }).filter(function (a) { return a.length; });
  }
  function buildContent() {
    var it = S.item;
    S.lines = []; S.stanzas = []; S.sections = []; S.cum = []; S.totalWords = 0;
    var secs = [];
    if (S.mode === "chapters" && it.structure && it.structure.chapters) {
      it.structure.chapters.forEach(function (c, i) { secs.push({ title: c.title || "Chapter " + (i + 1), text: c.content || c.text || "" }); });
    } else {
      var langs = it.languages || {};
      secs.push({ title: "", text: langs[S.lang] || langs.english || langs.hindi || langs.sanskrit || langs.transliteration || "" });
    }
    secs.forEach(function (sec, si) {
      var st0 = S.stanzas.length;
      paragraphs(sec.text).forEach(function (para) {
        var from = S.lines.length;
        para.forEach(function (t) { S.lines.push({ t: t, st: S.stanzas.length, sec: si }); });
        S.stanzas.push({ from: from, to: S.lines.length - 1, sec: si });
      });
      S.sections.push({ title: sec.title, firstStanza: st0 });
    });
    var run = 0;
    S.lines.forEach(function (l) { S.cum.push(run); run += l.t.split(/\s+/).filter(Boolean).length; });
    S.totalWords = run;
  }
  function activeHls() { return S.hls.filter(function (h) { return h.type === "highlight" && h.lang === S.lang; }); }
  function lineHtml(i) {
    var text = S.lines[i].t, segs = [];
    activeHls().forEach(function (h) {
      if (i < h.s.l || i > h.e.l) return;
      var a = i === h.s.l ? h.s.o : 0, b = i === h.e.l ? h.e.o : text.length;
      if (b > a) segs.push([a, b, h]);
    });
    if (!segs.length) return esc(text);
    segs.sort(function (x, y) { return x[0] - y[0]; });
    var out = "", pos = 0;
    segs.forEach(function (sg) {
      var a = Math.max(sg[0], pos), b = sg[1];
      if (b <= a) return;
      out += esc(text.slice(pos, a)) + '<mark class="kr-hl kr-hl--' + esc(sg[2].color) + (sg[2].note ? " has-note" : "") + '" data-hid="' + esc(sg[2].id) + '">' + esc(text.slice(a, b)) + "</mark>";
      pos = b;
    });
    return out + esc(text.slice(pos));
  }
  function titleActs() {
    var it = S.item, h = '<div class="kr-title__acts">';
    if (it.audio_url) h += '<button type="button" class="kr-pill kr-pill--primary" data-act="listen">' + MENU_ICON.listen + 'Listen</button>';
    if ("speechSynthesis" in window) h += '<button type="button" class="kr-pill" data-act="aloud">Read aloud</button>';
    return h + '<button type="button" class="kr-pill" data-act="start">Start reading →</button></div>';
  }
  function openListen() {
    var tr = buildAudioTrackFromItem(S.item);
    if (tr) libraryAudioPlayer.openTrack(tr, [tr], { expand: false, autoPlay: true });
  }
  function renderFlow() {
    var it = S.item, label = KL.TYPE_LABEL[it.category] || it.category || "";
    var h = '<header class="kr-title"><small>' + esc(label) + "</small><h2 class=\"kr-h1\">" + esc(it.name) + "</h2>" + (it.deity ? "<i>" + esc(it.deity) + "</i>" : "") + (it.singer ? "<em>Sung by " + esc(it.singer) + "</em>" : "") + '<span class="kr-orn" aria-hidden="true">❖</span>' + titleActs() + "</header>";
    var cur = -1;
    S.stanzas.forEach(function (st, n) {
      if (st.sec !== cur) {
        if (cur >= 0) h += "</section>";
        cur = st.sec;
        h += '<section class="kr-sec" data-sec="' + cur + '">' + (S.sections[cur].title ? '<h2 class="kr-sec__t">' + esc(S.sections[cur].title) + "</h2>" : "");
      }
      h += '<p class="kr-st" data-st="' + n + '">';
      for (var i = st.from; i <= st.to; i++) h += '<span class="kr-line" data-l="' + i + '">' + lineHtml(i) + "</span>";
      h += "</p>";
    });
    if (cur >= 0) h += "</section>";
    if (!S.lines.length) h += '<p class="kr-empty">There is no text in this language yet.</p>';
    flow.innerHTML = h;
  }
  function refreshLines(from, to) {
    for (var i = from; i <= to; i++) { var el = flow.querySelector('[data-l="' + i + '"]'); if (el) el.innerHTML = lineHtml(i); }
  }

  // ---- layout / pagination ------------------------------------------------------------------------------------------------------
  function marginPx(sw) {
    var small = sw < 640;
    return ({ narrow: small ? 16 : 26, normal: small ? 24 : 46, wide: small ? 40 : 84 })[prefs.margin] || 40;
  }
  function currentAnchor() {
    if (prefs.flow === "scroll") {
      var top = viewport.scrollTop + 8, best = 0;
      var els = flow.querySelectorAll(".kr-line");
      for (var i = 0; i < els.length; i++) { if (els[i].offsetTop >= top) { best = +els[i].dataset.l; break; } best = +els[i].dataset.l; }
      return best;
    }
    if (S.view === 0) return -1; // still on the title page
    for (var j = 0; j < S.lineView.length; j++) if (S.lineView[j] >= S.view) return j;
    return 0;
  }
  function layout(anchor) {
    if (isPdf()) return;
    if (anchor == null) anchor = S.ready ? currentAnchor() : 0;
    var cs = getComputedStyle(stage);
    var sw = stage.clientWidth, sh = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var small = sw < 700, m = marginPx(sw), vpad = small ? 20 : Math.max(26, m * 0.7);
    if (prefs.flow === "scroll") {
      S.ppv = 1; root.dataset.ppv = "1";
      var pw = Math.min(sw - (small ? 0 : 40), 760);
      paper.style.width = pw + "px"; paper.style.height = sh + "px";
      viewport.style.cssText = "width:" + (pw - m * 2) + "px;height:" + (sh - vpad) + "px;overflow-y:auto;overflow-x:hidden";
      flow.style.cssText = "column-width:auto;column-count:auto;height:auto;width:100%;transform:none";
      S.views = 1; S.view = 0; S.step = 0;
      measureLines(); updateChrome(); goToLine(Math.max(0, anchor), false);
      return;
    }
    S.ppv = sw >= 1000 && prefs.spread !== "single" ? 2 : 1; root.dataset.ppv = String(S.ppv);
    var maxW = S.ppv === 2 ? 1180 : 780;
    var pwd = Math.min(sw - (small ? 0 : 48), maxW);
    var ph = sh - (small ? 0 : 14);
    var gap = S.ppv === 2 ? m * 1.6 : 0;
    var W = pwd - m * 2, colW = (W - gap * (S.ppv - 1)) / S.ppv;
    paper.style.width = pwd + "px"; paper.style.height = ph + "px";
    viewport.style.cssText = "width:" + W + "px;height:" + (ph - vpad * 2) + "px;overflow:hidden";
    flow.style.cssText = "height:" + (ph - vpad * 2) + "px;width:" + W + "px;column-width:" + colW + "px;column-gap:" + gap + "px;column-fill:auto;transform:none;transition:none";
    S.step = W + gap;
    void flow.offsetWidth;
    S.views = Math.max(1, Math.ceil((flow.scrollWidth + gap) / S.step - 0.01));
    measureLines();
    S.view = anchor < 0 ? 0 : clamp(viewOfLine(anchor), 0, S.views - 1); // a negative anchor means "open at the very start"
    setTranslate(false);
    updateChrome();
  }
  function measureLines() {
    S.lineView = [];
    var base = flow.getBoundingClientRect().left;
    var els = flow.querySelectorAll(".kr-line");
    for (var i = 0; i < els.length; i++) {
      var x = els[i].getBoundingClientRect().left - base;
      S.lineView[+els[i].dataset.l] = S.step ? Math.max(0, Math.floor((x + 2) / S.step)) : 0;
    }
  }
  function viewOfLine(i) { return S.lineView[clamp(i, 0, Math.max(0, S.lineView.length - 1))] || 0; }
  function setTranslate(animate) {
    flow.style.transition = animate ? "transform .34s cubic-bezier(.3,.8,.3,1)" : "none";
    flow.style.transform = "translateX(" + (-S.view * S.step) + "px)";
  }
  // kind: "turn" (a page turn: counts as reading), "jump" (slider, contents, search: does not), "return" (back to the furthest page)
  function goView(v, animate, kind) {
    v = clamp(v, 0, S.views - 1);
    if (v === S.view && animate !== "force") { updateChrome(); return; }
    kind = kind || "jump";
    S.view = v; setTranslate(animate !== false);
    if (kind === "turn" && v + 1 > S.furthest && v + 1 - S.furthest <= 2) S.furthest = v + 1;
    if (kind === "jump") offerReturn(v + 1);
    updateChrome(); persistSoon();
  }
  function goToLine(i, animate) {
    i = clamp(i, 0, Math.max(0, S.lines.length - 1));
    if (prefs.flow === "scroll") {
      var el = flow.querySelector('[data-l="' + i + '"]');
      if (el) viewport.scrollTo({ top: Math.max(0, el.offsetTop - 16), behavior: animate === false ? "auto" : "smooth" });
      updateChrome(); return;
    }
    goView(viewOfLine(i), animate);
  }
  function next(fromTap) { if (isPdf()) return pdfGo(1); if (prefs.flow === "scroll") { viewport.scrollBy({ top: viewport.clientHeight * 0.85, behavior: "smooth" }); return; } if (S.view >= S.views - 1) { toast(store.status(slug) === "finished" ? "You have reached the end" : "You have reached the end"); finishedCheck(); return; } goView(S.view + 1, undefined, "turn"); if (fromTap && prefs.immersive) setChrome(false); }
  function prev(fromTap) { if (isPdf()) return pdfGo(-1); if (prefs.flow === "scroll") { viewport.scrollBy({ top: -viewport.clientHeight * 0.85, behavior: "smooth" }); return; } if (S.view <= 0) return; goView(S.view - 1, undefined, "turn"); if (fromTap && prefs.immersive) setChrome(false); }

  // ---- chrome: progress, labels -------------------------------------------------------------------------------------------------
  var dwellTimer = 0;
  function pctNow() {
    if (isPdf()) return S.pdfTotal > 1 ? clamp(((Math.max(S.furthest, 1) - 1) / (S.pdfTotal - 1)) * 100, 0, 100) : 0;
    if (prefs.flow === "scroll") { var max = Math.max(1, viewport.scrollHeight - viewport.clientHeight); return clamp(viewport.scrollTop / max * 100, 0, 100); }
    if (S.views <= 1) { var p = store.progress(slug); return p && p.finished ? 100 : (p ? p.pct || 0 : 0); }
    return clamp(S.view / (S.views - 1) * 100, 0, 100);
  }
  function updateChrome() {
    var slider = $("#krSlider"), loc = $("#krLoc"), pct = $("#krPct"), left = $("#krLeft");
    var p = Math.round(pctNow());
    if (isPdf()) {
      slider.max = Math.max(1, S.pdfTotal || 1); slider.min = 1; slider.value = S.pdfPage; slider.disabled = !S.pdfTotal || S.pdfFallback;
      loc.textContent = "Page " + S.pdfPage + (S.pdfTotal ? " of " + S.pdfTotal : ""); pct.textContent = S.pdfTotal ? (store.status(slug) === "finished" ? "Finished" : p + "% read") : ""; left.textContent = S.pdfTotal && S.furthest > 1 ? "Read to page " + S.furthest : "";
    } else if (prefs.flow === "scroll") {
      slider.min = 0; slider.max = 100; slider.value = p; slider.disabled = false;
      loc.textContent = "Scrolling"; pct.textContent = p + "%";
      var remW = S.totalWords * (1 - p / 100); left.textContent = timeLeft(remW);
    } else {
      slider.min = 0; slider.max = Math.max(0, S.views - 1); slider.value = S.view; slider.disabled = S.views <= 1;
      loc.textContent = "Page " + (S.view + 1) + " of " + S.views;
      var st = store.status(slug);
      pct.textContent = st === "finished" ? "Finished" : p + "%";
      var a = currentAnchor(); left.textContent = timeLeft(S.totalWords - (a > 0 ? S.cum[a] || 0 : 0));
    }
    $("#krTopProgress").style.width = clamp(p, 0, 100) + "%";
    // a small tick on the slider marks the furthest page you have read
    var far = $("#krFar"), span = isPdf() ? (S.pdfTotal - 1) : (S.views - 1), cur = isPdf() ? S.pdfPage : S.view + 1;
    if (far && prefs.flow === "page" || far && isPdf()) {
      var showFar = span > 0 && S.furthest > 1 && Math.abs(S.furthest - cur) > 0;
      far.hidden = !showFar;
      if (showFar) { far.style.left = "calc(4px + (100% - 8px) * " + clamp((S.furthest - 1) / span, 0, 1).toFixed(4) + ")"; far.title = "Furthest read: page " + S.furthest; }
    } else if (far) far.hidden = true;
    $("#krArrowPrev").disabled = !isPdf() && prefs.flow === "page" && S.view <= 0;
    $("#krArrowNext").disabled = !isPdf() && prefs.flow === "page" && S.view >= S.views - 1;
    $("#krPrev").disabled = $("#krArrowPrev").disabled; $("#krNext").disabled = $("#krArrowNext").disabled;
    syncBookmarkBtn();
  }
  function timeLeft(words) { var m = Math.ceil(Math.max(0, words) / WPM); return S.totalWords ? (m <= 1 ? "Less than a minute left" : m + " min left") : ""; }
  var persistSoon = debounce2(function () {
    if (!S.item) return;
    var pct = pctNow();
    var patch = { pct: Math.round(pct * 10) / 10, anchor: isPdf() ? 0 : Math.max(0, currentAnchor()), lang: S.lang, mode: S.mode, pdfPage: S.pdfPage, pdfTotal: S.pdfTotal || undefined, furthest: S.furthest, views: isPdf() ? undefined : S.views, flow: prefs.flow };
    // "finished" means you read through to the end, not that you dragged the slider there
    if (isPdf()) patch.pct = S.pdfTotal && S.furthest >= S.pdfTotal - 1 ? 100 : patch.pct;
    else if (prefs.flow === "page" && S.views > 1 && S.view >= S.views - 1 && S.furthest >= S.views - 1) patch.pct = 100;
    else if (prefs.flow === "page" && S.views > 1 && patch.pct >= 99.5) patch.pct = Math.min(patch.pct, 99);
    store.touch(slug, patch);
    clearTimeout(dwellTimer);
    // a one-page text counts as read after a short pause on it
    if (!isPdf() && S.views <= 1 && store.status(slug) !== "finished") dwellTimer = setTimeout(function () { store.touch(slug, { pct: 100 }); updateChrome(); }, 9000);
    updateChrome();
  }, 350);
  function finishedCheck() { persistSoon(); }

  function setChrome(on) {
    root.dataset.chrome = on ? "on" : "off";
    if (!on) closeAll();
  }

  // ---- bookmarks ----------------------------------------------------------------------------------------------------------------
  function viewLineRange() {
    if (prefs.flow === "scroll") { var a = currentAnchor(); return [a, Math.min(S.lines.length - 1, a + 12)]; }
    var lo = Infinity, hi = -1;
    S.lineView.forEach(function (v, i) { if (v === S.view) { lo = Math.min(lo, i); hi = Math.max(hi, i); } });
    return hi < 0 ? [0, 0] : [lo, hi];
  }
  function pageBookmarks() {
    if (isPdf()) return S.hls.filter(function (n) { return n.type === "bookmark" && n.mode === "pdf" && n.page === S.pdfPage; });
    var r = viewLineRange();
    return S.hls.filter(function (n) { return n.type === "bookmark" && n.mode !== "pdf" && n.lang === S.lang && n.anchor >= r[0] && n.anchor <= r[1]; });
  }
  function syncBookmarkBtn() {
    var b = $("#krBtnBookmark"); if (!S.item) return;
    var on = pageBookmarks().length > 0;
    b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on));
  }
  function toggleBookmark() {
    var have = pageBookmarks();
    if (have.length) { have.forEach(function (n) { store.removeNote(slug, n.id); }); toast("Bookmark removed"); }
    else if (isPdf()) { store.addNote(slug, { type: "bookmark", mode: "pdf", page: S.pdfPage, label: "Page " + S.pdfPage }); toast("Bookmarked page " + S.pdfPage); }
    else { var r = viewLineRange(); var lbl = (S.lines[r[0]] || {}).t || ""; store.addNote(slug, { type: "bookmark", lang: S.lang, anchor: r[0], label: lbl.slice(0, 90), text: lbl.slice(0, 90) }); toast("Bookmarked"); }
    loadNotes(); syncBookmarkBtn(); renderDrawer();
  }
  function loadNotes() { S.hls = store.notesOf(slug); $("#krBmCount").textContent = S.hls.filter(function (n) { return n.type === "bookmark"; }).length || ""; $("#krNoteCount").textContent = S.hls.filter(function (n) { return n.type === "highlight"; }).length || ""; }

  // ---- furthest read, and the way back to it --------------------------------------------------------------------------------------
  var returnTimer = 0;
  function showReturn(target, text) {
    var b = $("#krReturn"); b.dataset.target = String(target); b.textContent = text; b.hidden = false;
    clearTimeout(returnTimer); returnTimer = setTimeout(function () { b.hidden = true; }, 12000);
  }
  // after jumping somewhere far from where you had read to, offer a one-tap way back
  function offerReturn(landed) {
    if (S.furthest > 1 && Math.abs(S.furthest - landed) > 3) showReturn(S.furthest, "↩ Back to page " + S.furthest + " (furthest read)");
    else $("#krReturn").hidden = true;
  }
  function goFurthest(target) {
    $("#krReturn").hidden = true;
    if (isPdf()) pdfTo(target, "return"); else goView(target - 1, true, "return");
  }
  $("#krReturn").addEventListener("click", function () { goFurthest(+this.dataset.target); });
  function markReadHere() {
    S.furthest = isPdf() ? S.pdfPage : S.view + 1;
    $("#krReturn").hidden = true; updateChrome(); persistSoon();
    toast("Marked as read up to page " + S.furthest);
  }

  // ---- panels -------------------------------------------------------------------------------------------------------------------
  var panels = ["#krAa", "#krDrawer", "#krSearch", "#krMenu"];
  function closeAll(except) {
    panels.forEach(function (sel) { if (sel !== except) { var p = $(sel); if (!p.hidden) { p.hidden = true; } } });
    $("#krScrim").hidden = true; $("#krBtnMore").setAttribute("aria-expanded", "false");
    hideSel();
  }
  function openPanel(sel, focusSel) {
    var p = $(sel), wasOpen = !p.hidden;
    closeAll(sel);
    if (wasOpen) { p.hidden = true; $("#krScrim").hidden = true; return false; }
    p.hidden = false; $("#krScrim").hidden = false; $("#krScrim").classList.toggle("is-dim", sel === "#krDrawer"); root.dataset.chrome = "on";
    if (focusSel) { var f = $(focusSel); if (f) setTimeout(function () { f.focus(); }, 40); }
    return true;
  }
  $("#krScrim").addEventListener("click", function () { closeAll(); });

  // display settings events
  $("#krBtnAa").addEventListener("click", function () { openPanel("#krAa"); });
  $$("[data-aatab]").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("[data-aatab]").forEach(function (x) { x.classList.toggle("is-on", x === b); x.setAttribute("aria-selected", String(x === b)); });
      $$("[data-aapane]").forEach(function (p) { p.hidden = p.dataset.aapane !== b.dataset.aatab; });
    });
  });
  function relayout() { applyPrefs(); layout(); }
  $("#krThemes").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; setPref("theme", b.dataset.theme); applyPrefs(); });
  $("#krBright").addEventListener("input", function (e) { setPref("bright", Number(e.target.value)); applyPrefs(); });
  $("#krSize").addEventListener("input", function (e) { setPref("size", Number(e.target.value)); relayout(); });
  $("#krSmaller").addEventListener("click", function () { setPref("size", clamp(prefs.size - 2, 16, 36)); relayout(); });
  $("#krLarger").addEventListener("click", function () { setPref("size", clamp(prefs.size + 2, 16, 36)); relayout(); });
  function seg(id, key, attr) { $(id).addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; var v = b.dataset[attr]; setPref(key, key === "line" ? Number(v) : v); relayout(); }); }
  seg("#krFonts", "font", "font"); seg("#krLines", "line", "line"); seg("#krMargins", "margin", "margin"); seg("#krAlign", "align", "align"); seg("#krSpread", "spread", "spread");
  $("#krFlowSeg").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; var a = currentAnchor(); setPref("flow", b.dataset.flow); applyPrefs(); if (isPdf()) { pdfRerender(); return; } layout(a); });
  $("#krImmersive").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; setPref("immersive", b.dataset.imm === "on"); applyPrefs(); });
  $("#krKeys").addEventListener("click", function (e) { if (e.target === $("#krKeys") || e.target.closest('[data-keys="close"]')) $("#krKeys").hidden = true; });
  $("#krPeekShow").addEventListener("click", function () { setChrome(true); });
  $("#krLangs").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setLanguage(b.dataset.lang); });

  // ---- contents / bookmarks / notes drawer --------------------------------------------------------------------------------------
  var drawerTab = "toc";
  $("#krBtnContents").addEventListener("click", function () { if (openPanel("#krDrawer")) renderDrawer(); });
  $$("[data-dtab]").forEach(function (b) { b.addEventListener("click", function () { drawerTab = b.dataset.dtab; renderDrawer(); }); });
  function snippet(t, n) { t = String(t || ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; }
  function renderDrawer() {
    if ($("#krDrawer").hidden) return;
    $$("[data-dtab]").forEach(function (b) { var on = b.dataset.dtab === drawerTab; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); });
    var body = $("#krDrawerBody"), h = "";
    if (drawerTab === "toc") {
      if (isPdf()) {
        var ch = (S.item.structure && S.item.structure.chapters) || [];
        h = '<p class="kr-hint">Scanned pages. Use the slider to move through the book.</p>' + (S.pdfTotal ? '<form class="kr-goto" data-goto><label>Go to page <input type="number" min="1" max="' + S.pdfTotal + '" value="' + S.pdfPage + '"></label><button class="kr-btn kr-btn--primary" type="submit">Go</button></form>' : "") +
          ch.map(function (c) { return '<button type="button" class="kr-li" data-pdfpage="' + esc(c.page || 1) + '"><b>' + esc(c.title) + "</b><span>Page " + esc(c.page || 1) + "</span></button>"; }).join("");
      } else if (S.sections.length > 1) {
        h = S.sections.map(function (s, i) { var l = S.stanzas[s.firstStanza]; return '<button type="button" class="kr-li" data-line="' + (l ? l.from : 0) + '"><b>' + esc(s.title || "Part " + (i + 1)) + "</b><span>Page " + (viewOfLine(l ? l.from : 0) + 1) + "</span></button>"; }).join("");
      } else {
        h = '<button type="button" class="kr-li" data-line="0"><b>Beginning</b><span>Title page</span></button>' + S.stanzas.map(function (st, n) {
          return '<button type="button" class="kr-li" data-line="' + st.from + '"><b>Verse ' + (n + 1) + "</b><span>" + esc(snippet(S.lines[st.from].t, 54)) + "</span></button>";
        }).join("");
      }
    } else if (drawerTab === "bookmarks") {
      var bms = S.hls.filter(function (n) { return n.type === "bookmark"; });
      var farRow = S.furthest > 1 ? '<div class="kr-li kr-li--row kr-li--far"><button type="button" data-far="' + S.furthest + '"><b>Furthest read · page ' + S.furthest + "</b><span>Where your reading has reached" + (S.furthest !== (isPdf() ? S.pdfPage : S.view + 1) ? " · tap to go there" : " · you are here") + '</span></button></div>' : "";
      h = farRow + (bms.length ? bms.map(function (n) { return '<div class="kr-li kr-li--row"><button type="button" data-bm="' + esc(n.id) + '"><b>' + esc(n.mode === "pdf" ? "Page " + n.page : snippet(n.label || n.text, 60)) + "</b><span>" + esc(KL.relTime(n.at)) + '</span></button><button type="button" class="kr-x" data-delnote="' + esc(n.id) + '" aria-label="Delete bookmark">✕</button></div>'; }).join("")
        : (farRow ? "" : '<p class="kr-hint">No bookmarks yet. Tap the ribbon at the top to save your place.</p>'));
    } else {
      var hl = S.hls.filter(function (n) { return n.type === "highlight"; });
      h = hl.length ? hl.map(function (n) { return '<div class="kr-li kr-li--row kr-li--note" style="--hl:var(--hl-' + esc(n.color) + ')"><button type="button" data-hlgo="' + esc(n.id) + '"><b>' + esc(snippet(n.text, 110)) + "</b>" + (n.note ? "<em>" + esc(snippet(n.note, 120)) + "</em>" : "") + "<span>" + esc((LANG_LABEL[n.lang] || "") + " · " + KL.relTime(n.at)) + '</span></button><button type="button" class="kr-x" data-delnote="' + esc(n.id) + '" aria-label="Delete highlight">✕</button></div>'; }).join("")
        : '<p class="kr-hint">Select any text to highlight it or add a note.</p>';
    }
    body.innerHTML = h;
  }
  $("#krDrawer").addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-close]")) { closeAll(); return; }
    var li = t.closest("[data-line]"); if (li) { closeAll(); goToLine(+li.dataset.line); flashLine(+li.dataset.line); return; }
    var fr = t.closest("[data-far]"); if (fr) { closeAll(); goFurthest(+fr.dataset.far); return; }
    var pp = t.closest("[data-pdfpage]"); if (pp) { closeAll(); pdfTo(+pp.dataset.pdfpage); return; }
    var bm = t.closest("[data-bm]"); if (bm) { var n = S.hls.filter(function (x) { return x.id === bm.dataset.bm; })[0]; closeAll(); if (n) { if (n.mode === "pdf") pdfTo(n.page); else { if (n.lang && n.lang !== S.lang) setLanguage(n.lang, n.anchor); else goToLine(n.anchor); flashLine(n.anchor); } } return; }
    var hg = t.closest("[data-hlgo]"); if (hg) { jumpToNote(hg.dataset.hlgo); closeAll(); return; }
    var dn = t.closest("[data-delnote]"); if (dn) { store.removeNote(slug, dn.dataset.delnote); loadNotes(); refreshAllLines(); renderDrawer(); syncBookmarkBtn(); return; }
  });
  $("#krDrawer").addEventListener("submit", function (e) { var f = e.target.closest("[data-goto]"); if (!f) return; e.preventDefault(); closeAll(); pdfTo(+f.querySelector("input").value); });
  function refreshAllLines() { if (S.lines.length) refreshLines(0, S.lines.length - 1); }
  function flashLine(i) { var el = flow.querySelector('[data-l="' + i + '"]'); if (!el) return; el.classList.remove("kr-flash"); void el.offsetWidth; el.classList.add("kr-flash"); setTimeout(function () { el.classList.remove("kr-flash"); }, 1800); }
  function jumpToNote(id) {
    var n = S.hls.filter(function (x) { return x.id === id; })[0]; if (!n) return;
    if (n.mode === "pdf") return pdfTo(n.page);
    if (n.lang && n.lang !== S.lang) { setLanguage(n.lang, n.type === "highlight" ? n.s.l : n.anchor); return; }
    var line = n.type === "highlight" ? n.s.l : n.anchor; goToLine(line, false); flashLine(line);
  }

  // ---- search -------------------------------------------------------------------------------------------------------------------
  $("#krBtnSearch").addEventListener("click", function () { if (openPanel("#krSearch", "#krSearchInput")) { $("#krSearchInput").select(); } });
  $("#krSearch").addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) { closeAll(); return; }
    var r = e.target.closest("[data-sline]"); if (r) { closeAll(); goToLine(+r.dataset.sline); flashLine(+r.dataset.sline); }
  });
  $("#krSearchInput").addEventListener("input", debounce2(function () {
    var q = $("#krSearchInput").value.trim().toLowerCase(), box = $("#krSearchRes");
    if (isPdf()) { box.innerHTML = '<p class="kr-hint">Searching inside scanned pages is not available. Use the contents or jump to a page number.</p>'; return; }
    if (q.length < 2) { box.innerHTML = ""; return; }
    var hits = [];
    S.lines.forEach(function (l, i) { var at = l.t.toLowerCase().indexOf(q); if (at >= 0) hits.push([i, at]); });
    box.innerHTML = hits.length ? '<p class="kr-hint">' + hits.length + " result" + (hits.length > 1 ? "s" : "") + "</p>" + hits.slice(0, 60).map(function (h) {
      var l = S.lines[h[0]].t, s = Math.max(0, h[1] - 24), e = Math.min(l.length, h[1] + q.length + 40);
      return '<button type="button" class="kr-li" data-sline="' + h[0] + '"><span>Page ' + (prefs.flow === "scroll" ? "—" : viewOfLine(h[0]) + 1) + "</span><b>" + (s > 0 ? "…" : "") + esc(l.slice(s, h[1])) + "<mark>" + esc(l.slice(h[1], h[1] + q.length)) + "</mark>" + esc(l.slice(h[1] + q.length, e)) + (e < l.length ? "…" : "") + "</b></button>";
    }).join("") : '<p class="kr-hint">No matches for “' + esc(q) + "”.</p>";
  }, 160));

  // ---- more menu ----------------------------------------------------------------------------------------------------------------
  var MENU_ICON = (function () {
    var w = function (d) { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>"; };
    return {
      listen: w('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4.5" height="7" rx="1.6"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.6"/>'),
      search: w('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
      play: w('<path d="M8 5.5v13l11-6.5z"/>'),
      swap: w('<path d="M7 7h12l-3-3M17 17H5l3 3"/>'),
      flag: w('<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>'),
      heart: w('<path d="M12 20.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.5 2.3c0 5.4-7.5 10-7.5 10z"/>'),
      check: w('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
      copy: w('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
      share: w('<path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>'),
      full: w('<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>'),
      sun: w('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/>'),
      keys: w('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8"/>'),
      down: w('<path d="M12 4v11M8 11l4 4 4-4M5 19h14"/>'),
      home: w('<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>')
    };
  })();
  function menuItems() {
    var it = S.item, st = store.status(slug), m = [];
    if (it.audio_url) m.push(["listen", "Listen to the audio", "listen"]);
    m.push(["search", "Search in this book", "search"]);
    if ("speechSynthesis" in window && !isPdf() && S.lines.length) m.push(["aloud", S.aloud.on ? "Stop reading aloud" : "Read aloud", "play"]);
    if (it.content_type === "pdf" && it.structure && it.structure.chapters) m.push(["mode", isPdf() ? "Switch to text chapters" : "Switch to scanned pages", "swap"]);
    if (isPdf() || prefs.flow === "page") m.push(["mark", "Mark read up to here", "flag"]);
    m.push(["fav", store.isFav(slug) ? "Remove from favourites" : "Add to favourites", "heart"]);
    m.push(["done", st === "finished" ? "Mark as unread" : "Mark as finished", "check"]);
    if (!isPdf()) m.push(["copy", "Copy this page", "copy"]);
    m.push(["share", "Share", "share"]);
    m.push(["full", document.fullscreenElement ? "Exit full screen" : "Full screen", "full"]);
    if ("wakeLock" in navigator) m.push(["wake", prefs.wake ? "Let the screen sleep" : "Keep the screen on", "sun"]);
    m.push(["keys", "Keyboard shortcuts", "keys"]);
    if (it.content_type === "pdf") m.push(["pdf", "Open the PDF in a new tab", "down"]);
    m.push(["lib", "Back to library", "home"]);
    return m;
  }
  $("#krBtnListen").addEventListener("click", openListen);
  $("#krBtnMore").addEventListener("click", function () {
    var menu = $("#krMenu");
    if (!menu.hidden) { closeAll(); return; }
    closeAll();
    menu.innerHTML = menuItems().map(function (m) { return '<button type="button" role="menuitem" data-m="' + m[0] + '"><span aria-hidden="true">' + (MENU_ICON[m[2]] || "") + "</span>" + esc(m[1]) + "</button>"; }).join("");
    menu.hidden = false; $("#krScrim").hidden = false; $("#krBtnMore").setAttribute("aria-expanded", "true");
    var f = menu.querySelector("button"); if (f) f.focus();
  });
  $("#krMenu").addEventListener("click", function (e) {
    var b = e.target.closest("[data-m]"); if (!b) return;
    var a = b.dataset.m; closeAll();
    if (a === "listen") openListen();
    if (a === "search") { $("#krBtnSearch").click(); }
    if (a === "keys") { $("#krKeys").hidden = false; }
    if (a === "wake") { setPref("wake", !prefs.wake); applyWake(); toast(prefs.wake ? "The screen will stay on while you read" : "The screen can sleep again"); }
    if (a === "aloud") { S.aloud.on ? aloudStop() : aloudStart(); }
    if (a === "mode") { switchMode(isPdf() ? "chapters" : "pdf"); }
    if (a === "mark") { markReadHere(); }
    if (a === "fav") { var on = store.toggleFav(slug); toast(on ? "Added to Favourites" : "Removed from Favourites"); }
    if (a === "done") { var d = store.status(slug) !== "finished"; store.markFinished(slug, d); updateChrome(); toast(d ? "Marked as finished" : "Marked as unread"); }
    if (a === "copy") { copyText(pageText()).then(function () { toast("Page copied"); }); }
    if (a === "share") { shareText(S.item.name, location.href); }
    if (a === "full") { toggleFull(); }
    if (a === "pdf") { window.open(S.item.pdf_url, "_blank", "noopener"); }
    if (a === "lib") { location.href = root.dataset.back || "/library/"; }
  });
  function pageText() { var r = viewLineRange(), out = []; for (var i = r[0]; i <= r[1]; i++) if (S.lines[i]) out.push(S.lines[i].t); return out.join("\n"); }
  function shareText(text, url) {
    if (navigator.share) navigator.share({ title: S.item.name, text: text, url: url }).catch(function () {});
    else copyText(text + (url ? "\n" + url : "")).then(function () { toast("Copied to clipboard"); });
  }
  function toggleFull() {
    var el = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch (e) { toast("Full screen is not available here"); }
  }

  // ---- selection: highlight / note / copy / share -------------------------------------------------------------------------------
  function pointToLO(node, off, isStart) {
    var el = node.nodeType === 1 ? node : node.parentElement;
    var line = el && el.closest ? el.closest(".kr-line") : null;
    if (!line) {
      if (node.nodeType === 1) {
        var child = isStart ? node.childNodes[off] : node.childNodes[off - 1];
        var l = child && child.nodeType === 1 ? (child.matches(".kr-line") ? child : child.querySelector(".kr-line")) : null;
        if (l) { var idx = +l.dataset.l; return { l: idx, o: isStart ? 0 : S.lines[idx].t.length }; }
      }
      return null;
    }
    var rg = document.createRange(); rg.setStart(line, 0);
    try { rg.setEnd(node, off); } catch (err) { return null; }
    return { l: +line.dataset.l, o: Math.min(rg.toString().length, S.lines[+line.dataset.l].t.length) };
  }
  function selectionModel() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    var r = sel.getRangeAt(0);
    if (!flow.contains(r.commonAncestorContainer)) return null;
    var s = pointToLO(r.startContainer, r.startOffset, true), e = pointToLO(r.endContainer, r.endOffset, false);
    if (!s || !e || (s.l > e.l) || (s.l === e.l && s.o >= e.o)) return null;
    var parts = [];
    for (var i = s.l; i <= e.l; i++) { var t = S.lines[i].t; parts.push(t.slice(i === s.l ? s.o : 0, i === e.l ? e.o : t.length)); }
    var text = parts.join("\n").trim();
    return text ? { s: s, e: e, text: text, rect: r.getBoundingClientRect() } : null;
  }
  function placeSel(rect) {
    var bar = $("#krSel"); bar.hidden = false;
    var w = bar.offsetWidth, h = bar.offsetHeight;
    var x = clamp(rect.left + rect.width / 2 - w / 2, 8, innerWidth - w - 8);
    var y = rect.top - h - 12; if (y < 64) y = rect.bottom + 14;
    bar.style.left = x + "px"; bar.style.top = clamp(y, 8, innerHeight - h - 8) + "px";
  }
  function hideSel() { $("#krSel").hidden = true; S.selModel = null; S.editingHl = null; }
  var onSelChange = debounce2(function () {
    if (S.editingHl) return;
    var m = selectionModel();
    if (!m) { if (!$("#krSel").hidden && !S.editingHl) hideSel(); return; }
    S.selModel = m; $('#krSel [data-sel="delete"]').hidden = true; placeSel(m.rect);
  }, 140);
  document.addEventListener("selectionchange", onSelChange);
  flow.addEventListener("click", function (e) {
    var act = e.target.closest("[data-act]");
    if (act) { var w = act.dataset.act; if (w === "listen") openListen(); else if (w === "aloud") { S.aloud.on ? aloudStop() : aloudStart(); } else next(false); return; }
    var mk = e.target.closest(".kr-hl");
    if (mk) {
      var h = S.hls.filter(function (x) { return x.id === mk.dataset.hid; })[0]; if (!h) return;
      S.editingHl = h; S.selModel = null; $('#krSel [data-sel="delete"]').hidden = false; placeSel(mk.getBoundingClientRect()); e.stopPropagation();
    }
  });
  $("#krSel").addEventListener("mousedown", function (e) { e.preventDefault(); });
  $("#krSel").addEventListener("click", function (e) {
    var sw = e.target.closest("[data-hl]"), act = e.target.closest("[data-sel]");
    if (sw) {
      var color = sw.dataset.hl;
      if (S.editingHl) { store.updateNote(slug, S.editingHl.id, { color: color }); loadNotes(); refreshAllLines(); hideSel(); return; }
      var m = S.selModel; if (!m) return;
      store.addNote(slug, { type: "highlight", lang: S.lang, s: m.s, e: m.e, text: m.text, color: color });
      window.getSelection().removeAllRanges(); loadNotes(); refreshLines(m.s.l, m.e.l); hideSel(); toast("Highlighted"); return;
    }
    if (!act) return;
    var a = act.dataset.sel, text = S.editingHl ? S.editingHl.text : (S.selModel && S.selModel.text) || "";
    if (a === "copy") { copyText("“" + text + "” — " + S.item.name).then(function () { toast("Copied"); }); window.getSelection().removeAllRanges(); hideSel(); }
    if (a === "share") { shareText("“" + text + "” — " + S.item.name, location.origin + location.pathname); window.getSelection().removeAllRanges(); hideSel(); }
    if (a === "delete" && S.editingHl) { var h = S.editingHl; store.removeNote(slug, h.id); loadNotes(); refreshLines(h.s.l, h.e.l); hideSel(); toast("Highlight removed"); }
    if (a === "note") { openNote(); }
  });
  var noteTarget = null;
  function openNote() {
    var m = S.selModel, h = S.editingHl;
    if (!m && !h) return;
    if (!h) {
      h = store.addNote(slug, { type: "highlight", lang: S.lang, s: m.s, e: m.e, text: m.text, color: "yellow" });
      loadNotes(); refreshLines(m.s.l, m.e.l); window.getSelection().removeAllRanges();
    }
    noteTarget = h; hideSel();
    $("#krNoteQuote").textContent = h.text; $("#krNoteText").value = h.note || "";
    $("#krNote").hidden = false; setTimeout(function () { $("#krNoteText").focus(); }, 40);
  }
  $("#krNote").addEventListener("click", function (e) {
    var b = e.target.closest("[data-note]"); if (!b && e.target !== $("#krNote")) return;
    if (b && b.dataset.note === "save" && noteTarget) { store.updateNote(slug, noteTarget.id, { note: $("#krNoteText").value.trim() }); loadNotes(); refreshLines(noteTarget.s.l, noteTarget.e.l); toast("Note saved"); renderDrawer(); }
    $("#krNote").hidden = true; noteTarget = null;
  });

  // ---- language / mode ----------------------------------------------------------------------------------------------------------
  function renderLangButtons() {
    $("#krLangs").innerHTML = S.langs.map(function (l) { return '<button type="button" data-lang="' + l + '" class="' + (l === S.lang ? "is-on" : "") + '" aria-pressed="' + (l === S.lang) + '">' + LANG_LABEL[l] + "</button>"; }).join("");
    $("#krTabLang").hidden = S.langs.length < 2 || isPdf();
  }
  function setLanguage(l, anchorLine) {
    if (!l || l === S.lang && anchorLine == null) return;
    var cur = currentAnchor(), ratio = S.lines.length && cur > 0 ? cur / S.lines.length : 0;
    S.lang = l; store.setPref("r.lang", l);
    aloudStop(); buildContent(); renderFlow(); renderLangButtons();
    layout(anchorLine != null ? clamp(anchorLine, 0, S.lines.length - 1) : (cur < 0 ? -1 : Math.round(ratio * S.lines.length)));
    persistSoon(); renderDrawer();
  }
  function switchMode(mode) {
    S.mode = mode; aloudStop();
    var it = S.item;
    $("#krPdf").hidden = mode !== "pdf"; paper.hidden = mode === "pdf"; root.dataset.mode = mode;
    if (mode === "pdf") { pdfOpen(); }
    else { buildContent(); renderFlow(); renderLangButtons(); layout(-1); }
    applyPrefs(); updateChrome(); renderDrawer();
    $("#krBtnAa").hidden = false;
  }

  // ---- PDF: pages drawn by pdf.js, so the reader always knows which page you are on -----------------------------------------------
  var pdfEl = $("#krPdf"), pdfScroll = $("#krPdfScroll"), pdfPages = $("#krPdfPages"), pdfIO = null, pdfHost = null;
  // zoom 1 = "fit width" (readable text) or "whole page"; on wide screens fit-width stops at about 1000 px so lines stay a sane length
  function pdfBase(vp1) {
    var w = pdfScroll.clientWidth - 28, h = pdfScroll.clientHeight - 28;
    if (prefs.flow === "scroll" || prefs.fit === "width") return Math.max(0.15, Math.min(w, 1000) / vp1.width);
    return Math.max(0.15, Math.min(w / vp1.width, h / vp1.height));
  }
  function pdfDraw(host, n) {
    if (host._busy) return Promise.resolve();
    host._busy = true;
    return S.pdfDoc.getPage(n).then(function (page) {
      var vp1 = page.getViewport({ scale: 1 }), css = pdfBase(vp1) * prefs.zoom, dpr = Math.min(window.devicePixelRatio || 1, 2);
      var px = vp1.width * vp1.height * css * css * dpr * dpr;
      if (px > 16e6) dpr *= Math.sqrt(16e6 / px); // keep very large zooms from exhausting memory
      var vp = page.getViewport({ scale: css * dpr }), cv = document.createElement("canvas");
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      cv.style.width = Math.floor(vp.width / dpr) + "px"; cv.style.height = Math.floor(vp.height / dpr) + "px";
      var task = page.render({ canvasContext: cv.getContext("2d"), viewport: vp });
      host._task = task;
      return task.promise.then(function () {
        host.style.width = cv.style.width; host.style.height = cv.style.height;
        host.replaceChildren(cv); host.classList.add("is-ready");
      });
    }).catch(function () { /* cancelled by a newer page, or a damaged page */ }).then(function () { host._busy = false; });
  }
  function pdfFocusNow() {
    return { fx: (pdfScroll.scrollLeft + pdfScroll.clientWidth / 2) / Math.max(1, pdfScroll.scrollWidth), fy: (pdfScroll.scrollTop + pdfScroll.clientHeight / 2) / Math.max(1, pdfScroll.scrollHeight), px: pdfScroll.clientWidth / 2, py: pdfScroll.clientHeight / 2 };
  }
  function pdfShowOne(n, focus) {
    pdfPages.className = "kr-pdfpages kr-pdfpages--page";
    if (pdfHost && pdfHost._task) { try { pdfHost._task.cancel(); } catch (e) { /* already done */ } }
    var host = document.createElement("div"); host.className = "kr-pdfpage"; host.dataset.p = n; pdfHost = host;
    if (!pdfPages.firstChild) pdfPages.appendChild(host);
    pdfDraw(host, n).then(function () {
      if (pdfHost !== host) return;
      pdfPages.replaceChildren(host);
      if (focus) { pdfScroll.scrollLeft = focus.fx * pdfScroll.scrollWidth - focus.px; pdfScroll.scrollTop = focus.fy * pdfScroll.scrollHeight - focus.py; }
      else if (S.pdfFromBelow) { pdfScroll.scrollTop = pdfScroll.scrollHeight; pdfScroll.scrollLeft = 0; }
      else { pdfScroll.scrollTop = 0; pdfScroll.scrollLeft = 0; }
      S.pdfFromBelow = false;
      pdfReadAhead(n);
    });
  }
  // read the next pages' data in the background, so turning the page is instant even over a slow link
  var aheadTimer = 0;
  function pdfReadAhead(n) {
    clearTimeout(aheadTimer);
    aheadTimer = setTimeout(function () {
      for (var k = 1; k <= 2; k++) {
        if (n + k > S.pdfTotal) break;
        S.pdfDoc.getPage(n + k).then(function (pg) { return pg.getOperatorList(); }).catch(function () {});
      }
    }, 400);
  }
  function pdfBuildScroll(start) {
    pdfPages.className = "kr-pdfpages kr-pdfpages--scroll";
    if (pdfIO) pdfIO.disconnect();
    pdfPages.textContent = "";
    S.pdfDoc.getPage(1).then(function (p1) {
      var vp1 = p1.getViewport({ scale: 1 }), css = pdfBase(vp1) * prefs.zoom, w = Math.floor(vp1.width * css), h = Math.floor(vp1.height * css);
      var frag = document.createDocumentFragment();
      for (var n = 1; n <= S.pdfTotal; n++) { var d = document.createElement("div"); d.className = "kr-pdfpage"; d.dataset.p = n; d.style.width = w + "px"; d.style.height = h + "px"; frag.appendChild(d); }
      pdfPages.appendChild(frag);
      pdfIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var host = e.target;
          if (e.isIntersecting) pdfDraw(host, +host.dataset.p);
          else if (host.classList.contains("is-ready")) { var keepW = host.style.width, keepH = host.style.height; host.textContent = ""; host.classList.remove("is-ready"); host.style.width = keepW; host.style.height = keepH; }
        });
      }, { root: pdfScroll, rootMargin: "120% 0px" });
      Array.prototype.forEach.call(pdfPages.children, function (c) { pdfIO.observe(c); });
      var first = pdfPages.children[Math.max(0, start - 1)];
      if (first) pdfScroll.scrollTop = Math.max(0, first.offsetTop - 14);
    });
  }
  function pdfRerender(focus) {
    if (!S.pdfDoc || S.pdfFallback) return;
    if (prefs.flow === "scroll") pdfBuildScroll(S.pdfPage); else pdfShowOne(S.pdfPage, focus);
  }
  function pdfNote(n, kind) {
    n = clamp(Math.round(n) || 1, 1, S.pdfTotal || 99999);
    var prev = S.pdfPage; S.pdfPage = n;
    // reading forward page by page (or scrolling) moves the furthest-read mark; jumping around does not
    if ((kind === "turn" || kind === "scroll") && n > S.furthest && n - Math.max(prev, S.furthest) <= 3) S.furthest = n;
    if (kind === "jump") offerReturn(n);
    updateChrome(); persistSoon();
  }
  function pdfTo(p, kind) {
    if (!S.pdfDoc && !S.pdfFallback) return; // still opening the book
    var n = clamp(Math.round(p) || 1, 1, S.pdfTotal || 99999);
    pdfNote(n, kind || "jump");
    if (S.pdfFallback) { $("#krPdfFrame").src = S.item.pdf_url + (S.item.pdf_embed ? "" : "#page=" + n + "&toolbar=0&navpanes=0&view=FitH"); return; }
    if (prefs.flow === "scroll") { var host = pdfPages.children[n - 1]; if (host) pdfScroll.scrollTo({ top: Math.max(0, host.offsetTop - 14), behavior: "auto" }); }
    else pdfShowOne(n);
  }
  // a page taller than the screen is read by scrolling down it first; only at its end does the next page come
  function pdfGo(d) {
    if (!S.pdfDoc && !S.pdfFallback) return;
    if (prefs.flow === "scroll" && !S.pdfFallback) { pdfScroll.scrollBy({ top: d * pdfScroll.clientHeight * 0.88, behavior: "smooth" }); return; }
    if (!S.pdfFallback) {
      var room = pdfScroll.scrollHeight - pdfScroll.clientHeight;
      if (d > 0 && room > 12 && pdfScroll.scrollTop < room - 12) { pdfScroll.scrollBy({ top: pdfScroll.clientHeight * 0.88, behavior: "smooth" }); return; }
      if (d < 0 && room > 12 && pdfScroll.scrollTop > 12) { pdfScroll.scrollBy({ top: -pdfScroll.clientHeight * 0.88, behavior: "smooth" }); return; }
    }
    if (S.pdfTotal && S.pdfPage + d > S.pdfTotal) { toast("You have reached the last page"); return; }
    if (d < 0) S.pdfFromBelow = true;
    pdfTo(S.pdfPage + d, "turn");
  }
  var pdfScrollTimer = 0;
  pdfScroll.addEventListener("scroll", function () {
    if (prefs.flow !== "scroll" || S.pdfFallback) return;
    clearTimeout(pdfScrollTimer);
    pdfScrollTimer = setTimeout(function () {
      var r = pdfScroll.getBoundingClientRect(), els = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height * 0.4);
      for (var i = 0; i < els.length; i++) { var h = els[i].closest && els[i].closest(".kr-pdfpage"); if (h) { pdfNote(+h.dataset.p, "scroll"); return; } }
    }, 90);
  }, { passive: true });
  function pdfFallbackFrame() {
    S.pdfFallback = true; var f = $("#krPdfFrame"); f.hidden = false; pdfScroll.hidden = true; $("#krPdfLoad").classList.add("is-done");
    f.src = S.item.pdf_url + (S.item.pdf_embed ? "" : "#page=" + S.pdfPage + "&toolbar=0&navpanes=0&view=FitH");
    updateChrome();
  }
  // pages are fetched in pieces as you read, so a 60 MB book opens straight away
  function pdfOpen() {
    var load = $("#krPdfLoad"); load.classList.remove("is-done");
    if (S.item.pdf_embed) return pdfFallbackFrame();
    KL.loadPdfJs().then(function (lib) {
      // "warm" asks the server to keep a copy of the book while you read, so later pages come from disk
      return lib.getDocument({ url: S.item.pdf_url + (S.item.source === "drive" ? "?warm=1" : ""), rangeChunkSize: 524288, disableAutoFetch: true, disableStream: false }).promise;
    }).then(function (doc) {
      S.pdfDoc = doc; S.pdfTotal = doc.numPages;
      S.pdfPage = clamp(S.pdfPage, 1, S.pdfTotal); S.furthest = clamp(S.furthest || S.pdfPage, 1, S.pdfTotal);
      applyPrefs(); pdfRerender(); load.classList.add("is-done"); updateChrome(); renderDrawer();
      if (!S.item.cover_page) setTimeout(function () { KL.captureCover(S.item.pdf_url, doc); }, 1500);
      if (S.furthest - S.pdfPage > 3) showReturn(S.furthest, "↩ Furthest read: page " + S.furthest);
      persistSoon();
    }).catch(function () { pdfFallbackFrame(); });
  }
  var ZOOMS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4];
  function pdfSetZoom(z, focus) {
    z = clamp(z, ZOOMS[0], ZOOMS[ZOOMS.length - 1]);
    if (Math.abs(z - prefs.zoom) < 0.001) return;
    setPref("zoom", Math.round(z * 100) / 100); applyPrefs(); pdfRerender(focus || pdfFocusNow());
  }
  function pdfZoomStep(dir, focus) {
    var i = 0, best = 9;
    ZOOMS.forEach(function (z, k) { var dd = Math.abs(z - prefs.zoom); if (dd < best) { best = dd; i = k; } });
    pdfSetZoom(ZOOMS[clamp(i + dir, 0, ZOOMS.length - 1)], focus);
  }
  function pdfFit(mode) { setPref("fit", mode); setPref("zoom", 1); applyPrefs(); pdfRerender(); }
  $("#krZoomIn").addEventListener("click", function () { pdfZoomStep(1); });
  $("#krZoomOut").addEventListener("click", function () { pdfZoomStep(-1); });
  $("#krPillIn").addEventListener("click", function () { pdfZoomStep(1); });
  $("#krPillOut").addEventListener("click", function () { pdfZoomStep(-1); });
  $("#krPillVal").addEventListener("click", function () { pdfSetZoom(1); });
  $("#krPillFit").addEventListener("click", function () { pdfFit(prefs.fit === "width" ? "page" : "width"); });
  $("#krFitSeg").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) pdfFit(b.dataset.fit); });
  // double-click / double-tap zooms in on that spot, and back out; Ctrl+scroll (or a trackpad pinch) zooms smoothly
  function pdfFocusAt(clientX, clientY) {
    var r = pdfScroll.getBoundingClientRect(), px = clientX - r.left, py = clientY - r.top;
    return { fx: (pdfScroll.scrollLeft + px) / Math.max(1, pdfScroll.scrollWidth), fy: (pdfScroll.scrollTop + py) / Math.max(1, pdfScroll.scrollHeight), px: px, py: py };
  }
  pdfScroll.addEventListener("dblclick", function (e) { if (S.pdfFallback) return; e.preventDefault(); pdfSetZoom(prefs.zoom > 1.2 ? 1 : 2, pdfFocusAt(e.clientX, e.clientY)); });
  pdfScroll.addEventListener("wheel", function (e) {
    if (!e.ctrlKey || S.pdfFallback) return;
    e.preventDefault();
    pdfSetZoom(prefs.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), pdfFocusAt(e.clientX, e.clientY));
  }, { passive: false });
  // pinch with two fingers: the page scales under your fingers, and is redrawn sharply when you let go
  var pinch = null, lastTap = 0;
  pdfScroll.addEventListener("touchstart", function (e) {
    if (S.pdfFallback) return;
    if (e.touches.length === 2) {
      var a = e.touches[0], b = e.touches[1];
      pinch = { d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2, scale: 1 };
      var r = pdfPages.getBoundingClientRect(); pdfPages.style.transformOrigin = (pinch.cx - r.left) + "px " + (pinch.cy - r.top) + "px";
    }
  }, { passive: true });
  pdfScroll.addEventListener("touchmove", function (e) {
    if (!pinch || e.touches.length !== 2) return;
    var a = e.touches[0], b = e.touches[1];
    pinch.scale = clamp(Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d0, 0.4, 4);
    pdfPages.style.transform = "scale(" + pinch.scale + ")";
  }, { passive: true });
  pdfScroll.addEventListener("touchend", function (e) {
    if (pinch && e.touches.length < 2) {
      var p = pinch; pinch = null; pdfPages.style.transform = ""; pdfPages.style.transformOrigin = "0 0";
      if (Math.abs(p.scale - 1) > 0.05) pdfSetZoom(prefs.zoom * p.scale, pdfFocusAt(p.cx, p.cy));
      return;
    }
    if (e.touches.length === 0 && e.changedTouches.length === 1 && !S.pdfFallback) {
      var now = Date.now(), t = e.changedTouches[0];
      if (now - lastTap < 300) { lastTap = 0; pdfSetZoom(prefs.zoom > 1.2 ? 1 : 2, pdfFocusAt(t.clientX, t.clientY)); }
      else lastTap = now;
    }
  }, { passive: true });

  // ---- read aloud ---------------------------------------------------------------------------------------------------------------
  var ICON_PAUSE = '<path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="currentColor"/>', ICON_PLAY = '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>';
  function aloudLangCode() { return S.lang === "english" || S.lang === "transliteration" ? "en-IN" : "hi-IN"; }
  function pickVoice() {
    var voices = window.speechSynthesis.getVoices(), code = aloudLangCode(), pre = code.slice(0, 2);
    return voices.filter(function (v) { return v.lang === code; })[0] || voices.filter(function (v) { return v.lang.indexOf(pre) === 0; })[0] || null;
  }
  function aloudStart() {
    if (!("speechSynthesis" in window) || !S.stanzas.length) { toast("Read aloud is not available on this device"); return; }
    var from = S.stanzas.findIndex(function (st) { return S.lineView[st.from] >= S.view; });
    S.aloud.on = true; S.aloud.paused = false; S.aloud.idx = Math.max(0, from); S.aloud.token++;
    $("#krAloud").hidden = false; $("#krAloudIcon").innerHTML = ICON_PAUSE; aloudSpeak();
  }
  function aloudSpeak() {
    if (!S.aloud.on) return;
    var st = S.stanzas[S.aloud.idx];
    if (!st) { aloudStop(); toast("Finished reading"); return; }
    window.speechSynthesis.cancel();
    var tok = ++S.aloud.token, text = [];
    for (var i = st.from; i <= st.to; i++) text.push(S.lines[i].t);
    var u = new SpeechSynthesisUtterance(text.join(". ")); u.lang = aloudLangCode(); u.rate = S.aloud.rate;
    var v = pickVoice(); if (v) u.voice = v;
    u.onend = function () { if (S.aloud.on && tok === S.aloud.token && !S.aloud.paused) { S.aloud.idx++; aloudSpeak(); } };
    u.onerror = function () { /* cancelled when skipping */ };
    $$(".kr-st.is-spoken", flow).forEach(function (n) { n.classList.remove("is-spoken"); });
    var el = flow.querySelector('[data-st="' + S.aloud.idx + '"]'); if (el) el.classList.add("is-spoken");
    if (prefs.flow === "page" && S.lineView[st.from] != null && S.lineView[st.from] !== S.view) goView(S.lineView[st.from]);
    $("#krAloudState").textContent = "Verse " + (S.aloud.idx + 1) + " of " + S.stanzas.length;
    window.speechSynthesis.speak(u);
  }
  function aloudStop() {
    if (!S.aloud.on && $("#krAloud").hidden) return;
    S.aloud.on = false; S.aloud.token++;
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    $("#krAloud").hidden = true; $$(".kr-st.is-spoken", flow).forEach(function (n) { n.classList.remove("is-spoken"); });
  }
  $("#krAloudPlay").addEventListener("click", function () {
    if (!S.aloud.on) return;
    if (S.aloud.paused) { S.aloud.paused = false; $("#krAloudIcon").innerHTML = ICON_PAUSE; aloudSpeak(); }
    else { S.aloud.paused = true; window.speechSynthesis.cancel(); $("#krAloudIcon").innerHTML = ICON_PLAY; }
  });
  $("#krAloudNext").addEventListener("click", function () { if (S.aloud.on) { S.aloud.idx = Math.min(S.stanzas.length - 1, S.aloud.idx + 1); S.aloud.paused = false; $("#krAloudIcon").innerHTML = ICON_PAUSE; aloudSpeak(); } });
  $("#krAloudPrev").addEventListener("click", function () { if (S.aloud.on) { S.aloud.idx = Math.max(0, S.aloud.idx - 1); S.aloud.paused = false; $("#krAloudIcon").innerHTML = ICON_PAUSE; aloudSpeak(); } });
  $("#krAloudStop").addEventListener("click", aloudStop);
  $("#krAloudSpeed").addEventListener("click", function () { var r = [1, 1.25, 1.5, 0.8]; S.aloud.rate = r[(r.indexOf(S.aloud.rate) + 1) % r.length]; $("#krAloudSpeed").textContent = S.aloud.rate + "×"; if (S.aloud.on && !S.aloud.paused) aloudSpeak(); });
  window.addEventListener("pagehide", aloudStop);

  // ---- navigation input ---------------------------------------------------------------------------------------------------------
  $("#krZonePrev").addEventListener("click", function () { closeAll(); prev(true); });
  $("#krZoneNext").addEventListener("click", function () { closeAll(); next(true); });
  $("#krArrowPrev").addEventListener("click", function () { prev(false); });
  $("#krArrowNext").addEventListener("click", function () { next(false); });
  $("#krPrev").addEventListener("click", function () { prev(false); });
  $("#krNext").addEventListener("click", function () { next(false); });
  $("#krBtnBookmark").addEventListener("click", toggleBookmark);
  // tap the middle of the page to show or hide the bars
  var onTap = function (e) {
    if (e.target.closest(".kr-hl") || e.target.closest("button,a")) return;
    var sel = window.getSelection(); if (sel && !sel.isCollapsed) return;
    if (!$("#krSel").hidden) { hideSel(); return; }
    if (panels.some(function (s) { return !$(s).hidden; })) { closeAll(); return; }
    var r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    if (prefs.flow === "page" && x < 0.2) return prev(true);
    if (prefs.flow === "page" && x > 0.8) return next(true);
    setChrome(root.dataset.chrome !== "on");
  };
  paper.addEventListener("click", onTap); pdfEl.addEventListener("click", onTap);
  var slider = $("#krSlider"), tip = $("#krTip");
  slider.addEventListener("input", function () {
    var v = +slider.value;
    tip.textContent = isPdf() ? "Page " + v : prefs.flow === "scroll" ? v + "%" : "Page " + (v + 1) + " of " + S.views;
    tip.classList.add("is-on"); tip.style.left = ((v - +slider.min) / Math.max(1, +slider.max - +slider.min) * 100) + "%";
  });
  slider.addEventListener("change", function () {
    tip.classList.remove("is-on");
    var v = +slider.value;
    if (isPdf()) pdfTo(v);
    else if (prefs.flow === "scroll") viewport.scrollTo({ top: (viewport.scrollHeight - viewport.clientHeight) * v / 100 });
    else goView(v);
  });
  slider.addEventListener("pointerup", function () { tip.classList.remove("is-on"); });
  var wheelAt = 0;
  paper.addEventListener("wheel", function (e) {
    if (prefs.flow !== "page" || isPdf() || Math.abs(e.deltaY) < 24 && Math.abs(e.deltaX) < 24) return;
    var now = Date.now(); if (now - wheelAt < 420) return; wheelAt = now;
    (e.deltaY > 0 || e.deltaX > 0) ? next(false) : prev(false);
  }, { passive: true });
  pdfScroll.addEventListener("wheel", function (e) {
    if (prefs.flow !== "page" || S.pdfFallback || prefs.zoom > 1.05 || Math.abs(e.deltaY) < 24) return;
    var now = Date.now(); if (now - wheelAt < 420) return; wheelAt = now; e.deltaY > 0 ? pdfGo(1) : pdfGo(-1);
  }, { passive: true });
  var tx = null;
  [paper, pdfScroll].forEach(function (el) {
  el.addEventListener("touchstart", function (e) { tx = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null; }, { passive: true });
  el.addEventListener("touchend", function (e) {
    if (!tx || prefs.flow !== "page") return;
    if (isPdf() && prefs.zoom > 1.05) { tx = null; return; }
    var dx = e.changedTouches[0].clientX - tx.x, dy = e.changedTouches[0].clientY - tx.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - tx.t < 700) { dx < 0 ? next(false) : prev(false); }
    tx = null;
  }, { passive: true });
  });
  viewport.addEventListener("scroll", debounce2(function () { if (prefs.flow === "scroll") { updateChrome(); persistSoon(); } }, 120));
  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    if (e.key === "Escape") { if (!$("#krKeys").hidden) { $("#krKeys").hidden = true; return; } if (!$("#krNote").hidden) { $("#krNote").hidden = true; return; } closeAll(); return; }
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === "ArrowRight" || k === "PageDown" || (k === " " && !e.shiftKey)) { e.preventDefault(); next(false); }
    else if (k === "ArrowLeft" || k === "PageUp" || (k === " " && e.shiftKey)) { e.preventDefault(); prev(false); }
    else if (k === "Home") { isPdf() ? pdfTo(1) : goView(0); }
    else if (k === "End") { isPdf() ? pdfTo(S.pdfTotal) : goView(S.views - 1); }
    else if (k === "f" || k === "F") toggleFull();
    else if (k === "b" || k === "B") toggleBookmark();
    else if (k === "/") { e.preventDefault(); $("#krBtnSearch").click(); }
    else if (k === "0" && isPdf()) { pdfSetZoom(1); }
    else if (k === "h" || k === "H") { setChrome(root.dataset.chrome !== "on"); }
    else if (k === "?") { $("#krKeys").hidden = false; }
    else if (k === "+" || k === "=") { if (isPdf()) pdfZoomStep(1); else { setPref("size", clamp(prefs.size + 2, 16, 36)); relayout(); } }
    else if (k === "-") { if (isPdf()) pdfZoomStep(-1); else { setPref("size", clamp(prefs.size - 2, 16, 36)); relayout(); } }
  });
  var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(debounce2(function () { if (!S.ready) return; if (isPdf()) pdfRerender(); else layout(); }, 160)) : null;
  if (ro) ro.observe(stage);
  window.addEventListener("orientationchange", function () { setTimeout(function () { if (S.ready) layout(); }, 250); });
  window.addEventListener("pagehide", function () { if (S.item) { var pct = pctNow(); store.touch(slug, { pct: Math.round(pct * 10) / 10, anchor: isPdf() ? 0 : Math.max(0, currentAnchor()), lang: S.lang }); } });

  // ---- keep the screen on while reading (where the browser allows it), and time spent reading ----------------------------------------
  var wakeLock = null;
  function applyWake() {
    if (!("wakeLock" in navigator)) return;
    if (prefs.wake && !wakeLock && !document.hidden) navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; l.addEventListener("release", function () { wakeLock = null; }); }).catch(function () {});
    else if (!prefs.wake && wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
  }
  var lastTick = Date.now();
  setInterval(function () {
    var now = Date.now(), dt = Math.min(60, (now - lastTick) / 1000); lastTick = now;
    if (document.hidden || !S.ready || !S.item) return;
    var cur = store.progress(slug) || {};
    store.touch(slug, { secs: Math.round((cur.secs || 0) + dt) });
  }, 15000);
  document.addEventListener("visibilitychange", function () { lastTick = Date.now(); if (!document.hidden) applyWake(); });

  // ---- boot ---------------------------------------------------------------------------------------------------------------------
  function fail(msg) { var l = $("#krLoading"); l.textContent = msg; l.classList.add("is-error"); }
  fetch("/api/library/" + encodeURIComponent(slug) + "/", { headers: { Accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw new Error("This book could not be opened."); return r.json(); })
    .then(function (it) {
      S.item = it;
      if (!it.cover_image) { var a = KL.artFor(it); if (a.url) it.cover_image = a.url; }
      document.title = it.name + " | Reader | SanatanSeva";
      $("#krBtnListen").hidden = !it.audio_url;
      $("#krTitle").textContent = it.name; $("#krSub").textContent = [it.deity !== it.category ? it.deity : "", KL.TYPE_LABEL[it.category] || it.category].filter(Boolean).join(" · ");
      $("#krPdfFrame").title = it.name + " scripture pages";
      if (S.item.pdf_embed) S.pdfFallback = true;
      var saved = store.progress(slug) || {};
      var langs = it.languages || {};
      S.langs = ["hindi", "english", "sanskrit", "transliteration"].filter(function (l) { return langs[l]; });
      var prefLang = saved.lang || store.pref("r.lang", "hindi");
      S.lang = S.langs.indexOf(prefLang) >= 0 ? prefLang : (S.langs[0] || "hindi");
      loadNotes();
      var loc = new URLSearchParams(location.search).get("loc");
      var pdfMode = it.content_type === "pdf" && !(saved.mode === "chapters" && it.structure && it.structure.chapters);
      S.mode = pdfMode ? "pdf" : (it.content_type === "pdf" ? "chapters" : "text");
      if (pdfMode) { S.pdfPage = Math.max(1, Number(saved.pdfPage) || 1); S.furthest = Math.max(1, Number(saved.furthest) || S.pdfPage); }
      else S.furthest = Math.max(0, Number(saved.furthest) || 0);
      renderLangButtons(); applyPrefs();
      $("#krSpreadRow").hidden = false;
      if (pdfMode) { $("#krPdf").hidden = false; paper.hidden = true; root.dataset.mode = "pdf"; pdfOpen(); }
      else { buildContent(); renderFlow(); }
      var go = function () {
        if (!pdfMode) layout(saved.anchor != null && saved.lang === S.lang && saved.pct > 0 ? saved.anchor : -1);
        S.ready = true; $("#krLoading").classList.add("is-done"); updateChrome();
        if (loc) { var n = S.hls.filter(function (x) { return x.id === loc; })[0]; if (n) jumpToNote(n.id); }
        if (!store.progress(slug)) store.touch(slug, { pct: 0 });
        persistSoon();
        // first visit: show the bars so the controls are discoverable, then get out of the way
        if (!store.pref("r.seen", false)) { store.setPref("r.seen", true); toast("Tap the middle to hide the bars · tap the edges to turn pages"); }
      };
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { requestAnimationFrame(go); });
      libraryAudioPlayer.syncSession(true); applyWake();
    })
    .catch(function (err) { fail(err.message || "This book could not be opened."); });
})();
