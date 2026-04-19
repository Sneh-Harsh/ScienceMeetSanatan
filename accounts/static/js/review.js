(function () {
  const APP_CONTEXT = window.APP_CONTEXT || {};
  const STORAGE = {
    dismissedAt: "sms_review.dismissed_at",
    submittedAt: "sms_review.submitted_at",
    engagementScore: "sms_review.engagement_score",
    autoShownSession: "sms_review.auto_shown_session",
    variant: "sms_review.variant",
  };
  const AUTO_COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const SUBMISSION_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  const AUTO_THRESHOLD = 2;

  const getNumber = (storage, key) => {
    try {
      return Number(storage.getItem(key) || "0") || 0;
    } catch (error) {
      return 0;
    }
  };

  const setNumber = (storage, key, value) => {
    try {
      storage.setItem(key, String(value));
    } catch (error) {
      return;
    }
  };

  const emitAnalytics = (eventName, detail = {}) => {
    const payload = {
      event: eventName,
      pageType: String(APP_CONTEXT.pageType || "general").toLowerCase(),
      path: window.location.pathname,
      ...detail,
    };
    window.dispatchEvent(new CustomEvent("sms:analytics", { detail: payload }));
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload);
    }
  };

  const getCookie = (name) => {
    const raw = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
    return raw ? decodeURIComponent(raw.split("=").slice(1).join("=")) : "";
  };

  const getCsrfToken = () => {
    const formToken = document.querySelector("#smsReviewForm input[name='csrfmiddlewaretoken']");
    return formToken?.value || getCookie("csrftoken");
  };

  const sentimentFromRating = (rating) => {
    if (rating >= 5) return "loved";
    if (rating >= 3) return "good";
    return "needs_improvement";
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const pageToFeatureType = (pageType) => {
    const mapping = {
      library: "library",
      quiz: "quizzes",
      quizzes: "quizzes",
      kundali: "kundali",
      horoscope: "horoscope",
      panchang: "panchaang",
      baby_names: "baby_names",
    };
    return mapping[pageType] || "overall";
  };

  const ratingCopy = {
    1: "Something felt off. Tell us what should improve first.",
    2: "Thank you for staying honest. We will use this to sharpen the experience.",
    3: "A balanced experience. Tell us what would make it stronger.",
    4: "Glad this was useful. Tell us what stood out and what still needs polish.",
    5: "Beautiful. Tell us what felt most meaningful so we can deepen it.",
  };

  const contextCopy = {
    library: {
      label: "Library feedback",
      title: "Help us improve this reading journey",
      subtitle: "How was your experience with the library today?",
    },
    quizzes: {
      label: "Quiz feedback",
      title: "Help us improve this challenge",
      subtitle: "How was your quiz experience?",
    },
    quiz: {
      label: "Quiz feedback",
      title: "Help us improve this challenge",
      subtitle: "How was your quiz experience?",
    },
    kundali: {
      label: "Kundali feedback",
      title: "Help us improve this guidance",
      subtitle: "How was your kundali experience?",
    },
    horoscope: {
      label: "Horoscope feedback",
      title: "Help us improve this guidance",
      subtitle: "How was your horoscope experience?",
    },
    panchaang: {
      label: "Panchaang feedback",
      title: "Help us improve this daily journey",
      subtitle: "How was your panchaang experience?",
    },
    general: {
      label: "Feedback",
      title: "Help us improve this journey",
      subtitle: "How was your experience?",
    },
  };

  function initReviewModal() {
    const shell = document.getElementById("smsReviewShell");
    if (!shell) return;

    const trigger = document.getElementById("smsReviewTrigger");
    const backdrop = document.getElementById("smsReviewBackdrop");
    const modal = document.getElementById("smsReviewModal");
    const closeButton = document.getElementById("smsReviewClose");
    const laterButton = document.getElementById("smsReviewLaterBtn");
    const form = document.getElementById("smsReviewForm");
    const stars = Array.from(document.querySelectorAll(".review-star"));
    const submitButton = document.getElementById("smsReviewSubmitBtn");
    const ratingCopyNode = document.getElementById("smsReviewRatingCopy");
    const expandedFields = document.getElementById("smsReviewExpandedFields");
    const errorNode = document.getElementById("smsReviewError");
    const contextLabel = document.getElementById("smsReviewContextLabel");
    const titleNode = document.getElementById("smsReviewTitle");
    const subtitleNode = document.getElementById("smsReviewSubtitle");
    const featureType = document.getElementById("smsReviewFeatureType");
    const pageUrlInput = document.getElementById("smsReviewPageUrl");
    const formStep = document.getElementById("smsReviewFormStep");
    const successStep = document.getElementById("smsReviewSuccessStep");
    const daanButton = document.getElementById("smsReviewDaanBtn");
    const doneButton = document.getElementById("smsReviewDoneBtn");
    const miniChipRows = Array.from(document.querySelectorAll(".review-chip-row"));

    const pageType = String(shell.dataset.pageType || APP_CONTEXT.pageType || "general").toLowerCase();
    const copy = contextCopy[pageType] || contextCopy.general;
    let isOpen = false;
    let ratingOverall = 0;
    let lastFocused = null;
    let autoShownThisSession = Boolean(getNumber(sessionStorage, STORAGE.autoShownSession));
    const miniRatings = {
      rating_ui: null,
      rating_content: null,
      rating_speed: null,
    };

    contextLabel.textContent = copy.label;
    titleNode.textContent = copy.title;
    subtitleNode.textContent = copy.subtitle;
    if (featureType && !featureType.value) {
      featureType.value = pageToFeatureType(pageType);
    } else if (featureType) {
      featureType.value = pageToFeatureType(pageType);
    }
    if (pageUrlInput) {
      pageUrlInput.value = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    }

    const markDismissed = () => setNumber(localStorage, STORAGE.dismissedAt, Date.now());
    const markSubmitted = () => setNumber(localStorage, STORAGE.submittedAt, Date.now());

    const canAutoPrompt = () => {
      const dismissedAt = getNumber(localStorage, STORAGE.dismissedAt);
      const submittedAt = getNumber(localStorage, STORAGE.submittedAt);
      if (autoShownThisSession) return false;
      if (submittedAt && Date.now() - submittedAt < SUBMISSION_COOLDOWN_MS) return false;
      if (dismissedAt && Date.now() - dismissedAt < AUTO_COOLDOWN_MS) return false;
      return true;
    };

    const getFocusable = () =>
      Array.from(
        modal.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => !node.hidden && node.offsetParent !== null);

    const resetForm = () => {
      form.reset();
      ratingOverall = 0;
      Object.keys(miniRatings).forEach((key) => {
        miniRatings[key] = null;
      });
      stars.forEach((star) => {
        star.classList.remove("is-active", "is-filled");
      });
      miniChipRows.forEach((row) => {
        row.querySelectorAll(".review-chip").forEach((chip) => chip.classList.remove("is-active"));
      });
      expandedFields.hidden = true;
      submitButton.disabled = true;
      errorNode.hidden = true;
      errorNode.textContent = "";
      ratingCopyNode.textContent = "Select a rating to continue.";
      formStep.hidden = false;
      successStep.hidden = true;
      successStep.classList.remove("is-visible");
      if (featureType) {
        featureType.value = pageToFeatureType(pageType);
      }
      if (pageUrlInput) {
        pageUrlInput.value = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      }
    };

    const syncStarUI = (selected) => {
      stars.forEach((star) => {
        const value = Number(star.dataset.rating || 0);
        star.classList.toggle("is-filled", value <= selected);
        star.classList.toggle("is-active", value === selected);
      });
    };

    const open = ({ source = "manual", auto = false } = {}) => {
      if (isOpen) return;
      if (auto && !canAutoPrompt()) return;
      resetForm();
      lastFocused = document.activeElement;
      isOpen = true;
      document.body.classList.add("review-body-lock");
      backdrop.hidden = false;
      modal.hidden = false;
      requestAnimationFrame(() => {
        backdrop.classList.add("is-visible");
        modal.classList.add("is-visible");
      });
      trigger?.setAttribute("aria-expanded", "true");
      window.setTimeout(() => closeButton?.focus(), 40);
      emitAnalytics("review_opened", { source, auto });
      if (auto) {
        autoShownThisSession = true;
        setNumber(sessionStorage, STORAGE.autoShownSession, 1);
      }
    };

    const close = ({ source = "dismiss", remember = true } = {}) => {
      if (!isOpen) return;
      isOpen = false;
      if (remember) {
        markDismissed();
      }
      document.body.classList.remove("review-body-lock");
      trigger?.setAttribute("aria-expanded", "false");
      backdrop.classList.remove("is-visible");
      modal.classList.remove("is-visible");
      window.setTimeout(() => {
        backdrop.hidden = true;
        modal.hidden = true;
      }, 220);
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
      emitAnalytics("review_closed", { source });
    };

    const maybeAutoPrompt = (source) => {
      const nextScore = getNumber(sessionStorage, STORAGE.engagementScore) + 1;
      setNumber(sessionStorage, STORAGE.engagementScore, nextScore);
      if (nextScore >= AUTO_THRESHOLD) {
        open({ source, auto: true });
      }
    };

    const collectPayload = () => {
      const formData = new FormData(form);
      return {
        name_display: String(formData.get("name_display") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        feature_type: String(formData.get("feature_type") || pageToFeatureType(pageType)).trim(),
        page_url: String(formData.get("page_url") || "").trim(),
        rating_overall: ratingOverall,
        rating_ui: miniRatings.rating_ui,
        rating_content: miniRatings.rating_content,
        rating_speed: miniRatings.rating_speed,
        title: String(formData.get("title") || "").trim(),
        review_text: String(formData.get("review_text") || "").trim(),
        improvement_suggestion: String(formData.get("improvement_suggestion") || "").trim(),
        sentiment: sentimentFromRating(ratingOverall),
        is_public: Boolean(formData.get("is_public")),
      };
    };

    trigger?.addEventListener("click", () => open({ source: "floating_button" }));
    closeButton?.addEventListener("click", () => close({ source: "close_button" }));
    laterButton?.addEventListener("click", () => close({ source: "maybe_later" }));
    doneButton?.addEventListener("click", () => close({ source: "success_done", remember: false }));
    backdrop?.addEventListener("click", () => close({ source: "backdrop" }));

    document.addEventListener("keydown", (event) => {
      if (!isOpen) return;
      if (event.key === "Escape") {
        close({ source: "escape" });
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
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
    });

    stars.forEach((star) => {
      star.addEventListener("click", () => {
        ratingOverall = Number(star.dataset.rating || 0);
        syncStarUI(ratingOverall);
        expandedFields.hidden = false;
        submitButton.disabled = false;
        ratingCopyNode.textContent = ratingCopy[ratingOverall] || "Thank you for rating the experience.";
        window.requestAnimationFrame(() => {
          expandedFields.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    });

    miniChipRows.forEach((row) => {
      const ratingKey = row.dataset.miniRating;
      row.querySelectorAll(".review-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          row.querySelectorAll(".review-chip").forEach((node) => node.classList.remove("is-active"));
          chip.classList.add("is-active");
          miniRatings[ratingKey] = Number(chip.dataset.value || 0);
        });
      });
    });

    daanButton?.addEventListener("click", () => {
      emitAnalytics("daan_clicked_after_review");
      close({ source: "daan_after_review", remember: false });
      window.setTimeout(() => {
        window.SMSDaanpatra?.open?.();
      }, 120);
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!ratingOverall) {
        errorNode.textContent = "Please select an overall rating first.";
        errorNode.hidden = false;
        return;
      }

      const payload = collectPayload();
      submitButton.disabled = true;
      errorNode.hidden = true;
      emitAnalytics("review_submit_started", { rating: ratingOverall, featureType: payload.feature_type });

      try {
        const response = await fetch("/api/reviews/", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCsrfToken(),
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.review_text?.[0] || data?.detail || data?.error || "Could not submit feedback right now.");
        }

        markSubmitted();
        formStep.hidden = true;
        successStep.hidden = false;
        successStep.classList.remove("is-visible");
        window.requestAnimationFrame(() => {
          successStep.classList.add("is-visible");
          successStep.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        emitAnalytics("review_submitted", {
          rating: ratingOverall,
          featureType: payload.feature_type,
          isPublic: payload.is_public,
        });
      } catch (error) {
        errorNode.textContent = error.message || "Could not submit feedback right now.";
        errorNode.hidden = false;
        submitButton.disabled = false;
      }
    });

    window.addEventListener("sms:quiz-complete", () => maybeAutoPrompt("quiz_complete"));
    window.addEventListener("sms:kundali-generated", () => maybeAutoPrompt("kundali_generated"));
    window.addEventListener("sms:library-engaged", () => maybeAutoPrompt("library_engaged"));
    window.addEventListener("sms:meaningful-engagement", () => maybeAutoPrompt("meaningful_engagement"));

    let scrollPrompted = false;
    window.addEventListener(
      "scroll",
      () => {
        if (scrollPrompted) return;
        const scrollMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        if (window.scrollY / scrollMax >= 0.45) {
          scrollPrompted = true;
          maybeAutoPrompt("scroll_depth");
        }
      },
      { passive: true }
    );

    window.setTimeout(() => {
      maybeAutoPrompt("time_spent");
    }, 35000);

    window.SMSReview = {
      open,
      close,
      incrementEngagement: maybeAutoPrompt,
    };
  }

  async function initTestimonials() {
    const root = document.getElementById("smsTestimonials");
    if (!root) return;

    const track = document.getElementById("smsTestimonialsTrack");
    const averageNode = document.getElementById("smsTestimonialsAverage");
    const countNode = document.getElementById("smsTestimonialsCount");
    const breakdownNode = document.getElementById("smsTestimonialsBreakdown");

    try {
      const [statsResponse, reviewsResponse] = await Promise.all([
        fetch("/api/reviews/stats/", { credentials: "same-origin" }),
        fetch("/api/reviews/public/?limit=8", { credentials: "same-origin" }),
      ]);

      const stats = await statsResponse.json();
      const reviews = await reviewsResponse.json();

      averageNode.textContent = stats.total_reviews ? `${Number(stats.average_rating || 0).toFixed(1)} / 5` : "—";
      countNode.textContent = stats.total_reviews || 0;

      const breakdown = stats.rating_breakdown || {};
      breakdownNode.innerHTML = [5, 4, 3, 2, 1]
        .map((star) => {
          return `<span class="testimonial-breakdown-pill">${"★".repeat(star)} <strong>${breakdown[String(star)] || 0}</strong></span>`;
        })
        .join("");

      if (!Array.isArray(reviews) || !reviews.length) {
        track.innerHTML = `
          <article class="testimonial-card testimonial-card--placeholder">
            <div class="testimonial-card__stars">★★★★★</div>
            <h3>No public testimonials yet</h3>
            <p>Share feedback from the floating feedback button. Approved testimonials will appear here.</p>
          </article>
        `;
        return;
      }

      track.innerHTML = reviews
        .map((review) => {
          const stars = "★".repeat(Number(review.rating_overall || 0));
          return `
            <article class="testimonial-card">
              <div class="testimonial-card__stars">${stars}</div>
              <div class="testimonial-card__meta">
                <div class="testimonial-card__identity">
                  <div class="testimonial-card__avatar">${escapeHtml(review.initials || "S")}</div>
                  <div>
                    <div class="testimonial-card__name">${escapeHtml(review.name_display || "Seeker")}</div>
                    <div class="testimonial-card__feature">${escapeHtml(review.feature_label || "Overall experience")}</div>
                  </div>
                </div>
                <div class="testimonial-card__date">${escapeHtml(review.created_label || "")}</div>
              </div>
              <h3>${escapeHtml(review.title || "A meaningful experience")}</h3>
              <p>${escapeHtml(review.review_text || "")}</p>
            </article>
          `;
        })
        .join("");
    } catch (error) {
      averageNode.textContent = "—";
      countNode.textContent = "—";
      breakdownNode.innerHTML = "";
      track.innerHTML = `
        <article class="testimonial-card testimonial-card--placeholder">
          <div class="testimonial-card__stars">★★★★★</div>
          <h3>Testimonials are unavailable</h3>
          <p>We could not load public feedback right now.</p>
        </article>
      `;
    }
  }

  const boot = () => {
    initReviewModal();
    initTestimonials();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
