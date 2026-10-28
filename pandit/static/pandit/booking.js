/* Pandit Booking page (/pandits/)
 * Puja selection, the 3-step enquiry form, and the WhatsApp hand-off.
 * Used only by pandit/templates/pandit/index.html. No backend, no storage on our side.
 */
(function () {
  "use strict";

  /* ==========================================================================
   * CONFIGURATION: the single place to change the WhatsApp Business number.
   * Country code + number, digits only (no "+", spaces or dashes).
   * 91 = India, then the 10-digit mobile number.
   * (The two plain wa.me links in the HTML hero/sticky bar are overwritten from
   *  this value at load, so this is the only value to edit.)
   * ========================================================================== */
  var WHATSAPP_NUMBER = "919353206153";
  var CITY = "Patna"; // default; the visitor picks the city in step 2

  var root = document.getElementById("psb");
  var form = document.getElementById("psbForm");
  if (!root || !form) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STORE_KEY = "psb.enquiry.v1";

  /* ------------------------------ helpers -------------------------------- */

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function oneLine(value, max) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max || 200);
  }

  function multiLine(value, max) {
    return String(value == null ? "" : value)
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, max || 500);
  }

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function parseDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
  }

  function prettyDate(iso) {
    var d = parseDate(iso);
    return d ? DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() : "";
  }

  function todayIso() {
    var t = new Date();
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  }

  /* --------------------- WhatsApp message + link ------------------------- */

  function readValues() {
    var fd = new FormData(form);
    var get = function (n) { return fd.get(n) == null ? "" : String(fd.get(n)); };
    return {
      name: oneLine(get("name"), 80),
      puja: get("puja"),
      other: oneLine(get("other"), 80),
      dateMode: get("dateMode") || "date",
      date: get("date"),
      city: get("city") || "Patna",
      cityOther: oneLine(get("cityOther"), 60),
      area: oneLine(get("area"), 80),
      venue: get("venue"),
      language: get("language"),
      samagri: get("samagri"),
      notes: multiLine(get("notes"), 500)
    };
  }

  function cityLabel(v) {
    if (v.city === "Another city") return v.cityOther ? v.cityOther + " (new city)" : "Another city";
    return v.city;
  }

  function pujaLabel(v) {
    if (v.puja === "Other Puja") return v.other ? "Other – " + v.other : "Other Puja";
    return v.puja;
  }

  function buildMessage(v) {
    var lines = [
      "Namaste Science Meet Sanatan 🙏",
      "",
      "I would like to enquire about booking a pandit.",
      ""
    ];
    var rows = [
      ["Name", v.name],
      ["Puja", pujaLabel(v)],
      ["Preferred date", v.dateMode === "flexible" ? "Flexible" : prettyDate(v.date)],
      ["City", cityLabel(v)],
      ["Area", v.area],
      ["Venue", v.venue],
      ["Language", v.language],
      ["Samagri", v.samagri],
      ["Additional requirements", v.notes]
    ];
    rows.forEach(function (row) {
      if (row[1]) lines.push(row[0] + ": " + row[1]); // empty optional fields are omitted
    });
    lines.push("", "Please help me check availability and confirm the complete charges.");
    return lines.join("\n");
  }

  function whatsappUrl(message) {
    // encodeURIComponent leaves ! ' ( ) * as they are; encode them too so the link is identical everywhere.
    var text = encodeURIComponent(message || "").replace(/[!'()*]/g, function (c) {
      return "%" + c.charCodeAt(0).toString(16).toUpperCase();
    });
    return "https://wa.me/" + WHATSAPP_NUMBER + (message ? "?text=" + text : "");
  }

  // Keep the plain links in the page in sync with the one configured number.
  $$("a[href^='https://wa.me/']").forEach(function (a) {
    var q = a.getAttribute("href").split("?")[1];
    a.setAttribute("href", "https://wa.me/" + WHATSAPP_NUMBER + (q ? "?" + q : ""));
  });

  /* ------------------------------ steps ---------------------------------- */

  var steps = $$(".psb-step", form);
  var dots = $$("#psbProgress li");
  var btnBack = document.getElementById("psbBack");
  var btnNext = document.getElementById("psbNext");
  var btnSubmit = document.getElementById("psbSubmit");
  var fine = document.getElementById("psbFine");
  var done = document.getElementById("psbDone");
  var summary = document.getElementById("psbSummary");
  var current = 1;

  function showStep(n, opts) {
    opts = opts || {};
    current = Math.max(1, Math.min(steps.length, n));
    steps.forEach(function (el) {
      var on = Number(el.getAttribute("data-step")) === current;
      el.hidden = !on;
      el.classList.toggle("is-entering", on && !reduceMotion && opts.animate !== false);
    });
    dots.forEach(function (li) {
      var i = Number(li.getAttribute("data-dot"));
      li.classList.toggle("is-active", i === current);
      li.classList.toggle("is-done", i < current);
      if (i === current) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    btnBack.hidden = current === 1;
    btnNext.hidden = current === steps.length;
    btnSubmit.hidden = current !== steps.length;
    fine.hidden = current !== steps.length;
    if (current === steps.length) renderSummary();
    if (opts.focus !== false) {
      var step = steps[current - 1];
      step.setAttribute("tabindex", "-1");
      step.focus({ preventScroll: true });
      var card = document.getElementById("psbProgress");
      var r = card.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight) {
        card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      }
    }
    save();
  }

  function renderSummary() {
    var v = readValues();
    var items = [
      ["Name", v.name],
      ["Puja", pujaLabel(v)],
      ["Date", v.dateMode === "flexible" ? "Flexible" : prettyDate(v.date)],
      ["City", cityLabel(v)],
      ["Area", v.area],
      ["Venue", v.venue],
      ["Language", v.language]
    ];
    summary.textContent = "";
    var h = document.createElement("h3");
    h.textContent = "Your enquiry so far";
    var dl = document.createElement("dl");
    items.forEach(function (it) {
      if (!it[1]) return;
      var dt = document.createElement("dt");
      dt.textContent = it[0];
      var dd = document.createElement("dd");
      dd.textContent = it[1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    summary.appendChild(h);
    summary.appendChild(dl);
  }

  /* ---------------------------- validation ------------------------------- */

  function setError(id, message, field) {
    var el = document.getElementById("err-" + id);
    if (el) el.textContent = message || "";
    if (field) {
      if (message) field.setAttribute("aria-invalid", "true"); else field.removeAttribute("aria-invalid");
    }
  }

  function firstChecked(name) { return $("input[name='" + name + "']:checked", form); }

  function validateStep(n) {
    var v = readValues();
    var firstBad = null;
    var bad = function (field) { if (!firstBad) firstBad = field; return false; };
    var ok = true;

    if (n === 1) {
      var nameField = document.getElementById("psbName");
      if (v.name.length < 2) { setError("name", "Please tell us your name.", nameField); ok = bad(nameField); } else setError("name", "", nameField);

      var pujaField = document.getElementById("psbPuja");
      if (!v.puja) { setError("puja", "Please choose the puja you need.", pujaField); ok = bad(pujaField); } else setError("puja", "", pujaField);

      var otherField = document.getElementById("psbOther");
      if (v.puja === "Other Puja" && v.other.length < 2) { setError("other", "Please tell us which puja or ritual.", otherField); ok = bad(otherField); } else setError("other", "", otherField);

      var dateField = document.getElementById("psbDate");
      if (v.dateMode === "date") {
        if (!v.date || !parseDate(v.date)) { setError("date", "Please pick a date, or choose “I’m flexible”.", dateField); ok = bad(dateField); }
        else if (v.date < todayIso()) { setError("date", "That date has already passed. Please pick today or a later date.", dateField); ok = bad(dateField); }
        else setError("date", "", dateField);
      } else {
        setError("date", "", dateField);
      }
    }

    if (n === 2) {
      var areaField = document.getElementById("psbArea");
      var cityOtherField = document.getElementById("psbCityOther");
      if (v.city === "Another city" && v.cityOther.length < 2) { setError("cityOther", "Please tell us which city.", cityOtherField); ok = bad(cityOtherField); } else setError("cityOther", "", cityOtherField);
      if (v.area.length < 2) { setError("area", "Please tell us the locality or area" + (v.city === "Another city" ? "" : " in " + v.city) + ".", areaField); ok = bad(areaField); } else setError("area", "", areaField);
      if (!v.venue) { setError("venue", "Please choose where the puja will be held."); ok = bad($("input[name='venue']", form)); } else setError("venue", "");
      if (!v.language) { setError("language", "Please choose a language preference."); ok = bad($("input[name='language']", form)); } else setError("language", "");
    }

    if (n === 3) {
      if (!v.samagri) { setError("samagri", "Please choose how you would like to handle samagri."); ok = bad($("input[name='samagri']", form)); } else setError("samagri", "");
    }

    if (!ok && firstBad) firstBad.focus();
    return ok;
  }

  /* ----------------------------- puja cards ------------------------------ */

  var pujaSelect = document.getElementById("psbPuja");
  var otherWrap = document.getElementById("psbOtherWrap");
  var otherInput = document.getElementById("psbOther");
  var cards = $$(".psb-puja");

  function syncPuja() {
    var value = pujaSelect.value;
    cards.forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-puja") === value ? "true" : "false"); });
    otherWrap.hidden = value !== "Other Puja";
    if (value !== "Other Puja") { otherInput.value = ""; setError("other", "", otherInput); }
  }

  var citySelect = document.getElementById("psbCity");
  var cityOtherWrap = document.getElementById("psbCityOtherWrap");
  var cityOtherInput = document.getElementById("psbCityOther");
  var areaInput = document.getElementById("psbArea");
  var areaLabel = document.getElementById("psbAreaLabel");
  var areaList = document.getElementById("psbAreas");

  function syncCity() {
    var c = citySelect.value;
    cityOtherWrap.hidden = c !== "Another city";
    if (c !== "Another city") { cityOtherInput.value = ""; setError("cityOther", "", cityOtherInput); }
    areaLabel.textContent = c === "Another city" ? "Locality or area" : "Locality or area in " + c;
    // the suggestion list holds Patna localities only
    if (c === "Patna") areaInput.setAttribute("list", "psbAreas"); else areaInput.removeAttribute("list");
    areaInput.placeholder = c === "Gurugram" ? "e.g. DLF Phase 3, Sector 56" : c === "Bengaluru" ? "e.g. Whitefield, Indiranagar" : c === "Patna" ? "e.g. Kankarbagh" : "e.g. your locality";
  }
  citySelect.addEventListener("change", syncCity);

  var bookCard = document.getElementById("book");

  // Fills a puja into the request form (used by the puja chooser and by the Pooja Vidhi guides).
  function selectPuja(name, opts) {
    opts = opts || {};
    var known = $$("option", pujaSelect).some(function (o) { return o.value === name; });
    if (!known) return false;
    pujaSelect.value = name;
    setError("puja", "", pujaSelect);
    syncPuja();
    if (!done.hidden) { done.hidden = true; form.hidden = false; $("#psbProgress").hidden = false; }
    if (current !== 1) showStep(1, { focus: false });
    save();
    if (opts.scroll !== false) {
      bookCard.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      bookCard.focus({ preventScroll: true });
    }
    return true;
  }

  cards.forEach(function (card) {
    card.addEventListener("click", function () { selectPuja(card.getAttribute("data-puja")); });
  });

  pujaSelect.addEventListener("change", function () { syncPuja(); setError("puja", "", pujaSelect); });

  /* --------------------------- date handling ----------------------------- */

  var dateInput = document.getElementById("psbDate");
  var dateWrap = document.getElementById("psbDateWrap");
  dateInput.min = todayIso();

  function syncDateMode() {
    var flexible = (firstChecked("dateMode") || {}).value === "flexible";
    dateWrap.hidden = flexible;
    if (flexible) setError("date", "", dateInput);
  }
  $$("input[name='dateMode']", form).forEach(function (r) { r.addEventListener("change", syncDateMode); });

  /* ----------------------- clear errors while typing --------------------- */

  form.addEventListener("input", function (e) {
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute("aria-invalid") === "true") { t.removeAttribute("aria-invalid"); }
    var errId = t && (t.id === "psbName" ? "name" : t.id === "psbOther" ? "other" : t.id === "psbArea" ? "area" : t.id === "psbDate" ? "date" : "");
    if (errId) setError(errId, "");
    if (t && t.type === "radio") { setError(t.name, ""); }
    save();
  });

  /* --------------------------- persistence ------------------------------- */

  function save() {
    try {
      var data = { step: current };
      $$("input, select, textarea", form).forEach(function (el) {
        if (!el.name) return;
        if (el.type === "radio") { if (el.checked) data[el.name] = el.value; }
        else data[el.name] = el.value;
      });
      sessionStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable: the form still works */ }
  }

  function restore() {
    var data = null;
    try { data = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null"); } catch (e) { data = null; }
    if (!data) return 1;
    $$("input, select, textarea", form).forEach(function (el) {
      if (!el.name || data[el.name] == null) return;
      if (el.type === "radio") el.checked = el.value === data[el.name];
      else el.value = data[el.name];
    });
    return Math.max(1, Math.min(steps.length, Number(data.step) || 1));
  }

  /* ----------------------------- navigation ------------------------------ */

  btnNext.addEventListener("click", function () {
    if (validateStep(current)) showStep(current + 1);
  });

  btnBack.addEventListener("click", function () { showStep(current - 1); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (current < steps.length) { if (validateStep(current)) showStep(current + 1); return; }
    for (var i = 1; i <= steps.length; i++) {
      if (!validateStep(i)) { showStep(i, { focus: false }); validateStep(i); return; }
    }
    var message = buildMessage(readValues());
    var url = whatsappUrl(message);
    openWhatsApp(url);
    showDone(url, message);
  });

  function openWhatsApp(url) {
    // A real link click from the submit gesture works on phones (opens the app) and on WhatsApp Web.
    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  var lastMessage = "";

  function showDone(url, message) {
    lastMessage = message;
    document.getElementById("psbReopen").setAttribute("href", url);
    document.getElementById("psbCopyStatus").textContent = "";
    form.hidden = true;
    $("#psbProgress").hidden = true;
    done.hidden = false;
    done.focus({ preventScroll: true });
    done.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  document.getElementById("psbEdit").addEventListener("click", function () {
    done.hidden = true;
    form.hidden = false;
    $("#psbProgress").hidden = false;
    showStep(1);
  });

  document.getElementById("psbCopy").addEventListener("click", function () {
    var status = document.getElementById("psbCopyStatus");
    var finish = function (ok) { status.textContent = ok ? "Message copied. You can paste it into WhatsApp." : "Couldn’t copy automatically. Please use “Open WhatsApp again”."; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastMessage).then(function () { finish(true); }, function () { finish(false); });
      return;
    }
    var ta = document.createElement("textarea");
    ta.value = lastMessage;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    finish(ok);
  });

  /* ------------------------- sticky mobile action ------------------------ */

  var sticky = document.getElementById("psbSticky");
  var phone = window.matchMedia ? window.matchMedia("(max-width: 759px)") : { matches: false };

  if (sticky && "IntersectionObserver" in window) {
    var visible = { hero: true, book: false, reader: false };
    var update = function () {
      var show = phone.matches && !visible.hero && !visible.book && !visible.reader;
      sticky.hidden = !show;
      document.body.classList.toggle("psb-has-sticky", show);
      document.body.classList.toggle("psb-in-form", phone.matches && visible.book);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.getAttribute("data-watch")] = en.isIntersecting; });
      update();
    }, { threshold: 0.05 });
    var heroCopy = $(".psb-hero__copy");
    var book = document.getElementById("book");
    if (heroCopy) { heroCopy.setAttribute("data-watch", "hero"); io.observe(heroCopy); }
    if (book) { book.setAttribute("data-watch", "book"); io.observe(book); }
    // Never cover a mantra: the bar stays away while a Pooja Vidhi guide is open on screen.
    var readerEl = document.getElementById("poojaReader");
    if (readerEl) { readerEl.setAttribute("data-watch", "reader"); io.observe(readerEl); }
    if (phone.addEventListener) phone.addEventListener("change", update);
  }

  /* ------------------------- section reveals ----------------------------- */

  root.classList.add("psb-js");
  var revealEls = $$(".psb-head, .psb-pujas li, .psb-steps li, .psb-faq details");
  revealEls.forEach(function (el, i) { el.classList.add("psb-reveal"); el.style.transitionDelay = ((i % 4) * 60) + "ms"; });
  if ("IntersectionObserver" in window && !reduceMotion) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); ro.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    revealEls.forEach(function (el) { ro.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* --------------------- glass card + specular buttons ------------------- */

  // Both are purely decorative layers. If they cannot run, the card and buttons keep their normal CSS look.
  var glass = null;
  if (window.PsbGlassSurface && bookCard) {
    try { glass = window.PsbGlassSurface.attach(bookCard, { borderRadius: 28 }); } catch (e) { glass = null; }
  }

  // Hero background: React Bits "Silk" (adapted), saffron. Falls back to the static CSS gradient without WebGL2,
  // on data-saver connections, or if anything goes wrong. Reduced motion draws one still frame (no flow, no ripples).
  var silkEl = document.getElementById("psbSilk");
  var silk = null;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  if (window.PsbSilk && silkEl && !saveData) {
    try {
      silk = window.PsbSilk.attach(silkEl, {
        color: "#FF9933",
        sheenColor: "#ffffff",
        speed: 5,
        scale: 1,
        rotation: 0,
        sheen: 0.5,
        depth: 0.5,
        glow: 0.3,
        noiseIntensity: 1.5,
        mouseInteraction: true,
        clickRipple: true,
        intro: true,
        dpr: phone.matches ? 1 : undefined   // lighter on phones
      });
    } catch (e) { silk = null; }
  }

  var BTN_RADIUS = window.matchMedia && window.matchMedia("(max-width: 639px)").matches ? 14 : 999;
  var SPECULAR = {
    primary: { size: "md", radius: BTN_RADIUS, lineColor: "#fff3d6", baseColor: "#8a5a1f", textColor: "#1b1408", intensity: 1, idleIntensity: 0.45, shineSize: 12, shineFade: 40, thickness: 1.4, proximity: 220 },
    secondary: { size: "md", radius: BTN_RADIUS, lineColor: "#f1d9a4", baseColor: "#c58b38", textColor: "#fbf7ef", intensity: 1, idleIntensity: 0.4, shineSize: 12, shineFade: 40, thickness: 1.2, proximity: 220 },
    dark: { size: "md", radius: BTN_RADIUS, lineColor: "#c58b38", baseColor: "#17243b", textColor: "#17243b", intensity: 1, idleIntensity: 0.4, shineSize: 12, shineFade: 40, thickness: 1.2, proximity: 220 }
  };

  // Adds the specular highlight to a link/button. Returns a handle with destroy(), or null.
  function decorate(el, kind) {
    if (!window.PsbSpecularButton || !el || el.getAttribute("data-specular-on")) return null;
    var opts = SPECULAR[kind || el.getAttribute("data-specular")] || SPECULAR.primary;
    try {
      var handle = window.PsbSpecularButton.attach(el, opts);
      el.setAttribute("data-specular-on", "1");
      return handle;
    } catch (e) { return null; }
  }

  $$("[data-specular]").forEach(function (el) { decorate(el); });

  /* -------------------------------- boot --------------------------------- */

  var startStep = restore();
  syncPuja();
  try {
    var qc = new URLSearchParams(location.search).get("city");
    if (qc) { for (var oi = 0; oi < citySelect.options.length; oi++) if (citySelect.options[oi].value === qc) citySelect.value = qc; }
  } catch (e) { /* ignore */ }
  syncCity();
  syncDateMode();
  showStep(startStep, { focus: false, animate: false });

  // "Back to guide" link shown above the form when a visitor came from a Pooja Vidhi guide.
  var backGuide = document.getElementById("psbBackGuide");
  function setReturnLink(label, onClick) {
    if (!backGuide) return;
    if (!label) { backGuide.hidden = true; backGuide.textContent = ""; backGuide.onclick = null; return; }
    backGuide.textContent = "\u2190 " + label;
    backGuide.hidden = false;
    backGuide.onclick = function (e) { e.preventDefault(); if (onClick) onClick(); };
  }

  // Small, documented hooks: used by pooja.js and by tests.
  window.PanditBooking = {
    buildMessage: buildMessage,
    whatsappUrl: whatsappUrl,
    selectPuja: selectPuja,
    setReturnLink: setReturnLink,
    decorate: decorate,
    silkActive: !!(silk && silk.active),
    config: { whatsappNumber: WHATSAPP_NUMBER, city: CITY }
  };
  document.dispatchEvent(new CustomEvent("psb:ready"));
})();
