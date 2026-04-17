(function () {
  const APP_CONTEXT = window.APP_CONTEXT || {};
  const PATHNAME = window.location.pathname || "/";
  const STORAGE_PREFIX = "smsLoginPopup";
  const DISMISS_KEY = `${STORAGE_PREFIX}.lastDismissedAt`;
  const SNOOZE_UNTIL_KEY = `${STORAGE_PREFIX}.snoozeUntil`;
  const VARIANT_KEY = `${STORAGE_PREFIX}.variant`;
  const SESSION_SHOWS_KEY = `${STORAGE_PREFIX}.sessionShows`;
  const SESSION_CONTENT_COUNT_KEY = `${STORAGE_PREFIX}.contentClicks`;
  const INITIAL_SHOW_DELAY_MS = 1200;
  const DEFAULT_DELAY_MS = 20 * 1000;
  const DISMISS_FOR_MS = 10 * 60 * 1000;
  const DEEP_INTERACTION_DELAY_MS = 25 * 60 * 1000;
  const MAX_SHOWS_PER_SESSION = 2;

  const popupMessages = {
    library: {
      label: "Library Sync",
      title: "Save your reading journey",
      subtitle: "Continue from where you left off anytime, keep your bookmarks, and build a quieter library rhythm.",
      benefits: [
        "Resume reading and listening from the exact place you stopped.",
        "Save bookmarks, shelves, and immersive reader preferences.",
        "Get smarter recommendations from your sacred reading history.",
      ],
      progress: 76,
    },
    quiz: {
      label: "Leaderboard Access",
      title: "Save your score & rank",
      subtitle: "Compete on the leaderboard, preserve your streak, and keep every quiz attempt attached to your profile.",
      benefits: [
        "Lock in your quiz score, streak, and leaderboard identity.",
        "Continue challenge history and unlock richer rewards later.",
        "Keep your progress synced instead of losing it on this device.",
      ],
      progress: 81,
    },
    kundali: {
      label: "Personal Guidance",
      title: "Unlock personalized guidance",
      subtitle: "Save your kundali, preserve your birth details, and return to deeper chart-led insights anytime.",
      benefits: [
        "Save kundali context for later guidance without re-entering details.",
        "Keep horoscope, remedies, and chart-linked recommendations aligned.",
        "Build a personal astrology journey instead of a temporary session.",
      ],
      progress: 84,
    },
    general: {
      label: "Personalization",
      title: "Start your spiritual journey",
      subtitle: "Get personalized recommendations, continue where you paused, and keep your progress connected.",
      benefits: [
        "Save progress, preferences, and your spiritual activity timeline.",
        "Unlock recommendations shaped by how you actually explore the site.",
        "Carry your experience forward across visits and devices.",
      ],
      progress: 72,
    },
  };

  function getContextPageType() {
    const explicit = String(APP_CONTEXT.pageType || "").trim().toLowerCase();
    if (explicit) return explicit === "horoscope" ? "kundali" : explicit;
    if (PATHNAME.startsWith("/library/") || PATHNAME.startsWith("/aartis/")) return "library";
    if (PATHNAME.startsWith("/quizzes/")) return "quiz";
    if (PATHNAME.startsWith("/kundali/") || PATHNAME.startsWith("/horoscope/")) return "kundali";
    return "general";
  }

  function isAuthenticated() {
    return Boolean(APP_CONTEXT.isAuthenticated);
  }

  function isAuthPage() {
    return PATHNAME.startsWith("/login/");
  }

  function now() {
    return Date.now();
  }

  function getNumber(storage, key) {
    try {
      return Number(storage.getItem(key) || "0") || 0;
    } catch (error) {
      return 0;
    }
  }

  function setNumber(storage, key, value) {
    try {
      storage.setItem(key, String(value));
    } catch (error) {
      return;
    }
  }

  function getVariant() {
    try {
      let variant = localStorage.getItem(VARIANT_KEY);
      if (!variant) {
        variant = Math.random() > 0.5 ? "control" : "insight";
        localStorage.setItem(VARIANT_KEY, variant);
      }
      return variant;
    } catch (error) {
      return "control";
    }
  }

  function getSessionShowCount() {
    return getNumber(sessionStorage, SESSION_SHOWS_KEY);
  }

  function incrementSessionShowCount() {
    setNumber(sessionStorage, SESSION_SHOWS_KEY, getSessionShowCount() + 1);
  }

  function getDismissedAt() {
    return getNumber(localStorage, DISMISS_KEY);
  }

  function getSnoozeUntil() {
    return getNumber(localStorage, SNOOZE_UNTIL_KEY);
  }

  function setDismissedFor(milliseconds) {
    const timestamp = now();
    setNumber(localStorage, DISMISS_KEY, timestamp);
    setNumber(localStorage, SNOOZE_UNTIL_KEY, timestamp + milliseconds);
  }

  function emitAnalytics(eventName, detail) {
    const payload = Object.assign(
      {
        event: eventName,
        pageType: getContextPageType(),
        variant: getVariant(),
        path: PATHNAME,
      },
      detail || {}
    );
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload);
    }
    window.dispatchEvent(new CustomEvent("sms:login-popup-analytics", { detail: payload }));
  }

  function throttle(callback, wait) {
    let waiting = false;
    return function throttled() {
      if (waiting) return;
      waiting = true;
      callback.apply(this, arguments);
      window.setTimeout(function () {
        waiting = false;
      }, wait);
    };
  }

  function getStoredJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (error) {
      return [];
    }
  }

  function hasDeepLibraryEngagement() {
    const progress = getStoredJson("sms-library-progress");
    const recent = getStoredJson("sms-library-recent");
    return progress.length >= 2 || recent.length >= 2;
  }

  const popup = document.getElementById("smsLoginPopup");
  if (!popup || isAuthenticated() || isAuthPage()) {
    return;
  }

  const dialog = popup.querySelector(".sms-login-popup__dialog");
  const closeNodes = popup.querySelectorAll("[data-login-popup-close]");
  const loginBtn = document.getElementById("smsLoginPopupLoginBtn");
  const signupBtn = document.getElementById("smsLoginPopupSignupBtn");
  const continueBtn = document.getElementById("smsLoginPopupContinueBtn");
  const titleNode = document.getElementById("smsLoginPopupTitle");
  const subtitleNode = document.getElementById("smsLoginPopupSubtitle");
  const benefitsNode = document.getElementById("smsLoginPopupBenefits");
  const labelNode = document.getElementById("smsLoginPopupContextLabel");
  const eyebrowNode = document.getElementById("smsLoginPopupEyebrow");
  const progressFill = document.getElementById("smsLoginPopupProgressFill");
  const progressLabel = document.getElementById("smsLoginPopupProgressLabel");
  const visualBg = popup.querySelector(".sms-login-popup__visual-bg");
  const pageType = getContextPageType();
  const message = popupMessages[pageType] || popupMessages.general;
  const variant = getVariant();
  let isOpen = false;
  let lastFocused = null;
  let timerId = null;
  let fallbackTimerId = null;

  popup.dataset.variant = variant;
  if (titleNode) titleNode.textContent = message.title;
  if (subtitleNode) subtitleNode.textContent = message.subtitle;
  if (labelNode) labelNode.textContent = message.label;
  if (eyebrowNode) {
    eyebrowNode.textContent =
      variant === "insight" ? "Science Meets Sanatan • Guided Access" : "Science Meets Sanatan";
  }
  if (progressLabel) progressLabel.textContent = `${message.progress}%`;
  if (benefitsNode) {
    benefitsNode.innerHTML = message.benefits.map(function (item) {
      return `<li>${item}</li>`;
    }).join("");
  }

  const nextParam = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
  if (loginBtn) loginBtn.href = `/login/?mode=login&next=${nextParam}`;
  if (signupBtn) signupBtn.href = `/login/?mode=signup&next=${nextParam}`;

  function hydrateVisualBg() {
    if (!visualBg || visualBg.dataset.loaded === "true") return;
    const imageUrl = visualBg.getAttribute("data-bg");
    if (!imageUrl) return;
    visualBg.style.backgroundImage = `linear-gradient(145deg, rgba(8, 10, 16, 0.12), rgba(8, 10, 16, 0.72)), url("${imageUrl}")`;
    visualBg.dataset.loaded = "true";
  }

  function eligibleToShow() {
    if (isOpen) return false;
    if (getSessionShowCount() >= MAX_SHOWS_PER_SESSION) return false;
    const snoozeUntil = getSnoozeUntil();
    if (snoozeUntil && now() < snoozeUntil) return false;
    const dismissedAt = getDismissedAt();
    if (dismissedAt && now() - dismissedAt < DISMISS_FOR_MS) return false;
    return true;
  }

  function getFocusableNodes() {
    return Array.from(
      popup.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (node) {
      return node.offsetParent !== null;
    });
  }

  function trapFocus(event) {
    if (!isOpen || event.key !== "Tab") return;
    const focusable = getFocusableNodes();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onKeyDown(event) {
    if (!isOpen) return;
    if (event.key === "Escape") {
      closePopup("escape");
      return;
    }
    trapFocus(event);
  }

  function openPopup(trigger) {
    if (!eligibleToShow()) return;
    window.clearTimeout(timerId);
    window.clearTimeout(fallbackTimerId);
    hydrateVisualBg();
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    popup.dataset.state = "open";
    popup.setAttribute("aria-hidden", "false");
    document.body.classList.add("sms-login-popup-lock");
    incrementSessionShowCount();
    isOpen = true;
    emitAnalytics("popup_shown", { trigger: trigger || "timed" });
    window.setTimeout(function () {
      if (progressFill) {
        progressFill.style.width = `${message.progress}%`;
      }
      const focusTarget = loginBtn || continueBtn || dialog;
      if (focusTarget && typeof focusTarget.focus === "function") {
        focusTarget.focus();
      }
    }, 40);
  }

  function closePopup(reason) {
    if (!isOpen) return;
    setDismissedFor(reason === "deep_interaction" ? DEEP_INTERACTION_DELAY_MS : DISMISS_FOR_MS);
    popup.dataset.state = "closing";
    popup.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sms-login-popup-lock");
    isOpen = false;
    emitAnalytics("popup_dismissed", { reason: reason || "dismissed" });
    window.setTimeout(function () {
      popup.dataset.state = "closed";
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    }, 260);
  }

  function deferPopup(reason, delayMs) {
    setDismissedFor(delayMs || DEEP_INTERACTION_DELAY_MS);
    if (isOpen) {
      closePopup(reason || "deep_interaction");
    }
  }

  function markContentInteraction() {
    const current = getNumber(sessionStorage, SESSION_CONTENT_COUNT_KEY) + 1;
    setNumber(sessionStorage, SESSION_CONTENT_COUNT_KEY, current);
    if (current >= 2) {
      deferPopup("deep_interaction", DEEP_INTERACTION_DELAY_MS);
    }
  }

  function tryShow(trigger) {
    if (!eligibleToShow()) return;
    openPopup(trigger);
  }

  function onDocumentClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const contentLink = target.closest('a[href^="/library/"], a[href^="/aartis/"]');
    if (contentLink) {
      const href = contentLink.getAttribute("href") || "";
      if (/^\/library\/[^/]+\/?$/.test(href) || /^\/aartis\/[^/]+\/?$/.test(href)) {
        markContentInteraction();
      }
    }
  }

  function initTriggers() {
    if (pageType === "library" && hasDeepLibraryEngagement()) {
      deferPopup("deep_interaction", DEEP_INTERACTION_DELAY_MS);
      return;
    }

    timerId = window.setTimeout(function () {
      tryShow("page_load");
    }, INITIAL_SHOW_DELAY_MS);

    fallbackTimerId = window.setTimeout(function () {
      tryShow("timer_20s");
    }, DEFAULT_DELAY_MS);

    const onScroll = throttle(function () {
      const doc = document.documentElement;
      const total = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const progress = (window.scrollY / total) * 100;
      if (progress >= 40) {
        tryShow("scroll_40");
        window.removeEventListener("scroll", onScroll);
      }
    }, 180);

    window.addEventListener("scroll", onScroll, { passive: true });
  }

  closeNodes.forEach(function (node) {
    node.addEventListener("click", function () {
      closePopup(node === continueBtn ? "continue_without_login" : "manual_close");
    });
  });

  if (loginBtn) {
    loginBtn.addEventListener("click", function () {
      emitAnalytics("popup_login_clicked", { action: "login" });
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener("click", function () {
      emitAnalytics("popup_login_clicked", { action: "signup" });
    });
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("click", onDocumentClick, true);

  window.SMSLoginPopup = {
    open: function (reason) {
      openPopup(reason || "manual");
    },
    close: function (reason) {
      closePopup(reason || "manual");
    },
    defer: function (minutes, reason) {
      const delayMs = Math.max(1, Number(minutes || 10)) * 60 * 1000;
      deferPopup(reason || "manual_defer", delayMs);
    },
  };

  window.addEventListener("sms:quiz-completed", function () {
    tryShow("quiz_completed");
  });

  window.addEventListener("sms:login-popup-open", function (event) {
    openPopup(event.detail && event.detail.trigger ? event.detail.trigger : "custom_event");
  });

  window.addEventListener("sms:login-popup-defer", function (event) {
    const minutes = Number(event.detail && event.detail.minutes ? event.detail.minutes : 25);
    deferPopup(event.detail && event.detail.reason ? event.detail.reason : "custom_defer", minutes * 60 * 1000);
  });

  initTriggers();

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(hydrateVisualBg, { timeout: 2200 });
  } else {
    window.setTimeout(hydrateVisualBg, 1200);
  }
})();
