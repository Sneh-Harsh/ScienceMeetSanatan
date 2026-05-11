(function () {
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function csrfToken() {
    const raw = document.cookie.split("; ").find((item) => item.startsWith("csrftoken="));
    return raw ? decodeURIComponent(raw.split("=").slice(1).join("=")) : "";
  }

  function parseJsonScript(id, fallback) {
    const node = document.getElementById(id);
    if (!node) return fallback;
    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      return fallback;
    }
  }

  function bindListPage(root) {
    const initialCards = parseJsonScript("panditCardsData", []);
    const serviceWorlds = parseJsonScript("panditServiceWorldsData", []);
    const cardsGrid = qs("#panditCardsGrid", root);
    const searchForm = qs("#panditSearchForm", root);
    const filtersForm = qs("#panditFiltersForm", root);
    const filtersPanel = qs("#panditFiltersPanel", root);
    const filterToggle = qs("#panditFilterToggle", root);
    const filterClose = qs("#panditFilterClose", root);
    const resultCount = qs("#panditResultCount", root);
    const resultsSection = qs("#panditResultsSection", root);
    const cityInput = qs("#panditCityInput", root);
    const serviceSelect = qs("#panditServiceSelect", root);
    const locateBtn = qs("#panditLocateBtn", root);
    const locationStatus = qs("#panditLocationStatus", root);
    const budgetRange = qs("#panditBudgetRange", root);
    const budgetValue = qs("#panditBudgetValue", root);
    const categoryCards = qsa(".pandit-category-card", root);
    const categoryWorldModal = qs("#panditCategoryWorldModal");
    const categoryWorldContent = qs("#panditCategoryWorldContent");
    const categoryWorldClose = qs("#panditCategoryWorldClose");
    const apiUrl = root.dataset.apiUrl;
    let latestResults = initialCards;
    let latestResultCount = Number.parseInt(resultCount?.textContent || `${initialCards.length}`, 10) || initialCards.length;
    let pendingModalSlug = "";

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function formatCurrency(value) {
      return new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 0,
      }).format(Number(value) || 0);
    }

    function renderList(items, renderer) {
      if (!items?.length) return "";
      return items.map(renderer).join("");
    }

    function setActiveCategoryCard(slug) {
      categoryCards.forEach((card) => {
        card.classList.toggle("is-active", card.dataset.serviceSlug === slug);
      });
    }

    function getWorldBySlug(slug) {
      return serviceWorlds.find((item) => item.slug === slug) || null;
    }

    function buildActiveFilterChips() {
      const chips = [];
      const queryValue = qs('input[name="q"]', filtersForm)?.value?.trim();
      const cityValue = cityInput?.value?.trim();
      const languageValue = qs('select[name="language"]', filtersForm)?.value;
      const ratingValue = qs('select[name="rating"]', filtersForm)?.value;
      const availableToday = qs('input[name="available_today"]', filtersForm)?.checked;
      if (cityValue) chips.push(`City • ${cityValue}`);
      if (queryValue) chips.push(`Search • ${queryValue}`);
      if (languageValue) chips.push(`Language • ${languageValue}`);
      if (ratingValue) chips.push(`Rating • ${ratingValue}+`);
      if (availableToday) chips.push("Available today");
      return chips;
    }

    function openWorldModal() {
      if (!categoryWorldModal) return;
      categoryWorldModal.hidden = false;
      categoryWorldModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("pandit-world-modal-open");
    }

    function closeWorldModal() {
      if (!categoryWorldModal) return;
      categoryWorldModal.hidden = true;
      categoryWorldModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("pandit-world-modal-open");
      pendingModalSlug = "";
    }

    function renderWorld(world, items, count) {
      if (!world || !categoryWorldContent) {
        closeWorldModal();
        setActiveCategoryCard("");
        return;
      }
      const filterChips = buildActiveFilterChips();
      const previewItems = (items || []).slice(0, 3);
      const hasMatches = Number(count) > 0;
      const timing = world.timing || {};
      const previewMarkup = hasMatches
        ? `
          <div class="pandit-world-preview-grid">
            ${renderList(previewItems, (card) => `
              <article class="pandit-world-preview-card">
                <div class="pandit-world-preview-card__media">
                  ${card.photo ? `<img src="${escapeHtml(card.photo)}" alt="${escapeHtml(card.name)}" loading="lazy" />` : `<div class="pandit-card__avatar">${escapeHtml((card.name || "?").slice(0, 1))}</div>`}
                </div>
                <div class="pandit-world-preview-card__body">
                  <div class="pandit-world-preview-card__top">
                    <strong>${escapeHtml(card.name)}</strong>
                    <span>★ ${escapeHtml(card.rating || "4.8")}</span>
                  </div>
                  <p>${escapeHtml(card.specialization || "")}</p>
                  <div class="pandit-world-preview-card__meta">
                    <span>${escapeHtml(card.city || "")}</span>
                    <span>${escapeHtml(card.languages_display || "")}</span>
                    <span>₹${formatCurrency(card.starting_price)}</span>
                  </div>
                  <a href="/pandits/${escapeHtml(card.slug)}/" class="pandit-ghost pandit-ghost--mini">View Profile</a>
                </div>
              </article>
            `)}
          </div>
        `
        : `
          <div class="pandit-world-empty">
            <h4>No pandits matched this ritual with the current filters.</h4>
            <p>Relax the city, language, rating, or budget filters to surface more verified pandits for this ceremony.</p>
          </div>
        `;

      categoryWorldContent.innerHTML = `
        <div class="pandit-world-shell">
          <section class="pandit-world-hero">
            <div class="pandit-world-hero__copy">
              <p class="pandit-kicker">Category world • ${escapeHtml(world.sanskrit_title || world.service_name)}</p>
              <h3>${escapeHtml(world.service_name)}</h3>
              <h4>${escapeHtml(world.headline || "")}</h4>
              <p>${escapeHtml(world.hero_description || world.description || "")}</p>
              <div class="pandit-world-hero__chips">
                <span>${escapeHtml(world.icon || "🪔")} ${escapeHtml(world.sanskrit_title || "")}</span>
                <span>Starts at ₹${formatCurrency(world.base_price)}</span>
                <span>${escapeHtml(world.duration_minutes)} min ritual arc</span>
                <span>${escapeHtml((world.types || []).length)} traditional paths</span>
              </div>
            </div>
            <div class="pandit-world-hero__stats">
              <article><strong>${escapeHtml((world.deities || []).length)}</strong><span>Deity anchors</span></article>
              <article><strong>${escapeHtml((world.steps || []).length)}</strong><span>Guided ritual steps</span></article>
              <article><strong>${escapeHtml(count || 0)}</strong><span>Matching pandits now</span></article>
            </div>
          </section>

          <div class="pandit-world-layout">
            <div class="pandit-world-main">
              <section class="pandit-world-panel">
                <div class="pandit-world-panel__head">
                  <h4>What this ceremony means</h4>
                  <span>Purpose</span>
                </div>
                <div class="pandit-world-copy">
                  ${renderList(world.overview || [], (item) => `<p>${escapeHtml(item)}</p>`)}
                </div>
              </section>

              <section class="pandit-world-panel">
                <div class="pandit-world-panel__head">
                  <h4>Traditional types</h4>
                  <span>Formats</span>
                </div>
                <div class="pandit-world-type-grid">
                  ${renderList(world.types || [], (item) => `
                    <article class="pandit-world-type-card">
                      <strong>${escapeHtml(item.title)}</strong>
                      <p>${escapeHtml(item.meaning)}</p>
                    </article>
                  `)}
                </div>
              </section>

              <section class="pandit-world-panel pandit-world-panel--timing">
                <div class="pandit-world-panel__head">
                  <h4>Auspicious timing and muhurat cues</h4>
                  <span>Muhurat</span>
                </div>
                <div class="pandit-world-timing">
                  <article>
                    <strong>Auspicious months</strong>
                    <div class="pandit-world-pill-list">${renderList(timing.auspicious_months || [], (item) => `<span>${escapeHtml(item)}</span>`)}</div>
                  </article>
                  <article>
                    <strong>Avoided windows</strong>
                    <div class="pandit-world-pill-list pandit-world-pill-list--muted">${renderList(timing.avoided_periods || [], (item) => `<span>${escapeHtml(item)}</span>`)}</div>
                  </article>
                  <article>
                    <strong>Auspicious nakshatras</strong>
                    <div class="pandit-world-pill-list">${renderList(timing.nakshatras || [], (item) => `<span>${escapeHtml(item)}</span>`)}</div>
                  </article>
                  <article class="pandit-world-timing__rule">
                    <strong>Important rule</strong>
                    <p>${escapeHtml(timing.rule || "")}</p>
                  </article>
                </div>
              </section>

              <section class="pandit-world-panel">
                <div class="pandit-world-panel__head">
                  <h4>Spiritual architecture</h4>
                  <span>Philosophy</span>
                </div>
                <div class="pandit-world-bullet-grid">
                  ${renderList(world.spiritual_points || [], (item) => `<article><span>✦</span><p>${escapeHtml(item)}</p></article>`)}
                </div>
              </section>

              <section class="pandit-world-panel">
                <div class="pandit-world-panel__head">
                  <h4>Deities worshipped and why</h4>
                  <span>Invocation</span>
                </div>
                <div class="pandit-world-deity-grid">
                  ${renderList(world.deities || [], (deity) => `
                    <article class="pandit-world-deity-card">
                      <div class="pandit-world-deity-card__head">
                        <strong>${escapeHtml(deity.name)}</strong>
                        <span>${escapeHtml(deity.role || "")}</span>
                      </div>
                      <p>${escapeHtml(deity.importance || "")}</p>
                      <div class="pandit-world-pill-list">${renderList(deity.reasons || [], (reason) => `<span>${escapeHtml(reason)}</span>`)}</div>
                    </article>
                  `)}
                </div>
              </section>

              <section class="pandit-world-panel">
                <div class="pandit-world-panel__head">
                  <h4>Mantras commonly used</h4>
                  <span>Chanting</span>
                </div>
                <div class="pandit-world-mantra-grid">
                  ${renderList(world.mantras || [], (mantra) => `
                    <article class="pandit-world-mantra-card">
                      <strong>${escapeHtml(mantra.title)}</strong>
                      <div class="pandit-world-mantra-card__chant">${escapeHtml(mantra.chant || "")}</div>
                      <p>${escapeHtml(mantra.purpose || "")}</p>
                    </article>
                  `)}
                </div>
              </section>

              <section class="pandit-world-panel">
                <div class="pandit-world-panel__head">
                  <h4>Step-by-step traditional flow</h4>
                  <span>Procedure</span>
                </div>
                <div class="pandit-world-steps">
                  ${renderList(world.steps || [], (step, index) => `
                    <article class="pandit-world-step">
                      <div class="pandit-world-step__index">${index + 1}</div>
                      <div class="pandit-world-step__body">
                        <strong>${escapeHtml(step.title)}</strong>
                        <p>${escapeHtml(step.description || "")}</p>
                        <div class="pandit-world-pill-list">${renderList(step.points || [], (point) => `<span>${escapeHtml(point)}</span>`)}</div>
                      </div>
                    </article>
                  `)}
                </div>
              </section>
            </div>

            <aside class="pandit-world-side">
              <section class="pandit-world-panel pandit-world-panel--sticky">
                <div class="pandit-world-panel__head">
                  <h4>Available pandits for this ritual</h4>
                  <span>${escapeHtml(count || 0)} matches</span>
                </div>
                ${filterChips.length ? `<div class="pandit-world-filter-chips">${renderList(filterChips, (chip) => `<span>${escapeHtml(chip)}</span>`)}</div>` : ""}
                <p class="pandit-world-side__intro">These pandits already respect your active filters for city, language, budget, rating, and urgency.</p>
                ${previewMarkup}
              </section>

              <section class="pandit-world-panel">
                <div class="pandit-world-panel__head">
                  <h4>Objects and symbolism</h4>
                  <span>Ritual grammar</span>
                </div>
                <div class="pandit-world-object-list">
                  ${renderList(world.objects || [], (item) => `
                    <article>
                      <strong>${escapeHtml(item.name)}</strong>
                      <p>${escapeHtml(item.meaning)}</p>
                    </article>
                  `)}
                </div>
              </section>

              <section class="pandit-world-panel">
                <div class="pandit-world-panel__head">
                  <h4>Regional variations</h4>
                  <span>Across India</span>
                </div>
                <div class="pandit-world-region-list">
                  ${renderList(world.regional_variations || [], (item) => `
                    <article>
                      <strong>${escapeHtml(item.region)}</strong>
                      <p>${escapeHtml(item.variation)}</p>
                    </article>
                  `)}
                </div>
              </section>

              <section class="pandit-world-panel">
                <div class="pandit-world-panel__head">
                  <h4>Things traditionally avoided</h4>
                  <span>Precautions</span>
                </div>
                <div class="pandit-world-bullet-list">
                  ${renderList(world.avoidances || [], (item) => `<article><span>•</span><p>${escapeHtml(item)}</p></article>`)}
                </div>
              </section>

              ${(world.scientific_notes || world.core_meaning || []).length ? `
                <section class="pandit-world-panel">
                  <div class="pandit-world-panel__head">
                    <h4>Why it still matters today</h4>
                    <span>Meaning</span>
                  </div>
                  ${world.scientific_notes?.length ? `<div class="pandit-world-bullet-list">${renderList(world.scientific_notes, (item) => `<article><span>✦</span><p>${escapeHtml(item)}</p></article>`)}</div>` : ""}
                  ${world.core_meaning?.length ? `<div class="pandit-world-core">${renderList(world.core_meaning, (item) => `<p>${escapeHtml(item)}</p>`)}</div>` : ""}
                </section>
              ` : ""}
            </aside>
          </div>
        </div>
      `;
      setActiveCategoryCard(world.slug);
      openWorldModal();
    }

    function setHiddenValue(form, name, value) {
      const input = qs(`input[name="${name}"]`, form);
      if (input) {
        input.value = value || "";
      }
    }

    function syncSharedFields(sourceForm) {
      const queryValue = qs('input[name="q"]', filtersForm)?.value || "";
      const cityValue = cityInput?.value || "";
      const serviceValue = serviceSelect?.value || "";
      const languageValue = qs('select[name="language"]', filtersForm)?.value || "";
      const ratingValue = qs('select[name="rating"]', filtersForm)?.value || "";
      const maxPriceValue = budgetRange?.value || "";
      const availableTodayChecked = Boolean(qs('input[name="available_today"]', filtersForm)?.checked);

      if (searchForm) {
        setHiddenValue(searchForm, "q", queryValue);
        setHiddenValue(searchForm, "language", languageValue);
        setHiddenValue(searchForm, "rating", ratingValue);
        setHiddenValue(searchForm, "max_price", maxPriceValue);
        setHiddenValue(searchForm, "available_today", availableTodayChecked ? "true" : "");
      }

      if (filtersForm) {
        setHiddenValue(filtersForm, "city", cityValue);
        setHiddenValue(filtersForm, "service", serviceValue);
      }

      if (sourceForm === searchForm && filtersForm) {
        const filterQuery = qs('input[name="q"]', filtersForm);
        if (filterQuery && !filterQuery.value) {
          filterQuery.value = queryValue;
        }
      }
    }

    const renderCards = (items) => {
      if (!cardsGrid) return;
      if (!items.length) {
        cardsGrid.innerHTML = '<article class="pandit-empty-state"><h3>No pandits matched this filter set.</h3><p>Try expanding city, rating, or service filters to discover more verified profiles.</p></article>';
        return;
      }
      cardsGrid.innerHTML = items.map((card) => `
        <article class="pandit-card" data-slug="${card.slug}">
          <div class="pandit-card__visual">
            ${card.photo ? `<img src="${card.photo}" alt="${card.name}" loading="lazy" />` : `<div class="pandit-card__avatar">${(card.name || "?").slice(0, 1)}</div>`}
            <div class="pandit-card__badges">${(card.badges || []).map((badge) => `<span>${badge}</span>`).join("")}</div>
          </div>
          <div class="pandit-card__body">
            <div class="pandit-card__topline">
              <div>
                <h3>${card.name}</h3>
                <p>${card.city}${card.area ? ` • ${card.area}` : ""}</p>
              </div>
              <div class="pandit-rating">★ ${card.rating || "4.8"}</div>
            </div>
            <p class="pandit-card__specialization">${card.specialization || ""}</p>
            <div class="pandit-card__meta">
              <span>${card.experience || 0}+ years</span>
              <span>${card.total_bookings || 0} bookings</span>
              <span>${card.languages_display || (card.languages || []).join(", ")}</span>
            </div>
            <div class="pandit-card__footer">
              <div>
                <small>Starting from</small>
                <strong>₹${card.starting_price || 0}</strong>
              </div>
              <a href="/pandits/${card.slug}/" class="pandit-cta pandit-cta--small">View Profile</a>
            </div>
          </div>
        </article>
      `).join("");
    };

    const runFetch = async (form) => {
      syncSharedFields(form);
      const params = new URLSearchParams(new FormData(form));
      const cityValue = cityInput?.value;
      if (cityValue && !params.get("city")) params.set("city", cityValue);
      const serviceValue = serviceSelect?.value;
      if (serviceValue && !params.get("service")) params.set("service", serviceValue);
      const url = `${apiUrl}?${params.toString()}`;
      const response = await fetch(url, { headers: { "X-Requested-With": "XMLHttpRequest" } });
      if (!response.ok) return;
      const payload = await response.json();
      latestResults = payload.results || [];
      latestResultCount = payload.count || 0;
      renderCards(latestResults);
      if (resultCount) resultCount.textContent = latestResultCount;
      const activeService = pendingModalSlug || params.get("service") || "";
      if (activeService && pendingModalSlug) {
        renderWorld(getWorldBySlug(activeService), latestResults, latestResultCount);
      }
      const pageUrl = new URL(window.location.href);
      pageUrl.search = params.toString();
      window.history.replaceState({}, "", pageUrl);
      filtersPanel?.classList.remove("is-open");
      if (!pendingModalSlug) {
        resultsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      pendingModalSlug = "";
    };

    const onSubmit = (event) => {
      event.preventDefault();
      runFetch(event.currentTarget);
    };
    searchForm?.addEventListener("submit", onSubmit);
    filtersForm?.addEventListener("submit", onSubmit);
    filterToggle?.addEventListener("click", () => filtersPanel?.classList.add("is-open"));
    filterClose?.addEventListener("click", () => filtersPanel?.classList.remove("is-open"));

    qsa(".pandit-quick-pill", root).forEach((pill) => {
      pill.addEventListener("click", () => {
        if (cityInput) cityInput.value = pill.dataset.city || "";
        searchForm?.requestSubmit();
      });
    });

    categoryCards.forEach((card) => {
      card.addEventListener("click", (event) => {
        event.preventDefault();
        const slug = card.dataset.serviceSlug || "";
        if (serviceSelect) serviceSelect.value = slug;
        pendingModalSlug = slug;
        searchForm?.requestSubmit();
      });
    });

    const syncBudgetValue = () => {
      if (budgetRange && budgetValue) {
        budgetValue.textContent = `₹${budgetRange.value}`;
      }
    };
    syncBudgetValue();
    budgetRange?.addEventListener("input", syncBudgetValue);
    budgetRange?.addEventListener("change", () => filtersForm?.requestSubmit());
    cityInput?.addEventListener("change", () => syncSharedFields(searchForm));
    serviceSelect?.addEventListener("change", () => syncSharedFields(searchForm));
    qsa('select[name="language"], select[name="rating"], input[name="available_today"]', filtersForm).forEach((field) => {
      field.addEventListener("change", () => filtersForm?.requestSubmit());
    });

    const setLocationStatus = (text, tone = "") => {
      if (!locationStatus) return;
      locationStatus.textContent = text;
      locationStatus.dataset.tone = tone;
    };

    const findCityFromCoordinates = async (latitude, longitude) => {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("reverse_geocode_failed");
      const payload = await response.json();
      const address = payload.address || {};
      return address.city || address.town || address.state_district || address.county || address.state || "";
    };

    locateBtn?.addEventListener("click", async () => {
      if (!navigator.geolocation) {
        setLocationStatus("Location access is not supported on this device. Enter your city manually.", "error");
        return;
      }
      locateBtn.disabled = true;
      setLocationStatus("Detecting your current location…", "loading");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const detectedCity = await findCityFromCoordinates(position.coords.latitude, position.coords.longitude);
            if (!detectedCity) {
              setLocationStatus("Could not detect your city. Enter it manually for exact local matches.", "error");
              return;
            }
            if (cityInput) cityInput.value = detectedCity;
            window.localStorage.setItem("smsSelectedCity", detectedCity);
            setLocationStatus(`Showing pandits near ${detectedCity}.`, "success");
            searchForm?.requestSubmit();
          } catch (_error) {
            setLocationStatus("Could not resolve your city from current location. Enter it manually.", "error");
          } finally {
            locateBtn.disabled = false;
          }
        },
        () => {
          locateBtn.disabled = false;
          setLocationStatus("Location permission was blocked. Enter your city manually to continue.", "error");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      );
    });

    if (!cityInput?.value) {
      const cityHint = window.localStorage.getItem("smsSelectedCity") || window.localStorage.getItem("lastPanchangLocation");
      if (cityHint) {
        cityInput.value = cityHint;
        setLocationStatus(`Using your last saved city: ${cityHint}.`, "success");
      }
    }

    categoryWorldClose?.addEventListener("click", (event) => {
      event.preventDefault();
      closeWorldModal();
    });
    qsa("[data-world-close]", categoryWorldModal || document).forEach((node) => {
      node.addEventListener("click", (event) => {
        event.preventDefault();
        closeWorldModal();
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && categoryWorldModal && !categoryWorldModal.hidden) {
        closeWorldModal();
      }
    });

    syncSharedFields(searchForm);
  }

  function bindProfilePage(root) {
    const form = qs("#panditBookingForm", root);
    if (!form) return;

    const isAuthenticated = root.dataset.authenticated === "true";
    const steps = qsa(".pandit-booking-step", form);
    const bullets = qsa(".pandit-stepper button", form);
    const backBtn = qs("#panditBookingBack", form);
    const nextBtn = qs("#panditBookingNext", form);
    const submitBtn = qs("#panditBookingSubmit", form);
    const message = qs("#panditBookingMessage", form);
    const slotIdInput = qs("#panditBookingSlotId", form);
    const dateInput = qs('input[name="date"]', form);
    const timeInput = qs('input[name="time"]', form);
    const serviceSelect = qs("#panditBookingService", form);
    const priceNode = qs("#panditPriceAmount", form);
    let currentStep = 0;

    const syncStep = () => {
      steps.forEach((step, index) => step.classList.toggle("is-active", index === currentStep));
      bullets.forEach((bullet, index) => bullet.classList.toggle("is-active", index === currentStep));
      backBtn.style.visibility = currentStep === 0 ? "hidden" : "visible";
      nextBtn.hidden = currentStep === steps.length - 1;
      submitBtn.hidden = currentStep !== steps.length - 1;
    };

    bullets.forEach((bullet, index) => {
      bullet.addEventListener("click", () => {
        currentStep = index;
        syncStep();
      });
    });
    backBtn?.addEventListener("click", () => {
      currentStep = Math.max(0, currentStep - 1);
      syncStep();
    });
    nextBtn?.addEventListener("click", () => {
      currentStep = Math.min(steps.length - 1, currentStep + 1);
      syncStep();
    });

    qsa(".pandit-slot-chip[data-slot-id]").forEach((chip) => {
      chip.addEventListener("click", () => {
        qsa(".pandit-slot-chip", root).forEach((node) => node.classList.remove("is-selected"));
        chip.classList.add("is-selected");
        slotIdInput.value = chip.dataset.slotId || "";
        if (dateInput) dateInput.value = chip.dataset.date || "";
        if (timeInput) timeInput.value = chip.dataset.time || "";
        currentStep = 2;
        syncStep();
      });
    });

    serviceSelect?.addEventListener("change", () => {
      const selected = serviceSelect.selectedOptions[0];
      const price = selected?.dataset.price || "0";
      if (priceNode) priceNode.textContent = `₹${price}`;
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!isAuthenticated) {
        message.textContent = "Please log in first to keep booking history, confirmations, and notifications together.";
        return;
      }
      const payload = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(root.dataset.bookingUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        message.textContent = data.detail || "Booking could not be completed. Please review the ritual details and try again.";
        return;
      }
      message.textContent = `Booking confirmed. Code: ${data.confirmation_code}. Payment integration is UI-ready and can be connected next.`;
      form.reset();
      slotIdInput.value = "";
      currentStep = 0;
      syncStep();
      window.dispatchEvent(new CustomEvent("sms:meaningful-engagement"));
    });

    const reviewForm = qs("#panditReviewForm", root);
    reviewForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(reviewForm).entries());
      const response = await fetch(root.dataset.reviewUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken(),
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        reviewForm.reset();
      }
    });

    syncStep();
  }

  function bindDashboardPage(root) {
    const updateJsonForm = async (form, url, transform = null) => {
      const raw = Object.fromEntries(new FormData(form).entries());
      const payload = transform ? transform(raw) : raw;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken(),
        },
        body: JSON.stringify(payload),
      });
      return response.ok;
    };

    qs("#panditDashboardProfileForm", root)?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await updateJsonForm(event.currentTarget, root.dataset.profileUrl, (payload) => ({
        ...payload,
        languages: (payload.languages || "").split(",").map((item) => item.trim()).filter(Boolean),
      }));
    });

    qs("#panditDashboardServiceForm", root)?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      await fetch(root.dataset.servicesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken(),
        },
        body: JSON.stringify(payload),
      });
    });

    qs("#panditDashboardAvailabilityForm", root)?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      await fetch(root.dataset.availabilityUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken(),
        },
        body: JSON.stringify(payload),
      });
    });

    qsa(".pandit-dashboard-booking", root).forEach((bookingRow) => {
      qsa("button[data-status]", bookingRow).forEach((button) => {
        button.addEventListener("click", async () => {
          const response = await fetch(`/api/pandits/dashboard/bookings/${bookingRow.dataset.bookingId}/status/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": csrfToken(),
            },
            body: JSON.stringify({ status: button.dataset.status }),
          });
          if (response.ok) {
            const statusNode = qs(".pandit-dashboard-booking__status", bookingRow);
            if (statusNode) statusNode.textContent = button.dataset.status.replace("_", " ");
          }
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const root = qs("[data-view='list'], [data-view='detail'], [data-view='dashboard']");
    if (!root) return;
    if (root.dataset.view === "list") bindListPage(root);
    if (root.dataset.view === "detail") bindProfilePage(root);
    if (root.dataset.view === "dashboard") bindDashboardPage(root);
  });
})();
