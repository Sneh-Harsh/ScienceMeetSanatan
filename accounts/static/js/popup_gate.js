/* Popup gate: one place that decides WHEN the feedback, login and daan popups may open on their own.

   A popup may open only when ALL of these are true:
     1. The visitor has either DONE something (generated a kundali/horoscope, finished a quiz, got an
        Oracle answer ...) at least 10 seconds ago, OR has actively used the site for 5 minutes.
     2. The visitor is not in the middle of something: nothing typed, clicked, scrolled or tapped in the
        last 8 seconds, no text field focused, no request still loading, the tab is visible and no other
        dialog is open.
     3. At least 4 minutes have passed since any popup was last shown (on any page).
   Popups the visitor opens themselves (floating buttons) are never held back by this gate. */
(function () {
  "use strict";
  if (window.SMSPopupGate) return;

  var FIVE_MIN = 5 * 60 * 1000;
  var QUIET_MS = 8 * 1000;          // no interaction for this long before a popup may appear
  var AFTER_ACTION_MS = 10 * 1000;  // let the visitor read the result of what they just did
  var GAP_MS = 4 * 60 * 1000;       // minimum time between two popups
  var ACTIVE_WINDOW_MS = 60 * 1000; // time only counts while the visitor was active in the last minute
  var SESSION_KEY = "sms_gate.session";
  var SHOWN_KEY = "sms_gate.lastPopupAt";

  function read(storage, key, fallback) {
    try { return JSON.parse(storage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function write(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage may be blocked */ }
  }

  var session = read(window.sessionStorage, SESSION_KEY, {});
  session.activeMs = Number(session.activeMs) || 0;
  session.actions = Number(session.actions) || 0;
  session.lastActionAt = Number(session.lastActionAt) || 0;

  var lastInputAt = Date.now();
  var pending = 0;
  var queue = [];
  var saveTick = 0;

  function lastPopupAt() {
    return Number(read(window.localStorage, SHOWN_KEY, 0)) || 0;
  }

  /* ---- what counts as "the visitor is doing something right now" ---- */
  ["pointerdown", "keydown", "wheel", "touchstart", "touchmove", "scroll", "input", "change"].forEach(function (name) {
    window.addEventListener(name, function () { lastInputAt = Date.now(); }, { passive: true, capture: true });
  });

  var TEXT_TYPES = /^(text|search|email|tel|url|password|number|date|time|datetime-local|month|week)$/i;
  function typingInField() {
    var el = document.activeElement;
    if (!el || el === document.body) return false;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "select") return true;
    if (tag === "input") return TEXT_TYPES.test(el.getAttribute("type") || "text");
    return Boolean(el.isContentEditable);
  }

  function dialogOpen() {
    if (document.querySelector("#smsLoginPopup[data-state='open']")) return true;
    if (document.querySelector(".review-modal.is-visible, .daanpatra-modal.is-visible")) return true;
    var body = document.body;
    if (body && (body.classList.contains("review-body-lock") || body.classList.contains("sms-login-popup-lock") || body.classList.contains("daanpatra-body-lock"))) return true;
    // any other modal dialog that is really on screen (closed popups keep aria-hidden="true")
    var dialogs = document.querySelectorAll("[role='dialog'][aria-modal='true']");
    for (var i = 0; i < dialogs.length; i++) {
      var el = dialogs[i];
      if (el.closest("[hidden], [aria-hidden='true']")) continue;
      var style = window.getComputedStyle(el);
      var rect = el.getBoundingClientRect();
      if (style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05 && rect.width > 0 && rect.height > 0) return true;
    }
    return false;
  }

  /* ---- requests still in flight (a kundali being generated, an Oracle answer streaming ...) ---- */
  if (typeof window.fetch === "function") {
    var nativeFetch = window.fetch;
    window.fetch = function () {
      pending += 1;
      var finished = function () {
        pending = Math.max(0, pending - 1);
        lastInputAt = Math.max(lastInputAt, Date.now() - QUIET_MS + 3000); // keep 3 calm seconds after it ends
      };
      var promise = nativeFetch.apply(this, arguments);
      promise.then(finished, finished);
      return promise;
    };
  }

  function busy() {
    if (document.hidden) return true;
    if (pending > 0) return true;
    if (typingInField()) return true;
    if (dialogOpen()) return true;
    return Date.now() - lastInputAt < QUIET_MS;
  }

  /* ---- "has done something" ---- */
  function noteAction() {
    session.actions += 1;
    session.lastActionAt = Date.now();
    write(window.sessionStorage, SESSION_KEY, session);
  }
  ["sms:kundali-generated", "sms:quiz-complete", "sms:quiz-completed", "sms:library-engaged", "sms:meaningful-engagement"].forEach(function (name) {
    window.addEventListener(name, noteAction);
  });
  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (form && form.closest && form.closest(".review-modal, #smsLoginPopup, .daanpatra-modal")) return;
    noteAction();
  }, true);

  /* ---- active time on the site (this tab session) ---- */
  window.setInterval(function () {
    if (document.hidden) return;
    if (Date.now() - lastInputAt > ACTIVE_WINDOW_MS) return;
    session.activeMs += 1000;
    saveTick += 1;
    if (saveTick % 5 === 0) write(window.sessionStorage, SESSION_KEY, session);
  }, 1000);

  function reason() {
    var now = Date.now();
    if (session.actions >= 1 && now - session.lastActionAt >= AFTER_ACTION_MS) return "action";
    if (session.activeMs >= FIVE_MIN) return "time";
    return "";
  }

  /* ---- the queue ---- */
  function pump() {
    if (!queue.length) return;
    if (busy()) return;
    if (Date.now() - lastPopupAt() < GAP_MS) return;
    var why = reason();
    if (!why) return;
    queue.sort(function (a, b) { return (a.prio[why] || 9) - (b.prio[why] || 9); });
    while (queue.length) {
      var item = queue.shift();
      if (typeof item.isEligible === "function" && !item.isEligible()) continue; // this popup is snoozed or already shown
      write(window.localStorage, SHOWN_KEY, Date.now());
      item.show(why);
      return;
    }
  }
  window.setInterval(pump, 1500);

  window.SMSPopupGate = {
    /* Ask for permission to open a popup on its own. The gate calls show() at the right moment. */
    request: function (name, show, options) {
      options = options || {};
      queue = queue.filter(function (item) { return item.name !== name; });
      queue.push({ name: name, show: show, isEligible: options.isEligible, prio: options.prio || {} });
    },
    noteAction: noteAction,
    isBusy: busy,
    state: function () {
      return {
        activeMs: session.activeMs, actions: session.actions, reason: reason(), busy: busy(),
        why: { hidden: document.hidden, pending: pending, typing: typingInField(), dialog: dialogOpen(), sinceInputMs: Date.now() - lastInputAt },
        sinceLastPopupMs: Date.now() - lastPopupAt(), queued: queue.map(function (i) { return i.name; }),
      };
    },
  };
})();
