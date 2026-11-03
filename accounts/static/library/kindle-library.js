// Library page: Home, Library, Collections, Notebook and Listen. Uses the audio engine from library-core.js and the shared
// store/cover builder from kindle-store.js.
(function () {
  var app = document.getElementById("klApp");
  if (!app || !window.KL) return;
  // the page embeds the payload as a JSON string inside JSON, so it may need parsing twice; if it is empty, ask the API
  var embedded = safeJson(document.getElementById("libraryPayloadData") ? document.getElementById("libraryPayloadData").textContent : "", { items: [] });
  if (typeof embedded === "string") embedded = safeJson(embedded, { items: [] });
  if (embedded && embedded.items && embedded.items.length) start(embedded);
  else {
    fetch("/api/library/", { headers: { Accept: "application/json" } }).then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .catch(function () { return { items: [] }; }).then(start);
  }

  function start(seed) {
  var KL = window.KL, store = KL.store, esc = KL.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---- data ---------------------------------------------------------------------------------------------------------------------
  var collectionSlug = app.dataset.collectionSlug || "";
  var collectionLabel = app.dataset.collectionLabel || "";
  var items = (seed.items || []).map(function (it) {
    if (!it.cover_image) { var a = KL.artFor(it); if (a.url) it.cover_image = a.url; }
    var langs = it.languages || {};
    it._lyrics = [langs.hindi, langs.english, langs.sanskrit, langs.transliteration].filter(Boolean).join("\n");
    it._hay = [it.name, it.deity, (it.deity_tags || []).join(" "), it.category, it.excerpt, it.singer].join(" ").toLowerCase();
    it._langs = ["hindi", "english", "sanskrit", "transliteration"].filter(function (l) { return langs[l]; });
    return it;
  });
  var bySlug = {};
  items.forEach(function (it) { bySlug[it.slug] = it; });
  var CATEGORIES = [];
  items.forEach(function (it) { if (CATEGORIES.indexOf(it.category) < 0) CATEGORIES.push(it.category); });
  var DEITIES = [];
  items.forEach(function (it) { (it.deity_tags || []).forEach(function (d) { if (DEITIES.indexOf(d) < 0) DEITIES.push(d); }); });
  DEITIES.sort();
  function slugify(v) { return String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  // one topic per collection actually found (the folders in Drive, plus the built-in groups), so new folders show up on their own
  var TOPICS = CATEGORIES.map(function (c) {
    var list = items.filter(function (it) { return it.category === c; });
    return { slug: slugify(c), label: c, note: list.length + (list.length === 1 ? " title" : " titles"), emb: KL.artFor({ name: c, deity: (list[0] && list[0].deity) || c }).emb };
  });
  var QUOTES = [
    ["You have a right to action alone, never to its fruits.", "Bhagavad Gita 2.47"],
    ["All this is pervaded by the Lord.", "Isha Upanishad 1"],
    ["Let noble thoughts come to us from every side.", "Rigveda 1.89.1"],
    ["Lead me from the unreal to the real, from darkness to light.", "Brihadaranyaka Upanishad"],
    ["The soul is never born nor dies at any time.", "Bhagavad Gita 2.20"],
    ["Truth is one; the wise call it by many names.", "Rigveda 1.164.46"]
  ];

  // icons share one stroke style, so every button reads the same on the soft surface
  var svg = function (body, size) { return '<svg viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) + '" aria-hidden="true">' + body + "</svg>"; };
  var IC = {
    heart: function (n) { return svg('<path d="M12 20.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.5 2.3c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>', n); },
    bookmark: function (n) { return svg('<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4.2L6 21V4.5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>', n); },
    folder: function (n) { return svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>', n); },
    check: function (n) { return svg('<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>', n); },
    share: function (n) { return svg('<path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>', n); },
    download: function (n) { return svg('<path d="M12 4v11M8 11l4 4 4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>', n); }
  };

  // ---- state --------------------------------------------------------------------------------------------------------------------
  var VIEWS = ["home", "library", "collections", "notebook", "listen"];
  var ui = {
    view: "home", q: "", cat: (app.dataset.initialCategory || "all").toLowerCase(), deity: "all", lang: "all", status: "all",
    sort: store.pref("sort", "featured"), layout: store.pref("layout", "grid"), openColl: null, nbFilter: "all"
  };
  if (collectionSlug) { ui.view = "library"; ui.cat = "all"; } // the server already narrowed the list to this collection
  var hash = (location.hash || "").replace("#", "");
  if (VIEWS.indexOf(hash) >= 0) ui.view = hash;

  // ---- small helpers ------------------------------------------------------------------------------------------------------------
  var toastTimer = 0;
  function toast(msg) {
    var t = $("#klToast"); if (!t) return;
    t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("is-on"); }, 2200);
  }
  function readHref(it) { return "/library/" + encodeURIComponent(it.slug) + "/" + (collectionSlug ? "?from_collection=" + encodeURIComponent(collectionSlug) : ""); }
  function playItem(slug, pool, expand, from) {
    var it = bySlug[slug]; if (!it || !it.audio_url) return;
    var queue = (pool || items.filter(function (x) { return x.audio_url; })).map(buildAudioTrackFromItem).filter(Boolean);
    libraryAudioPlayer.openTrack(buildAudioTrackFromItem(it), queue, { expand: !!expand, autoPlay: true, from: from || null });
  }
  function statusText(it) { return KL.progressLabel(it); }
  function minutesLabel(it) { var m = KL.readMinutes(it); return m ? m + " min read" : "PDF scripture"; }
  function greeting() {
    var h = new Date().getHours();
    return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }
  function snippet(it, q) {
    if (!q) return "";
    var lines = it._lyrics.split(/\n+/);
    var ql = q.toLowerCase();
    for (var i = 0; i < lines.length; i++) {
      var at = lines[i].toLowerCase().indexOf(ql);
      if (at >= 0) {
        var s = Math.max(0, at - 28), e = Math.min(lines[i].length, at + q.length + 44);
        var txt = (s > 0 ? "…" : "") + lines[i].slice(s, e) + (e < lines[i].length ? "…" : "");
        return highlight(txt, q);
      }
    }
    return "";
  }

  // ---- filtering ----------------------------------------------------------------------------------------------------------------
  function filtered() {
    var q = ui.q.trim().toLowerCase();
    var out = items.filter(function (it) {
      if (ui.cat !== "all") {
        if (ui.cat === "audio") { if (!it.audio_url) return false; }
        else if (String(it.category).toLowerCase() !== ui.cat) return false;
      }
      if (ui.deity !== "all" && (it.deity_tags || []).indexOf(ui.deity) < 0) return false;
      if (ui.lang !== "all" && it._langs.indexOf(ui.lang) < 0) return false;
      if (ui.status !== "all" && store.status(it.slug) !== ui.status) return false;
      if (q && it._hay.indexOf(q) < 0 && it._lyrics.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var s = ui.sort;
    out.sort(function (a, b) {
      if (s === "title") return a.name.localeCompare(b.name);
      if (s === "recent") {
        var pa = store.progress(a.slug), pb = store.progress(b.slug);
        return String(pb ? pb.at : "").localeCompare(String(pa ? pa.at : ""));
      }
      if (s === "progress") {
        var xa = store.progress(a.slug), xb = store.progress(b.slug);
        return (xb ? xb.pct || 0 : 0) - (xa ? xa.pct || 0 : 0);
      }
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.popularity || 0) - (a.popularity || 0);
    });
    return out;
  }

  // ---- building blocks ----------------------------------------------------------------------------------------------------------
  function tile(it, extra) {
    var st = statusText(it);
    return '<article class="kl-tile">' +
      '<button type="button" class="kl-tile__cover" data-open="' + esc(it.slug) + '" aria-label="Details for ' + esc(it.name) + '">' + KL.coverHtml(it) + '</button>' +
      '<div class="kl-tile__meta"><b title="' + esc(it.name) + '">' + esc(it.name) + '</b><span>' + esc(it.deity || it.category) + '</span>' +
      (st ? '<em>' + esc(st) + '</em>' : (extra ? '<em>' + esc(extra) + '</em>' : "")) + '</div>' +
      '<button type="button" class="kl-tile__fav' + (store.isFav(it.slug) ? " is-on" : "") + '" data-fav="' + esc(it.slug) + '" aria-pressed="' + store.isFav(it.slug) + '" aria-label="' + (store.isFav(it.slug) ? "Remove from favourites" : "Add to favourites") + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.5 2.3c0 5.4-7.5 10-7.5 10z" fill="currentColor"/></svg></button>' +
      (it.audio_url ? '<button type="button" class="kl-tile__play" data-play="' + esc(it.slug) + '" aria-label="Play ' + esc(it.name) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></button>' : "") +
      '</article>';
  }
  function row(it, q) {
    var st = statusText(it), p = store.progress(it.slug), pct = p ? Math.round(p.pct || 0) : 0;
    var sn = snippet(it, q);
    return '<article class="kl-row">' +
      '<button type="button" class="kl-row__cover" data-open="' + esc(it.slug) + '" aria-label="Details for ' + esc(it.name) + '">' + KL.coverHtml(it) + '</button>' +
      '<div class="kl-row__body"><button type="button" class="kl-row__title" data-open="' + esc(it.slug) + '">' + esc(it.name) + '</button>' +
      '<p class="kl-row__sub">' + esc(it.deity || "") + ' · ' + esc(KL.TYPE_LABEL[it.category] || it.category) + ' · ' + esc(minutesLabel(it)) + (it.singer ? ' · ' + esc(it.singer) : "") + '</p>' +
      '<p class="kl-row__ex">' + (sn ? sn : esc((it.excerpt || "").slice(0, 150))) + '</p>' +
      (pct > 0 && store.status(it.slug) !== "finished" ? '<div class="kl-bar-sm"><i style="width:' + pct + '%"></i></div>' : "") +
      '</div><div class="kl-row__act">' + (st ? '<span class="kl-row__st">' + esc(st) + '</span>' : "") +
      '<a class="kl-btn kl-btn--sm kl-btn--primary" href="' + esc(readHref(it)) + '">' + (st !== "Finished" && (pct > 0 || (p && p.pdfPage > 1)) ? "Resume" : "Read") + '</a>' +
      (it.audio_url ? '<button type="button" class="kl-btn kl-btn--sm" data-play="' + esc(it.slug) + '">Listen</button>' : "") + '</div></article>';
  }
  function shelf(title, list, opts) {
    opts = opts || {};
    if (!list.length) return "";
    return '<section class="kl-shelf"><header class="kl-shelf__h"><h2>' + esc(title) + '</h2>' +
      (opts.see ? '<button type="button" class="kl-link" data-see="' + esc(opts.see) + '">See all <span aria-hidden="true">›</span></button>' : "") +
      '</header><div class="kl-shelf__row" role="list">' + list.map(function (it) { return '<div role="listitem">' + tile(it, opts.extra && opts.extra(it)) + "</div>"; }).join("") + "</div></section>";
  }

  // ---- panes --------------------------------------------------------------------------------------------------------------------
  function renderHome() {
    var pane = $("#paneHome");
    var recent = store.get().recent.map(function (s) { return bySlug[s]; }).filter(Boolean);
    var inProgress = recent.filter(function (it) { return store.status(it.slug) === "reading"; });
    var hero = inProgress[0] || null;
    var featured = items.filter(function (it) { return it.featured; }).sort(function (a, b) { return (b.popularity || 0) - (a.popularity || 0); });
    var starter = hero || featured.filter(function (it) { return store.status(it.slug) === "unread"; })[0] || featured[0] || items[0];
    var finished = store.get().finished.length, total = items.length;
    var h = "";
    h += '<div class="kl-greet"><h2>' + esc(greeting()) + (app.dataset.user ? ", " + esc(app.dataset.user) : "") + '</h2><p>' + total + ' sacred texts in your library · ' + finished + ' finished</p></div>';
    if (starter) {
      var p = store.progress(starter.slug), pct = p ? Math.round(p.pct || 0) : 0;
      h += '<section class="kl-hero"><button type="button" class="kl-hero__cover" data-open="' + esc(starter.slug) + '" aria-label="Details for ' + esc(starter.name) + '">' + KL.coverHtml(starter) + '</button>' +
        '<div class="kl-hero__body"><p class="kl-kicker">' + (hero ? "Continue reading" : "Begin your reading") + '</p><h2>' + esc(starter.name) + '</h2>' +
        '<p class="kl-hero__by">' + esc(starter.deity || "") + ' · ' + esc(KL.TYPE_LABEL[starter.category] || starter.category) + '</p>' +
        (hero ? '<div class="kl-progress"><div class="kl-progress__bar"><i style="width:' + pct + '%"></i></div><span>' + esc(KL.progressLabel(starter) || pct + "%") + ' · opened ' + esc(KL.relTime(p.at)) + '</span></div>' : '<p class="kl-hero__ex">' + esc((starter.excerpt || "").slice(0, 190)) + '</p>') +
        '<div class="kl-hero__cta"><a class="kl-btn kl-btn--primary" href="' + esc(readHref(starter)) + '">' + (hero ? "Resume reading" : "Start reading") + '</a>' +
        (starter.audio_url ? '<button type="button" class="kl-btn" data-play="' + esc(starter.slug) + '">Listen</button>' : "") +
        '<button type="button" class="kl-btn" data-open="' + esc(starter.slug) + '">Details</button></div></div></section>';
    }
    var rest = inProgress.slice(starter === hero ? 1 : 0);
    h += shelf(rest.length ? "Pick up where you left off" : "Recently opened", rest.length ? rest : recent.filter(function (it) { return it !== starter; }).slice(0, 10));
    h += shelf("Featured", featured.slice(0, 12));
    CATEGORIES.forEach(function (c) {
      var list = items.filter(function (it) { return it.category === c; });
      h += shelf(c, list.slice(0, 12), { see: c.toLowerCase() });
    });
    h += shelf("Listen now", items.filter(function (it) { return it.audio_url; }).slice(0, 12), { see: "audio", extra: function (it) { return it.singer; } });
    var q = QUOTES[Math.floor(Date.now() / 86400000) % QUOTES.length];
    h += '<section class="kl-quote"><p class="kl-kicker">Verse for today</p><blockquote>“' + esc(q[0]) + '”</blockquote><cite>' + esc(q[1]) + '</cite></section>';
    pane.innerHTML = h || '<div class="kl-empty"><h3>Your library is empty</h3><p>Texts will appear here as they are added.</p></div>';
    wireRows(pane);
  }

  function renderChips() {
    var chips = [["all", "All"]].concat(CATEGORIES.map(function (c) { return [c.toLowerCase(), c]; }));
    if (items.some(function (it) { return it.audio_url; })) chips.push(["audio", "Audio"]);
    $("#klChips").innerHTML = chips.map(function (c) {
      return '<button type="button" role="tab" class="kl-chip' + (ui.cat === c[0] ? " is-active" : "") + '" data-cat="' + esc(c[0]) + '" aria-selected="' + (ui.cat === c[0]) + '">' + esc(c[1]) + "</button>";
    }).join("");
  }
  function renderLibrary() {
    renderChips();
    var list = filtered();
    $("#klCount").textContent = list.length + " of " + items.length + " title" + (items.length === 1 ? "" : "s") + (ui.q ? ' for “' + ui.q + '”' : "");
    var box = $("#klResults");
    if (!list.length) {
      var filtersOn = ui.cat !== "all" || ui.deity !== "all" || ui.lang !== "all" || ui.status !== "all" || ui.q;
      box.className = "kl-results";
      box.innerHTML = '<div class="kl-empty"><h3>' + (items.length ? "Nothing matches" : "Nothing here yet") + '</h3><p>' + (items.length ? "Try a different search or clear the filters." : "This collection will fill up as texts are added.") + '</p>' +
        (filtersOn ? '<button type="button" class="kl-btn kl-btn--primary" data-clear>Clear filters</button>' : "") + (collectionSlug ? '<a class="kl-btn" href="/library/">Browse the whole library</a>' : "") + "</div>";
    } else if (ui.layout === "list") {
      box.className = "kl-results kl-results--list";
      box.innerHTML = list.map(function (it) { return row(it, ui.q.trim()); }).join("");
    } else {
      box.className = "kl-results kl-results--grid";
      box.innerHTML = list.map(function (it) { return tile(it); }).join("");
    }
    $$("#klLayout button").forEach(function (b) { b.classList.toggle("is-active", b.dataset.layout === ui.layout); });
    wireRows(box);
  }

  function smartCollections() {
    var s = store.get();
    return [
      { id: "fav", name: "Favourites", icon: "heart", slugs: s.favorites, smart: true },
      { id: "want", name: "Want to read", icon: "bookmark", slugs: s.want, smart: true },
      { id: "done", name: "Finished", icon: "check", slugs: s.finished, smart: true }
    ];
  }
  function collectionCard(c) {
    var covers = c.slugs.map(function (s) { return bySlug[s]; }).filter(Boolean).slice(0, 3);
    var fan = covers.length ? covers.map(function (it, i) { return '<span class="kl-fan__c kl-fan__c--' + i + '">' + KL.coverHtml(it) + "</span>"; }).join("") : '<span class="kl-fan__empty">' + (IC[c.icon] || IC.folder)(40) + "</span>";
    return '<article class="kl-coll"><button type="button" class="kl-coll__open" data-coll="' + esc(c.id) + '"><span class="kl-fan">' + fan + '</span><b>' + esc(c.name) + '</b><span>' + c.slugs.filter(function (s) { return bySlug[s]; }).length + ' titles</span></button>' +
      (c.smart ? "" : '<div class="kl-coll__act"><button type="button" data-coll-rename="' + esc(c.id) + '" aria-label="Rename ' + esc(c.name) + '">Rename</button><button type="button" data-coll-del="' + esc(c.id) + '" aria-label="Delete ' + esc(c.name) + '">Delete</button></div>') + "</article>";
  }
  function renderCollections() {
    var pane = $("#paneCollections");
    var all = smartCollections().concat(store.get().collections.map(function (c) { return { id: c.id, name: c.name, slugs: c.slugs, icon: "folder" }; }));
    if (ui.openColl) {
      var c = all.filter(function (x) { return x.id === ui.openColl; })[0];
      if (!c) { ui.openColl = null; return renderCollections(); }
      var list = c.slugs.map(function (s) { return bySlug[s]; }).filter(Boolean);
      pane.innerHTML = '<div class="kl-subhead"><button type="button" class="kl-btn kl-btn--ghost" data-coll-back>‹ Collections</button><h2>' + esc(c.name) + '</h2></div>' +
        (list.length ? '<div class="kl-results kl-results--grid">' + list.map(function (it) { return tile(it); }).join("") + "</div>" :
          '<div class="kl-empty"><h3>Nothing here yet</h3><p>Open a title and use the ' + (c.id === "fav" ? "heart" : c.id === "want" ? "bookmark" : "collection") + ' button to add it.</p></div>');
      return wireRows(pane);
    }
    pane.innerHTML = '<div class="kl-subhead"><h2>Your collections</h2><button type="button" class="kl-btn kl-btn--primary" data-coll-new>＋ New collection</button></div>' +
      '<div class="kl-colls">' + all.map(collectionCard).join("") + "</div>" +
      '<h2 class="kl-h2">Browse by topic</h2><div class="kl-topics">' + TOPICS.map(function (t) {
        return '<a class="kl-topic" href="/library/collections/' + t.slug + '/"><span class="kl-topic__ico">' + KL.topicIcon(t.emb) + '</span><span class="kl-topic__txt"><b>' + esc(t.label) + "</b><span>" + esc(t.note) + '</span></span><i class="kl-topic__go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></i></a>';
      }).join("") + "</div>";
    wireRows(pane);
  }

  var NB_COLORS = { yellow: "#f6d85c", blue: "#7cc4ff", pink: "#ff9bc2", orange: "#ffb766" };
  function renderNotebook() {
    var pane = $("#paneNotebook");
    var notes = store.allNotes().filter(function (n) { return bySlug[n.slug]; });
    var f = ui.nbFilter;
    var shown = notes.filter(function (n) { return f === "all" || (f === "notes" ? (n.type === "highlight" && n.note) : n.type === (f === "highlights" ? "highlight" : "bookmark")); });
    var chips = [["all", "All"], ["highlights", "Highlights"], ["notes", "Notes"], ["bookmarks", "Bookmarks"]];
    var h = '<div class="kl-subhead"><h2>Notebook</h2><div class="kl-subhead__act"><button type="button" class="kl-btn" data-nb-copy ' + (notes.length ? "" : "disabled") + '>Copy all</button><button type="button" class="kl-btn" data-nb-save ' + (notes.length ? "" : "disabled") + '>Download .txt</button></div></div>' +
      '<div class="kl-chips">' + chips.map(function (c) { return '<button type="button" class="kl-chip' + (f === c[0] ? " is-active" : "") + '" data-nb="' + c[0] + '">' + c[1] + "</button>"; }).join("") + "</div>";
    if (!shown.length) {
      h += '<div class="kl-empty"><h3>' + (notes.length ? "Nothing in this view" : "Your notebook is empty") + '</h3><p>Select text while reading to highlight it or add a note. Bookmarks you save also appear here.</p></div>';
    } else {
      var groups = {}, order = [];
      shown.forEach(function (n) { if (!groups[n.slug]) { groups[n.slug] = []; order.push(n.slug); } groups[n.slug].push(n); });
      h += order.map(function (slug) {
        var it = bySlug[slug];
        return '<section class="kl-nbg"><header class="kl-nbg__h"><span class="kl-nbg__cover">' + KL.coverHtml(it) + '</span><div><b>' + esc(it.name) + '</b><span>' + groups[slug].length + ' item' + (groups[slug].length > 1 ? "s" : "") + '</span></div><a class="kl-btn kl-btn--sm" href="' + esc(readHref(it)) + '">Open book</a></header>' +
          groups[slug].map(function (n) {
            var isBm = n.type === "bookmark";
            return '<article class="kl-note"' + (isBm ? "" : ' style="--hl:' + (NB_COLORS[n.color] || NB_COLORS.yellow) + '"') + '>' +
              '<div class="kl-note__q">' + (isBm ? '<span class="kl-note__bm" aria-hidden="true">🔖</span> Bookmark · ' : "") + esc(n.text || n.label || "") + '</div>' +
              (n.note ? '<p class="kl-note__n">' + esc(n.note) + '</p>' : "") +
              '<footer><span>' + esc(KL.relTime(n.at)) + '</span><a href="' + esc(readHref(it) + (readHref(it).indexOf("?") > 0 ? "&" : "?") + "loc=" + encodeURIComponent(n.id)) + '">Go to</a><button type="button" data-nb-del="' + esc(n.slug) + '|' + esc(n.id) + '">Delete</button></footer></article>';
          }).join("") + "</section>";
      }).join("");
    }
    pane.innerHTML = h;
  }
  function notebookText() {
    return store.allNotes().filter(function (n) { return bySlug[n.slug]; }).map(function (n) {
      var it = bySlug[n.slug];
      return (n.type === "bookmark" ? "[Bookmark] " : "[Highlight] ") + (n.text || n.label || "") + (n.note ? "\n  Note: " + n.note : "") + "\n  — " + it.name + "\n";
    }).join("\n");
  }

  function renderListen() {
    var pane = $("#paneListen");
    var list = items.filter(function (it) { return it.audio_url; });
    if (!list.length) { pane.innerHTML = '<div class="kl-empty"><h3>No audio yet</h3><p>Aartis and bhajans with audio will appear here.</p></div>'; return; }
    pane.innerHTML = '<div class="kl-subhead"><h2>Listen</h2><button type="button" class="kl-btn kl-btn--primary" data-play-all>▶ Play all</button></div>' +
      '<div class="kl-tracks">' + list.map(function (it, i) {
        return '<article class="kl-track"><span class="kl-track__n">' + (i + 1) + '</span><button type="button" class="kl-track__cover" data-open="' + esc(it.slug) + '" aria-label="Details for ' + esc(it.name) + '">' + KL.coverHtml(it) + '</button>' +
          '<div class="kl-track__body"><b>' + esc(it.name) + '</b><span>' + esc([it.singer, it.deity].filter(Boolean).join(" · ")) + '</span></div>' +
          '<a class="kl-btn kl-btn--sm kl-track__read" href="' + esc(readHref(it)) + '">Read</a>' +
          '<button type="button" class="kl-track__play" data-play="' + esc(it.slug) + '" aria-label="Play ' + esc(it.name) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></button></article>';
      }).join("") + "</div>";
    wireRows(pane);
  }

  function renderStats() {
    var s = store.get();
    var opened = Object.keys(s.progress).filter(function (k) { return bySlug[k]; }).length;
    var hl = store.allNotes().filter(function (n) { return n.type === "highlight"; }).length;
    var streak = store.streak();
    $("#klStats").innerHTML = '<div class="kl-stat--wide"><b>' + streak + '</b><span>day' + (streak === 1 ? "" : "s") + ' reading streak</span></div><div><b>' + opened + '</b><span>opened</span></div><div><b>' + s.finished.filter(function (k) { return bySlug[k]; }).length + '</b><span>finished</span></div><div><b>' + hl + '</b><span>highlights</span></div>';
    $("#klNavCount").textContent = items.length;
  }

  // ---- details sheet ------------------------------------------------------------------------------------------------------------
  var sheetFrom = null;
  function openSheet(slug, trigger) {
    var it = bySlug[slug]; if (!it) return;
    sheetFrom = trigger || document.activeElement;
    var p = store.progress(slug), st = store.status(slug), pct = p ? Math.round(p.pct || 0) : 0;
    var langs = it._langs.map(function (l) { return l.charAt(0).toUpperCase() + l.slice(1); }).join(" · ");
    var similar = items.filter(function (x) { return x.slug !== slug && ((x.deity_tags || []).some(function (d) { return (it.deity_tags || []).indexOf(d) >= 0; }) || x.category === it.category); }).slice(0, 8);
    var panel = $("#klSheetPanel");
    panel.innerHTML = '<button type="button" class="kl-sheet__x" data-close aria-label="Close details">✕</button>' +
      '<div class="kl-detail"><div class="kl-detail__cover">' + KL.coverHtml(it, { cls: "kl-cover--lg" }) + '</div><div class="kl-detail__body">' +
      '<p class="kl-kicker">' + esc(KL.TYPE_LABEL[it.category] || it.category) + (it.subcategory ? " › " + esc(it.subcategory) : "") + (it.deity && it.deity !== it.category ? " · " + esc(it.deity) : "") + '</p><h2 id="klSheetTitle">' + esc(it.name) + '</h2>' +
      (it.singer ? '<p class="kl-detail__by">Sung by ' + esc(it.singer) + '</p>' : "") +
      '<ul class="kl-facts"><li>' + esc(minutesLabel(it)) + '</li>' + (langs ? "<li>" + esc(langs) + "</li>" : "") + (it.audio_url ? "<li>Audio included</li>" : "") + (it.content_type === "pdf" ? "<li>Scanned pages</li>" : "") + (it.size_label ? "<li>" + esc(it.size_label) + "</li>" : "") + (p && p.secs >= 60 ? "<li>Read for " + esc(p.secs >= 3600 ? Math.floor(p.secs / 3600) + " h " + Math.round((p.secs % 3600) / 60) + " min" : Math.round(p.secs / 60) + " min") + "</li>" : "") + '</ul>' +
      (p && pct > 0 ? '<div class="kl-progress"><div class="kl-progress__bar"><i style="width:' + (st === "finished" ? 100 : pct) + '%"></i></div><span>' + esc(st === "finished" ? "Finished" : (KL.progressLabel(it) || pct + "% read")) + ' · ' + esc(KL.relTime(p.at)) + '</span></div>' : "") +
      '<div class="kl-detail__cta"><a class="kl-btn kl-btn--primary" href="' + esc(readHref(it)) + '">' + (st === "reading" ? (p && p.pdfPage > 1 ? "Resume · page " + p.pdfPage : "Resume reading") : st === "finished" ? "Read again" : "Read") + '</a>' +
      (it.audio_url ? '<button type="button" class="kl-btn" data-play="' + esc(it.slug) + '">Listen</button>' : "") + '</div>' +
      '<div class="kl-detail__acts">' +
      '<button type="button" class="kl-act' + (store.isFav(slug) ? " is-on" : "") + '" data-act="fav" data-slug="' + esc(slug) + '" aria-pressed="' + store.isFav(slug) + '">' + IC.heart() + ' Favourite</button>' +
      '<button type="button" class="kl-act' + (store.isWant(slug) ? " is-on" : "") + '" data-act="want" data-slug="' + esc(slug) + '" aria-pressed="' + store.isWant(slug) + '">' + IC.bookmark() + ' Want to read</button>' +
      '<button type="button" class="kl-act" data-act="coll" data-slug="' + esc(slug) + '" aria-expanded="false">' + IC.folder() + ' Collections</button>' +
      '<button type="button" class="kl-act' + (st === "finished" ? " is-on" : "") + '" data-act="done" data-slug="' + esc(slug) + '" aria-pressed="' + (st === "finished") + '">' + IC.check() + ' ' + (st === "finished" ? "Finished" : "Mark finished") + '</button>' +
      '<button type="button" class="kl-act" data-act="share" data-slug="' + esc(slug) + '">' + IC.share() + ' Share</button>' +
      (it.content_type === "pdf" ? '<a class="kl-act" href="' + esc(it.pdf_url) + '" download>' + IC.download() + ' PDF</a>' : "") + '</div>' +
      '<div class="kl-collpick" id="klCollPick" hidden></div>' +
      '<p class="kl-detail__desc">' + esc(it.excerpt || "A devotional text from the SanatanSeva library.") + '</p></div></div>' +
      (similar.length ? '<div class="kl-detail__more"><h3>More like this</h3><div class="kl-shelf__row">' + similar.map(function (x) { return '<div>' + tile(x) + "</div>"; }).join("") + "</div></div>" : "");
    var sheet = $("#klSheet");
    sheet.hidden = false;
    requestAnimationFrame(function () { sheet.classList.add("is-open"); });
    document.documentElement.classList.add("kl-lock");
    panel.focus({ preventScroll: true });
  }
  function closeSheet() {
    var sheet = $("#klSheet");
    if (sheet.hidden) return;
    sheet.classList.remove("is-open");
    document.documentElement.classList.remove("kl-lock");
    setTimeout(function () { sheet.hidden = true; }, 220);
    if (sheetFrom && sheetFrom.focus) { try { sheetFrom.focus({ preventScroll: true }); } catch (e) { /* element gone */ } }
  }
  function renderCollPick(slug) {
    var box = $("#klCollPick");
    var cols = store.get().collections;
    box.innerHTML = (cols.length ? cols.map(function (c) {
      return '<label class="kl-check"><input type="checkbox" data-pick="' + esc(c.id) + '" data-slug="' + esc(slug) + '"' + (store.inCollection(c.id, slug) ? " checked" : "") + '><span>' + esc(c.name) + "</span></label>";
    }).join("") : '<p class="kl-collpick__empty">No collections yet. Create your first one.</p>') +
      '<form class="kl-collpick__new" data-newcoll data-slug="' + esc(slug) + '"><input type="text" maxlength="40" placeholder="New collection name" aria-label="New collection name" required><button class="kl-btn kl-btn--sm kl-btn--primary" type="submit">Create</button></form>';
  }

  // ---- wiring -------------------------------------------------------------------------------------------------------------------
  function wireRows(root) {
    // horizontal shelves get arrow buttons on wide screens
    $$(".kl-shelf", root).forEach(function (sh) {
      if (sh.dataset.wired) return; sh.dataset.wired = "1";
      var rowEl = $(".kl-shelf__row", sh), head = $(".kl-shelf__h", sh);
      if (!rowEl || !head) return;
      var nav = document.createElement("div"); nav.className = "kl-shelf__nav";
      nav.innerHTML = '<button type="button" aria-label="Scroll left">‹</button><button type="button" aria-label="Scroll right">›</button>';
      head.appendChild(nav);
      nav.children[0].addEventListener("click", function () { rowEl.scrollBy({ left: -rowEl.clientWidth * 0.8, behavior: "smooth" }); });
      nav.children[1].addEventListener("click", function () { rowEl.scrollBy({ left: rowEl.clientWidth * 0.8, behavior: "smooth" }); });
    });
  }
  function show(view) {
    ui.view = view;
    if (view !== "collections") ui.openColl = null;
    $$(".kl-pane").forEach(function (p) { p.hidden = p.dataset.pane !== view; });
    $$(".kl-nav").forEach(function (b) { b.classList.toggle("is-active", b.dataset.view === view); b.setAttribute("aria-current", b.dataset.view === view ? "page" : "false"); });
    var titles = {
      home: ["Home", ""], library: [collectionLabel || "Library", collectionLabel ? "A focused shelf of the library" : "Every text, audio and scripture"],
      collections: ["Collections", "Your shelves and topics"], notebook: ["Notebook", "Highlights, notes and bookmarks"], listen: ["Listen", "Aartis and bhajans with audio"]
    };
    $("#klViewTitle").textContent = titles[view][0]; $("#klViewSub").textContent = titles[view][1];
    if (view === "home") renderHome();
    if (view === "library") renderLibrary();
    if (view === "collections") renderCollections();
    if (view === "notebook") renderNotebook();
    if (view === "listen") renderListen();
    renderStats();
    try { history.replaceState(null, "", location.pathname + location.search + (view === "home" ? "" : "#" + view)); } catch (e) { /* ignore */ }
    window.scrollTo({ top: 0 });
  }
  function refresh() {
    if (ui.view === "home") renderHome();
    else if (ui.view === "library") renderLibrary();
    else if (ui.view === "collections") renderCollections();
    else if (ui.view === "notebook") renderNotebook();
    else if (ui.view === "listen") renderListen();
    renderStats();
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var nav = t.closest(".kl-nav"); if (nav) { show(nav.dataset.view); return; }
    var open = t.closest("[data-open]"); if (open) { openSheet(open.dataset.open, open); return; }
    var play = t.closest("[data-play]");
    if (play) {
      // on the Listen tab the full Now Playing sheet opens out of the cover that was tapped; elsewhere the mini player appears
      var onListen = ui.view === "listen", row = play.closest(".kl-track"), from = row ? row.querySelector(".kl-cover") : null;
      playItem(play.dataset.play, null, onListen, from);
      if (!onListen) toast("Playing " + (bySlug[play.dataset.play] || {}).name);
      return;
    }
    if (t.closest("[data-play-all]")) { var first = items.filter(function (x) { return x.audio_url; })[0]; if (first) playItem(first.slug, null, true, $(".kl-track .kl-cover")); return; }
    if (t.closest("[data-close]")) { closeSheet(); return; }
    var favBtn = t.closest("[data-fav]");
    if (favBtn) { var nowOn = store.toggleFav(favBtn.dataset.fav); favBtn.classList.toggle("is-on", nowOn); favBtn.setAttribute("aria-pressed", String(nowOn)); favBtn.setAttribute("aria-label", nowOn ? "Remove from favourites" : "Add to favourites"); toast(nowOn ? "Added to Favourites" : "Removed from Favourites"); if (ui.view === "collections" && ui.openColl === "fav") renderCollections(); return; }
    var see = t.closest("[data-see]"); if (see) { ui.cat = see.dataset.see; show("library"); return; }
    var chip = t.closest("[data-cat]"); if (chip) { ui.cat = chip.dataset.cat; renderLibrary(); return; }
    if (t.closest("[data-clear]")) { ui.cat = collectionSlug ? "all" : "all"; ui.deity = ui.lang = ui.status = "all"; ui.q = ""; $("#klSearch").value = ""; $("#klSearchClear").hidden = true; ["klDeity", "klLang", "klStatus"].forEach(function (id) { $("#" + id).value = "all"; }); refreshDropdowns(); renderLibrary(); return; }
    var lay = t.closest("#klLayout button"); if (lay) { ui.layout = lay.dataset.layout; store.setPref("layout", ui.layout); renderLibrary(); return; }
    // collections
    var coll = t.closest("[data-coll]"); if (coll) { ui.openColl = coll.dataset.coll; renderCollections(); window.scrollTo({ top: 0 }); return; }
    if (t.closest("[data-coll-back]")) { ui.openColl = null; renderCollections(); return; }
    if (t.closest("[data-coll-new]")) { var name = window.prompt("Name your collection"); if (name && name.trim()) { store.createCollection(name); renderCollections(); toast("Collection created"); } return; }
    var rn = t.closest("[data-coll-rename]"); if (rn) { var cur = store.get().collections.filter(function (c) { return c.id === rn.dataset.collRename; })[0]; var nn = window.prompt("Rename collection", cur ? cur.name : ""); if (nn && nn.trim()) { store.renameCollection(rn.dataset.collRename, nn); renderCollections(); } return; }
    var dl = t.closest("[data-coll-del]"); if (dl) { if (window.confirm("Delete this collection? The books stay in your library.")) { store.deleteCollection(dl.dataset.collDel); renderCollections(); toast("Collection deleted"); } return; }
    // notebook
    var nb = t.closest("[data-nb]"); if (nb) { ui.nbFilter = nb.dataset.nb; renderNotebook(); return; }
    var nd = t.closest("[data-nb-del]"); if (nd) { var parts = nd.dataset.nbDel.split("|"); store.removeNote(parts[0], parts[1]); renderNotebook(); renderStats(); return; }
    if (t.closest("[data-nb-copy]")) { copyText(notebookText()).then(function () { toast("Notebook copied"); }); return; }
    if (t.closest("[data-nb-save]")) { var blob = new Blob([notebookText()], { type: "text/plain" }); var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sanatanseva-notebook.txt"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 500); return; }
    // sheet actions
    var act = t.closest("[data-act]"); if (act) { sheetAction(act); return; }
  });

  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).catch(function () { return legacyCopy(txt); });
    return Promise.resolve(legacyCopy(txt));
  }
  function legacyCopy(txt) { var ta = document.createElement("textarea"); ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) { /* ignore */ } ta.remove(); }

  function sheetAction(btn) {
    var slug = btn.dataset.slug, it = bySlug[slug], a = btn.dataset.act;
    if (a === "fav") { var on = store.toggleFav(slug); btn.classList.toggle("is-on", on); btn.setAttribute("aria-pressed", on); toast(on ? "Added to Favourites" : "Removed from Favourites"); }
    if (a === "want") { var w = store.toggleWant(slug); btn.classList.toggle("is-on", w); btn.setAttribute("aria-pressed", w); toast(w ? "Added to Want to read" : "Removed from Want to read"); }
    if (a === "done") { var done = store.status(slug) !== "finished"; store.markFinished(slug, done); openSheet(slug, sheetFrom); toast(done ? "Marked as finished" : "Marked as unread"); }
    if (a === "coll") { var box = $("#klCollPick"); box.hidden = !box.hidden; btn.setAttribute("aria-expanded", String(!box.hidden)); if (!box.hidden) renderCollPick(slug); }
    if (a === "share") {
      var url = location.origin + "/library/" + encodeURIComponent(slug) + "/";
      if (navigator.share) navigator.share({ title: it.name, text: it.excerpt || it.name, url: url }).catch(function () {});
      else copyText(url).then(function () { toast("Link copied"); });
    }
  }
  document.addEventListener("change", function (e) {
    var pick = e.target.closest && e.target.closest("[data-pick]");
    if (pick) { store.toggleInCollection(pick.dataset.pick, pick.dataset.slug); toast(pick.checked ? "Added to collection" : "Removed from collection"); }
  });
  document.addEventListener("submit", function (e) {
    var f = e.target.closest && e.target.closest("[data-newcoll]");
    if (!f) return;
    e.preventDefault();
    var input = f.querySelector("input"), c = store.createCollection(input.value);
    store.toggleInCollection(c.id, f.dataset.slug);
    renderCollPick(f.dataset.slug); toast("Added to “" + c.name + "”");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSheet();
    if (e.key === "/" && !/input|textarea|select/i.test((e.target.tagName || "")) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); if (ui.view !== "library") show("library"); $("#klSearch").focus(); }
    // keep Tab inside the open sheet
    if (e.key === "Tab" && !$("#klSheet").hidden) {
      var f = $$("#klSheetPanel a[href],#klSheetPanel button:not([disabled]),#klSheetPanel input,#klSheetPanel select").filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === $("#klSheetPanel"))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // toolbar controls
  var searchEl = $("#klSearch");
  var onSearch = debounce(function () {
    ui.q = searchEl.value; $("#klSearchClear").hidden = !ui.q;
    if (ui.view !== "library") show("library"); else renderLibrary();
  }, 160);
  searchEl.addEventListener("input", onSearch);
  $("#klSearchClear").addEventListener("click", function () { searchEl.value = ""; ui.q = ""; $("#klSearchClear").hidden = true; renderLibrary(); searchEl.focus(); });
  DEITIES.forEach(function (d) { var o = document.createElement("option"); o.value = d; o.textContent = d; $("#klDeity").appendChild(o); });
  $("#klSort").value = ui.sort;
  $("#klSort").addEventListener("change", function (e) { ui.sort = e.target.value; store.setPref("sort", ui.sort); renderLibrary(); });
  $("#klDeity").addEventListener("change", function (e) { ui.deity = e.target.value; renderLibrary(); });
  $("#klLang").addEventListener("change", function (e) { ui.lang = e.target.value; renderLibrary(); });
  $("#klStatus").addEventListener("change", function (e) { ui.status = e.target.value; renderLibrary(); });

  var fbtn = $("#klFilterBtn");
  fbtn.addEventListener("click", function () { var open = $("#klFilters").classList.toggle("is-open"); fbtn.setAttribute("aria-expanded", String(open)); });

  // theme
  function applyTheme(t) { document.body.dataset.klTheme = t; var b = $("#klThemeBtn"); if (b) b.setAttribute("aria-pressed", String(t === "dark")); }
  applyTheme(store.pref("theme", "light"));
  $("#klThemeBtn").addEventListener("click", function () { var t = document.body.dataset.klTheme === "dark" ? "light" : "dark"; store.setPref("theme", t); applyTheme(t); });

  store.on(function () { if (ui.view === "home" || ui.view === "library") { /* re-render only on explicit actions to avoid scroll jumps */ } });
  window.addEventListener("pageshow", function (e) { if (e.persisted) refresh(); });
  window.addEventListener("storage", function (e) { if (e.key === "sms-kl-v1") { location.reload(); } });

  var err = app.dataset.error;
  if (err) { var eb = $("#klError"); eb.textContent = err; eb.hidden = false; }
  if (collectionSlug) { $("#klChips").parentNode.insertAdjacentHTML("afterbegin", '<a class="kl-crumb" href="/library/">‹ Whole library</a>'); }
  // ---- dropdowns: the native <select> stays as the source of truth, a soft listbox is drawn in its place ------------------------------
  var CHEV = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var openDd = null;
  function closeDd(returnFocus) {
    if (!openDd) return;
    var d = openDd; openDd = null;
    d.classList.remove("is-open"); d.querySelector(".kl-dd__btn").setAttribute("aria-expanded", "false");
    var m = d.querySelector(".kl-dd__menu"); m.classList.add("is-closing");
    setTimeout(function () { m.hidden = true; m.classList.remove("is-closing"); }, 140);
    if (returnFocus) d.querySelector(".kl-dd__btn").focus();
  }
  function ddRefresh(d) {
    var sel = d._sel, cur = sel.options[sel.selectedIndex];
    d.querySelector(".kl-dd__val").textContent = cur ? cur.textContent : "";
    d.classList.toggle("is-set", !!cur && cur.value !== "all" && sel.selectedIndex > 0 || (sel.id === "klSort" && sel.value !== "featured"));
    Array.prototype.forEach.call(d.querySelectorAll("[role=option]"), function (li, i) { li.setAttribute("aria-selected", String(i === sel.selectedIndex)); });
  }
  function enhanceSelect(sel) {
    if (sel._dd) return sel._dd;
    var d = document.createElement("div"); d.className = "kl-dd"; d._sel = sel; sel._dd = d;
    d.innerHTML = '<button type="button" class="kl-dd__btn" aria-haspopup="listbox" aria-expanded="false"><span class="kl-dd__val"></span>' + CHEV + '</button><ul class="kl-dd__menu" role="listbox" tabindex="-1" hidden></ul>';
    sel.parentNode.insertBefore(d, sel.nextSibling); sel.classList.add("kl-dd__native"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
    var btn = d.querySelector(".kl-dd__btn"), menu = d.querySelector(".kl-dd__menu");
    var label = sel.closest("label"); if (label) { var lt = label.querySelector("span"); if (lt) { lt.id = lt.id || "ddl-" + sel.id; btn.setAttribute("aria-labelledby", lt.id + " "); } }
    function build() {
      menu.innerHTML = Array.prototype.map.call(sel.options, function (o, i) { return '<li role="option" data-i="' + i + '" id="' + sel.id + '-o' + i + '" aria-selected="' + (i === sel.selectedIndex) + '"><span>' + esc(o.textContent) + "</span>" + TICK + "</li>"; }).join("");
    }
    function open() {
      if (openDd && openDd !== d) closeDd();
      build(); menu.hidden = false; d.classList.add("is-open"); btn.setAttribute("aria-expanded", "true"); openDd = d;
      var cur = menu.children[sel.selectedIndex]; if (cur) { menu.setAttribute("aria-activedescendant", cur.id); cur.classList.add("is-hot"); cur.scrollIntoView({ block: "nearest" }); }
      // open upward when there is no room below
      var r = btn.getBoundingClientRect(); d.classList.toggle("is-up", window.innerHeight - r.bottom < 300 && r.top > 300);
    }
    function choose(i) { sel.selectedIndex = i; ddRefresh(d); sel.dispatchEvent(new Event("change", { bubbles: true })); closeDd(true); }
    function move(dir) {
      var items = Array.prototype.slice.call(menu.children), hot = items.findIndex(function (x) { return x.classList.contains("is-hot"); });
      var n = clamp2(hot + dir, 0, items.length - 1);
      items.forEach(function (x) { x.classList.remove("is-hot"); }); items[n].classList.add("is-hot"); menu.setAttribute("aria-activedescendant", items[n].id); items[n].scrollIntoView({ block: "nearest" });
    }
    btn.addEventListener("click", function () { d.classList.contains("is-open") ? closeDd() : open(); });
    btn.addEventListener("keydown", function (e) {
      var isOpen = d.classList.contains("is-open");
      if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); open(); return; }
      if (!isOpen) return;
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Home") { e.preventDefault(); move(-99); }
      else if (e.key === "End") { e.preventDefault(); move(99); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); var hot = menu.querySelector(".is-hot"); if (hot) choose(+hot.dataset.i); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeDd(true); }
      else if (e.key === "Tab") closeDd();
      else if (e.key.length === 1) { // type to jump
        var ch = e.key.toLowerCase(), items = Array.prototype.slice.call(menu.children), at = items.findIndex(function (x) { return x.textContent.trim().toLowerCase().indexOf(ch) === 0; });
        if (at >= 0) { items.forEach(function (x) { x.classList.remove("is-hot"); }); items[at].classList.add("is-hot"); items[at].scrollIntoView({ block: "nearest" }); }
      }
    });
    menu.addEventListener("mousemove", function (e) { var li = e.target.closest("[role=option]"); if (!li) return; Array.prototype.forEach.call(menu.children, function (x) { x.classList.remove("is-hot"); }); li.classList.add("is-hot"); });
    menu.addEventListener("click", function (e) { var li = e.target.closest("[role=option]"); if (li) choose(+li.dataset.i); });
    ddRefresh(d);
    return d;
  }
  function clamp2(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function refreshDropdowns() { Array.prototype.forEach.call(document.querySelectorAll(".kl-dd"), ddRefresh); }
  document.addEventListener("click", function (e) { if (openDd && !e.target.closest(".kl-dd")) closeDd(); });
  window.addEventListener("scroll", function () { if (openDd) closeDd(); }, { passive: true });
  Array.prototype.forEach.call(document.querySelectorAll(".kl-select select"), enhanceSelect);

  libraryAudioPlayer.syncSession(true);
  show(ui.view);
  }
})();
