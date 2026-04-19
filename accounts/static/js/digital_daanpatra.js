(function () {
  const init = () => {
    const root = document.getElementById("digitalDaanpatra");
    if (!root) return;

    const floatingButton = document.getElementById("daanpatraTrigger");
    const backdrop = document.getElementById("daanpatraBackdrop");
    const modal = document.getElementById("daanpatraModal");
    const closeButton = document.getElementById("daanpatraClose");
    const dismissButton = document.getElementById("daanpatraDismissBtn");
    const amountChips = Array.from(root.querySelectorAll(".daanpatra-chip"));
    const customAmountInput = document.getElementById("daanpatraCustomAmount");
    const amountPreview = document.getElementById("daanpatraAmountPreview");
    const selectionNote = document.getElementById("daanpatraSelectionNote");
    const copyButton = document.getElementById("daanpatraCopyBtn");
    const payNowButton = document.getElementById("daanpatraPayNowBtn");
    const confirmationState = document.getElementById("daanpatraConfirmationState");
    const confirmationTitle = document.getElementById("daanpatraConfirmationTitle");
    const confirmationText = document.getElementById("daanpatraConfirmationText");
    const thankYouNoteInput = document.getElementById("daanpatraThankYouNote");
    const confirmButton = document.getElementById("daanpatraConfirmBtn");
    const saveNoteButton = document.getElementById("daanpatraSaveNoteBtn");
    const toast = document.getElementById("daanpatraToast");
    const title = document.getElementById("daanpatraTitle");
    const subtitle = document.getElementById("daanpatraSubtitle");
    const contextLabel = document.getElementById("daanpatraContextLabel");
    const qrImage = document.getElementById("daanpatraQrImage");
    const disclaimer = document.getElementById("daanpatraDisclaimer");

    const STORAGE = {
      dismissAt: "sms_daanpatra_dismissed_at",
      selectedAmount: "sms_daanpatra_selected_amount",
      donorNotes: "sms_daanpatra_donor_notes",
      variant: "sms_daanpatra_variant",
      autoCount: "sms_daanpatra_auto_count",
      engagement: "sms_daanpatra_engagement",
    };

    const AUTO_REOPEN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const AUTO_TRIGGER_DELAY_MS = 20 * 1000;
    const SESSION_LIMIT = 2;
    const DATASET = {
      upiId: String(root.dataset.upiId || "").trim(),
      payeeName: String(root.dataset.payeeName || "Science Meets Sanatan").trim(),
      qrUrl: String(root.dataset.qrUrl || "").trim(),
      pageType: String(root.dataset.pageType || "").trim().toLowerCase() || derivePageType(),
      isConfigured: String(root.dataset.configured || "") === "true",
    };

    let isOpen = false;
    let selectedAmount = getStoredAmount();
    let customMode = false;
    let lastFocusedElement = null;
    let toastTimer = 0;
    let autoTriggerTimer = 0;
    let confirmationMode = "";

    const messages = {
      library: {
        title: "Support this reading journey",
        subtitle: "Help us preserve books, audios, and spiritual learning experiences for every seeker who comes here.",
        kicker: "Offer seva for the library",
      },
      quiz: {
        title: "Support this learning arena",
        subtitle: "Help us keep quizzes, leaderboards, and spiritual learning tools alive for the community.",
        kicker: "Offer seva for the quiz world",
      },
      kundali: {
        title: "Support deeper guidance",
        subtitle: "Help us maintain kundali, horoscope, and astrology tools with care, accuracy, and continuity.",
        kicker: "Offer seva for sacred insight",
      },
      horoscope: {
        title: "Support deeper guidance",
        subtitle: "Help us maintain kundali, horoscope, and astrology tools with care, accuracy, and continuity.",
        kicker: "Offer seva for sacred insight",
      },
      panchang: {
        title: "Support the daily spiritual calendar",
        subtitle: "Help us keep Panchang, festivals, and day-wise spiritual tools accessible and reliable.",
        kicker: "Offer seva for daily guidance",
      },
      general: {
        title: "Offer Your Daan",
        subtitle: "Support the preservation of Sanatan knowledge and help us build a better spiritual platform for everyone.",
        kicker: "Offer Your Daan",
      },
    };

    const sendAnalytics = (eventName, detail = {}) => {
      const payload = {
        event: eventName,
        pageType: DATASET.pageType,
        amount: selectedAmount || null,
        ...detail,
      };
      window.dispatchEvent(new CustomEvent("sms:analytics", { detail: payload }));
      if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push(payload);
      }
    };

    const getVariant = () => {
      let variant = localStorage.getItem(STORAGE.variant);
      if (!variant) {
        variant = Math.random() > 0.5 ? "offer" : "support";
        localStorage.setItem(STORAGE.variant, variant);
      }
      return variant;
    };

    const applyVariant = () => {
      const variant = getVariant();
      const labelStrong = floatingButton?.querySelector("strong");
      const labelSoft = floatingButton?.querySelector(".daanpatra-floating__copy span");
      if (!labelStrong || !labelSoft) return;
      if (variant === "support") {
        labelStrong.textContent = "Support with Seva";
        labelSoft.textContent = "Offer daan gently";
      } else {
        labelStrong.textContent = "Offer Daan";
        labelSoft.textContent = "Support this journey";
      }
    };

    const setContextCopy = () => {
      const context = messages[DATASET.pageType] || messages.general;
      title.textContent = context.title;
      subtitle.textContent = context.subtitle;
      contextLabel.textContent = context.kicker;
    };

    function derivePageType() {
      const appPageType = String(window.APP_CONTEXT?.pageType || "").trim().toLowerCase();
      if (appPageType) return appPageType;
      const path = window.location.pathname.toLowerCase();
      if (path.includes("library")) return "library";
      if (path.includes("quiz")) return "quiz";
      if (path.includes("kundali")) return "kundali";
      if (path.includes("horoscope")) return "horoscope";
      if (path.includes("panchang")) return "panchang";
      return "general";
    }

    function getStoredAmount() {
      const value = localStorage.getItem(STORAGE.selectedAmount);
      const amount = Number(value || 0);
      return Number.isFinite(amount) && amount > 0 ? amount : 0;
    }

    const formatAmount = (amount) => `₹${Number(amount).toLocaleString("en-IN")}`;

    const encode = (value) => encodeURIComponent(String(value || "").trim());

    const buildUpiLink = () => {
      if (!DATASET.upiId || !selectedAmount) return "";
      const params = [
        `pa=${encode(DATASET.upiId)}`,
        `pn=${encode(DATASET.payeeName)}`,
        "cu=INR",
        `am=${encode(selectedAmount)}`,
      ];
      return `upi://pay?${params.join("&")}`;
    };

    const updatePayNowHref = () => {
      const upiLink = buildUpiLink();
      if (upiLink) {
        payNowButton.href = upiLink;
        payNowButton.removeAttribute("aria-disabled");
        payNowButton.classList.remove("is-disabled");
        payNowButton.textContent = `Pay ${formatAmount(selectedAmount)}`;
        disclaimer.textContent = "Secure payment happens inside your preferred UPI app.";
      } else {
        payNowButton.href = "#";
        payNowButton.setAttribute("aria-disabled", "true");
        payNowButton.classList.add("is-disabled");
        payNowButton.textContent = "Pay Now";
        disclaimer.textContent = DATASET.upiId
          ? "Choose or enter an amount to open your UPI app with the payment prefilled."
          : "Add your UPI ID and QR image to activate direct payment.";
      }
    };

    const updateConfirmationState = () => {
      if (!confirmationState) return;
      const visible = Boolean(confirmationMode);
      confirmationState.hidden = !visible;
      if (!visible) return;

      if (confirmationMode === "confirmed") {
        confirmationTitle.textContent = "Thank you for your daan";
        confirmationText.textContent = "Your contribution supports seva, learning, and dharma. You can leave an optional gratitude note below for a future donor wall hook.";
        confirmButton.textContent = "Daan confirmed";
        confirmButton.disabled = true;
      } else {
        confirmationTitle.textContent = "After offering your daan, confirm it here";
        confirmationText.textContent = "Once your UPI app completes the payment, tap confirm below. You can also leave an optional gratitude note for a future donor wall.";
        confirmButton.textContent = "I have completed the daan";
        confirmButton.disabled = false;
      }
    };

    const revealConfirmationState = (mode = "pending") => {
      confirmationMode = mode;
      updateConfirmationState();
      confirmationState?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    const updateAmountState = () => {
      amountChips.forEach((chip) => {
        const chipAmount = Number(chip.dataset.amount || 0);
        const isCustom = chip.dataset.custom === "true";
        const isActive = isCustom ? customMode : !customMode && chipAmount === selectedAmount;
        chip.classList.toggle("is-active", isActive);
      });

      const activeChip = amountChips.find((chip) => chip.dataset.custom === "true" ? customMode : !customMode && Number(chip.dataset.amount || 0) === selectedAmount);
      const activeMeaning = activeChip?.dataset.meaning || "Select an amount to prefill your UPI donation link.";

      if (selectedAmount > 0) {
        amountPreview.textContent = `${formatAmount(selectedAmount)} selected`;
        selectionNote.textContent = activeMeaning;
        localStorage.setItem(STORAGE.selectedAmount, String(selectedAmount));
      } else {
        amountPreview.textContent = "No amount selected";
        selectionNote.textContent = "Select an amount to prefill your UPI donation link.";
        localStorage.removeItem(STORAGE.selectedAmount);
      }

      customAmountInput.value = selectedAmount > 0 ? String(selectedAmount) : "";
      updatePayNowHref();
    };

    const showToast = (message) => {
      if (!toast) return;
      toast.textContent = message;
      toast.hidden = false;
      window.clearTimeout(toastTimer);
      requestAnimationFrame(() => toast.classList.add("is-visible"));
      toastTimer = window.setTimeout(() => {
        toast.classList.remove("is-visible");
        window.setTimeout(() => {
          toast.hidden = true;
        }, 220);
      }, 2200);
    };

    const getFocusableElements = () => {
      if (!modal) return [];
      return Array.from(
        modal.querySelectorAll(
          'button:not([disabled]), [href]:not([aria-disabled="true"]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("hidden"));
    };

    const lockBody = () => document.body.classList.add("daanpatra-body-lock");
    const unlockBody = () => document.body.classList.remove("daanpatra-body-lock");

    const launchUpiApp = (upiLink) => {
      try {
        window.location.assign(upiLink);
      } catch (error) {
        window.location.href = upiLink;
      }
      window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          try {
            window.open(upiLink, "_self");
          } catch (fallbackError) {
            // no-op
          }
        }
      }, 120);
    };

    const saveDonorNote = ({ silent = false } = {}) => {
      const note = String(thankYouNoteInput?.value || "").trim();
      if (!note) {
        if (!silent) showToast("Write a short gratitude note first.");
        return false;
      }

      const existing = JSON.parse(localStorage.getItem(STORAGE.donorNotes) || "[]");
      existing.unshift({
        note,
        amount: selectedAmount || null,
        savedAt: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE.donorNotes, JSON.stringify(existing.slice(0, 10)));
      window.dispatchEvent(new CustomEvent("sms:daan-note-saved", { detail: { note, amount: selectedAmount || null } }));
      sendAnalytics("daan_note_saved", { hasNote: true });
      if (!silent) showToast("Note saved for the donor wall hook.");
      return true;
    };

    const trapFocus = (event) => {
      if (!isOpen || event.key !== "Tab") return;
      const focusable = getFocusableElements();
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
    };

    const shouldAutoOpen = () => {
      const dismissedAt = Number(localStorage.getItem(STORAGE.dismissAt) || 0);
      const sessionCount = Number(sessionStorage.getItem(STORAGE.autoCount) || 0);
      const elapsed = Date.now() - dismissedAt;
      return sessionCount < SESSION_LIMIT && (!dismissedAt || elapsed >= AUTO_REOPEN_COOLDOWN_MS);
    };

    const incrementAutoOpenCount = () => {
      const next = Number(sessionStorage.getItem(STORAGE.autoCount) || 0) + 1;
      sessionStorage.setItem(STORAGE.autoCount, String(next));
    };

    const markDismissed = () => {
      localStorage.setItem(STORAGE.dismissAt, String(Date.now()));
    };

    const open = ({ auto = false, source = "manual" } = {}) => {
      if (isOpen) return;
      if (auto && !shouldAutoOpen()) return;

      lastFocusedElement = document.activeElement;
      isOpen = true;
      backdrop.hidden = false;
      modal.hidden = false;
      requestAnimationFrame(() => {
        backdrop.classList.add("is-visible");
        modal.classList.add("is-visible");
      });

      lockBody();
      floatingButton?.setAttribute("aria-expanded", "true");
      const focusTarget = customAmountInput || closeButton || modal;
      window.setTimeout(() => focusTarget?.focus(), 50);

      if (auto) {
        incrementAutoOpenCount();
      }

      setContextCopy();
      updateAmountState();
      updatePayNowHref();
      updateConfirmationState();
      sendAnalytics("daan_modal_opened", { auto, source });
    };

    const close = ({ source = "dismiss" } = {}) => {
      if (!isOpen) return;
      isOpen = false;
      markDismissed();
      backdrop.classList.remove("is-visible");
      modal.classList.remove("is-visible");
      floatingButton?.setAttribute("aria-expanded", "false");
      unlockBody();

      window.setTimeout(() => {
        backdrop.hidden = true;
        modal.hidden = true;
      }, 280);

      if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
        lastFocusedElement.focus();
      }
      sendAnalytics("daan_modal_closed", { source });
    };

    const requestAutoOpen = (source) => {
      if (!shouldAutoOpen()) return;
      open({ auto: true, source });
    };

    const handleAmountChip = (chip) => {
      if (chip.dataset.custom === "true") {
        customMode = true;
        customAmountInput.focus();
      } else {
        customMode = false;
        selectedAmount = Number(chip.dataset.amount || 0);
        sendAnalytics("daan_amount_selected", { amount: selectedAmount, mode: "preset" });
      }
      updateAmountState();
    };

    const copyToClipboard = async (value) => {
      if (!value) {
        showToast("Add your UPI ID in Django settings first.");
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        showToast("UPI ID copied.");
        sendAnalytics("daan_upi_copied");
      } catch (error) {
        const fallbackInput = document.createElement("input");
        fallbackInput.value = value;
        document.body.appendChild(fallbackInput);
        fallbackInput.select();
        document.execCommand("copy");
        fallbackInput.remove();
        showToast("UPI ID copied.");
        sendAnalytics("daan_upi_copied", { fallback: true });
      }
    };

    floatingButton?.addEventListener("click", () => {
      open({ auto: false, source: "floating_cta" });
      sendAnalytics("daan_cta_clicked");
    });

    closeButton?.addEventListener("click", () => close({ source: "close_button" }));
    dismissButton?.addEventListener("click", () => close({ source: "not_now" }));
    backdrop?.addEventListener("click", () => close({ source: "backdrop" }));

    document.addEventListener("keydown", (event) => {
      if (!isOpen) return;
      if (event.key === "Escape") {
        close({ source: "escape" });
        return;
      }
      trapFocus(event);
    });

    amountChips.forEach((chip) => {
      chip.addEventListener("click", () => handleAmountChip(chip));
    });

    customAmountInput?.addEventListener("input", (event) => {
      const numericValue = Math.max(0, Number(event.target.value || 0));
      customMode = true;
      selectedAmount = numericValue;
      updateAmountState();
    });

    customAmountInput?.addEventListener("change", () => {
      if (selectedAmount > 0) {
        sendAnalytics("daan_amount_selected", { amount: selectedAmount, mode: "custom" });
      }
    });

    copyButton?.addEventListener("click", () => copyToClipboard(DATASET.upiId));

    payNowButton?.addEventListener("click", (event) => {
      event.preventDefault();
      const upiLink = buildUpiLink();
      if (!upiLink) {
        showToast(DATASET.upiId ? "Choose or enter an amount first." : "Add your UPI details to enable direct payment.");
        return;
      }
      revealConfirmationState("pending");
      sendAnalytics("daan_pay_now_clicked");
      showToast(`Opening your UPI app for ${formatAmount(selectedAmount)}.`);
      launchUpiApp(upiLink);
    });

    confirmButton?.addEventListener("click", () => {
      revealConfirmationState("confirmed");
      if (String(thankYouNoteInput?.value || "").trim()) {
        saveDonorNote({ silent: true });
      }
      window.dispatchEvent(new CustomEvent("sms:daan-confirmed", { detail: { amount: selectedAmount || null, note: String(thankYouNoteInput?.value || "").trim() || null } }));
      sendAnalytics("daan_confirmed");
      showToast("Thank you. Your daan has been marked as complete.");
    });

    saveNoteButton?.addEventListener("click", () => {
      saveDonorNote();
    });

    const scheduleIdleAutoTrigger = () => {
      const scheduler = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 400));
      scheduler(() => {
        autoTriggerTimer = window.setTimeout(() => requestAutoOpen("time_delay"), AUTO_TRIGGER_DELAY_MS);
      });
    };

    const onScroll = (() => {
      let ticking = false;
      return () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          const scrollMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          const ratio = window.scrollY / scrollMax;
          if (ratio >= 0.4) {
            requestAutoOpen("scroll_depth");
          }
          ticking = false;
        });
      };
    })();

    const incrementEngagement = (amount = 1, source = "engagement") => {
      const next = Number(sessionStorage.getItem(STORAGE.engagement) || 0) + amount;
      sessionStorage.setItem(STORAGE.engagement, String(next));
      if (next >= 2) {
        requestAutoOpen(source);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("sms:quiz-complete", () => requestAutoOpen("quiz_complete"));
    window.addEventListener("sms:kundali-generated", () => requestAutoOpen("kundali_generated"));
    window.addEventListener("sms:library-engaged", () => incrementEngagement(2, "library_engaged"));
    window.addEventListener("sms:meaningful-engagement", () => incrementEngagement(1, "meaningful_engagement"));

    window.SMSDaanpatra = {
      open: () => open({ auto: false, source: "api" }),
      requestAutoOpen,
      incrementEngagement,
    };

    if (!DATASET.qrUrl) {
      disclaimer.textContent = "Set donation_qr_url, donation_upi_id, and donation_payee_name to activate the live flow.";
    }

    const presetAmounts = amountChips.map((chip) => Number(chip.dataset.amount || 0)).filter(Boolean);
    customMode = selectedAmount > 0 && !presetAmounts.includes(selectedAmount);
    if (selectedAmount > 0) {
      updateAmountState();
    }

    updatePayNowHref();
    updateConfirmationState();
    setContextCopy();
    applyVariant();
    scheduleIdleAutoTrigger();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
