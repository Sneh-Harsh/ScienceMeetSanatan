(function () {
  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function getCsrfToken() {
    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith("csrftoken="));
    return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  async function postJson(url, payload) {
    return fetchJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCsrfToken(),
      },
      body: JSON.stringify(payload),
    });
  }

  function startChatRedirect(authenticated, astrologerId) {
    if (!authenticated) {
      window.location.href = `/login/?mode=login&next=${encodeURIComponent(window.location.pathname)}`;
      return Promise.resolve(null);
    }
    return postJson("/api/chat-sessions/start/", {
      astrologer_id: astrologerId,
      birth_share_mode: "none",
    });
  }

  function renderCard(card) {
    const expertise = (card.expertise_preview || [])
      .map((item) => `<span>${item}</span>`)
      .join("");
    const languages = (card.languages || []).join(", ");
    const image = card.photo
      ? `<img src="${card.photo}" alt="${card.display_name}" loading="lazy" />`
      : `<div class="consult-card__avatar">${(card.display_name || "?").slice(0, 1)}</div>`;

    return `
      <article class="consult-card">
        <div class="consult-card__visual">
          ${image}
          <div class="consult-card__badges">
            ${card.is_verified ? "<span>Verified</span>" : ""}
            ${card.free_chat_badge ? `<span>${card.free_chat_badge}</span>` : ""}
          </div>
          <span class="consult-live-pill ${card.is_online ? "is-live" : ""}">${card.online_status}</span>
        </div>
        <div class="consult-card__body">
          <div class="consult-card__topline">
            <div>
              <h3>${card.display_name}</h3>
              <p>${card.city || "Remote"}</p>
            </div>
            <div class="consult-rating">★ ${card.rating}</div>
          </div>
          <div class="consult-chip-row">${expertise}</div>
          <div class="consult-card__meta">
            <span>${card.experience_years}+ yrs</span>
            <span>${languages}</span>
            <span>${card.total_consultations} consults</span>
          </div>
          <div class="consult-card__footer">
            <div>
              <small>Starts at</small>
              <strong>₹${card.price_per_minute}/min</strong>
            </div>
            <div class="consult-card__actions">
              <a class="consult-ghost consult-ghost--small" href="/astrologers/${card.slug}/">View Profile</a>
              <button class="consult-cta consult-cta--small" type="button" data-start-chat="${card.id}">Chat Now</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function bindChatLaunch(root, authenticated) {
    qsa("[data-start-chat]", root).forEach((button) => {
      button.addEventListener("click", async () => {
        const result = await startChatRedirect(authenticated, button.dataset.startChat);
        if (!result) {
          return;
        }
        const { response, data } = result;
        if (!response.ok) {
          window.alert(data.detail || "Could not start chat right now.");
          return;
        }
        window.location.href = `/astrologers/chat/${data.public_id}/`;
      });
    });
  }

  function bindMarketplace(root) {
    if (!root) {
      return;
    }

    const authenticated = root.dataset.authenticated === "true";
    const apiUrl = root.dataset.apiUrl;
    const searchForm = qs("#astrologerSearchForm", root);
    const filtersForm = qs("#astrologerFiltersForm", root);
    const filtersPanel = qs("#astrologerFiltersPanel", root);
    const openFiltersButton = qs("#astrologerFilterToggle", root);
    const closeFiltersButton = qs("#astrologerFilterClose", root);
    const resultsSection = qs("#astrologerResultsSection", root);
    const grid = qs("#astrologerCardsGrid", root);
    const searchInput = qs('input[name="q"]', searchForm);

    function renderCards(items) {
      if (!grid) {
        return;
      }
      grid.innerHTML = (items || []).map(renderCard).join("");
      bindChatLaunch(grid, authenticated);
    }

    async function runFetch(form) {
      const params = new URLSearchParams(new FormData(form));
      if (searchForm && form !== searchForm) {
        new FormData(searchForm).forEach((value, key) => {
          if (value && !params.get(key)) {
            params.set(key, value);
          }
        });
      }

      const { response, data } = await fetchJson(`${apiUrl}?${params.toString()}`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!response.ok) {
        return;
      }

      renderCards(data.results || []);
      const nextUrl = new URL(window.location.href);
      nextUrl.search = params.toString();
      window.history.replaceState({}, "", nextUrl);
      if (filtersPanel) {
        filtersPanel.classList.remove("is-open");
      }
      if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function onSubmit(event) {
      event.preventDefault();
      runFetch(event.currentTarget);
    }

    searchForm && searchForm.addEventListener("submit", onSubmit);
    filtersForm && filtersForm.addEventListener("submit", onSubmit);
    openFiltersButton &&
      openFiltersButton.addEventListener("click", () => {
        filtersPanel && filtersPanel.classList.add("is-open");
      });
    closeFiltersButton &&
      closeFiltersButton.addEventListener("click", () => {
        filtersPanel && filtersPanel.classList.remove("is-open");
      });

    qsa("[data-search-chip]", root).forEach((button) => {
      button.addEventListener("click", () => {
        if (searchInput) {
          searchInput.value = button.dataset.searchChip || "";
        }
        if (searchForm) {
          runFetch(searchForm);
        }
      });
    });

    bindChatLaunch(root, authenticated);
  }

  function bindProfile(root) {
    if (!root) {
      return;
    }

    const authenticated = root.dataset.authenticated === "true";
    const form = qs("#consultStartForm", root);
    const message = qs("#consultStartMessage", root);
    const favoriteButton = qs("#consultFavoriteButton", root);

    qsa(".consult-chip-button[data-topic]", root).forEach((button) => {
      button.addEventListener("click", () => {
        const topicInput = qs('input[name="topic"]', form);
        if (topicInput) {
          topicInput.value = button.dataset.topic || "";
        }
      });
    });

    form &&
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!authenticated) {
          window.location.href = `/login/?mode=login&next=${encodeURIComponent(window.location.pathname)}`;
          return;
        }

        const payload = Object.fromEntries(new FormData(form).entries());
        const { response, data } = await postJson(root.dataset.startUrl, payload);
        if (!response.ok) {
          message.textContent = data.detail || "Could not start consultation.";
          return;
        }
        window.location.href = `/astrologers/chat/${data.public_id}/`;
      });

    favoriteButton &&
      favoriteButton.addEventListener("click", async () => {
        if (!authenticated) {
          window.location.href = `/login/?mode=login&next=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        const { response, data } = await postJson(root.dataset.favoriteUrl, {});
        if (!response.ok) {
          message.textContent = "Could not update favorite right now.";
          return;
        }
        favoriteButton.textContent = data.favorited ? "Following" : "Follow astrologer";
        message.textContent = data.favorited
          ? "This astrologer is now saved to your favorites."
          : "Astrologer removed from favorites.";
      });
  }

  function formatTimer(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainderSeconds = seconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainderSeconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(remainderSeconds).padStart(2, "0")}`;
  }

  function renderMessages(feed, messages) {
    if (!feed) {
      return;
    }

    feed.innerHTML = (messages || [])
      .map((item) => {
        const variant =
          item.sender === "user"
            ? "user"
            : item.sender === "system"
              ? "system"
              : "astrologer";
        return `
          <article class="consult-bubble consult-bubble--${variant}">
            <div class="consult-bubble__meta">
              <span>${item.sender}</span>
              <span>${new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div>${item.message}</div>
          </article>
        `;
      })
      .join("");
    feed.scrollTop = feed.scrollHeight;
  }

  function bindChatPage(root) {
    if (!root) {
      return;
    }

    const feed = qs("#consultChatFeed", root);
    const form = qs("#consultMessageForm", root);
    const timerNode = qs("#consultSessionTimer", root);
    const stateNode = qs("#consultSessionState", root);
    const typingNode = qs("#consultTypingIndicator", root);
    const endButton = qs("#consultEndButton", root);
    const reviewForm = qs("#consultReviewForm", root);
    const reviewMessage = qs("#consultReviewMessage", root);
    const summaryPanel = qs("#consultSessionSummary", root);
    const summaryText = qs("#consultSessionSummaryText", root);
    const payloadNode = qs("#consultSessionPayload");

    let sessionData = {};
    if (payloadNode) {
      try {
        sessionData = JSON.parse(payloadNode.textContent || "{}");
      } catch (_error) {
        sessionData = {};
      }
    }

    let startedAt = sessionData.started_at ? new Date(sessionData.started_at) : new Date();
    let pollHandle = null;

    function showSummary(data) {
      if (!summaryPanel || !summaryText) {
        return;
      }
      summaryPanel.hidden = false;
      summaryText.textContent = `Session completed. Total duration: ${formatTimer(
        data.total_duration_seconds || 0,
      )} • Final charge: ₹${data.total_charge || 0}.`;
    }

    function updateTimer() {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
      if (timerNode) {
        timerNode.textContent = formatTimer(elapsed);
      }
    }

    async function refresh() {
      const { response, data } = await fetchJson(root.dataset.messagesUrl, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!response.ok) {
        return;
      }

      sessionData = data.session || sessionData;
      renderMessages(feed, data.messages || []);

      if (stateNode) {
        stateNode.textContent = `Wallet ₹${data.wallet.balance} • Charged at ₹${sessionData.rate_per_minute}/min after ${sessionData.free_minutes} free minute(s).`;
      }

      if (typingNode) {
        const latest = (data.messages || []).slice(-1)[0];
        typingNode.hidden = !(
          sessionData.status === "active" &&
          latest &&
          latest.sender === "user"
        );
      }

      if (sessionData.started_at) {
        startedAt = new Date(sessionData.started_at);
      }

      if (sessionData.status !== "active") {
        form && (form.hidden = true);
        showSummary(sessionData);
        if (pollHandle) {
          clearInterval(pollHandle);
          pollHandle = null;
        }
      }
    }

    form &&
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = qs('textarea[name="message"]', form);
        if (!input || !input.value.trim()) {
          return;
        }
        const { response, data } = await postJson(root.dataset.messagesUrl, {
          message: input.value.trim(),
        });
        if (!response.ok) {
          stateNode && (stateNode.textContent = data.detail || "Could not send message.");
          return;
        }
        input.value = "";
        renderMessages(feed, [...(sessionData.messages || []), data]);
        refresh();
      });

    qsa("[data-quick-message]", root).forEach((button) => {
      button.addEventListener("click", async () => {
        const text = button.dataset.quickMessage || "";
        if (!text) {
          return;
        }
        const { response } = await postJson(root.dataset.messagesUrl, { message: text });
        if (response.ok) {
          refresh();
        }
      });
    });

    endButton &&
      endButton.addEventListener("click", async () => {
        const { response, data } = await postJson(root.dataset.endUrl, { ended_by: "user" });
        if (!response.ok) {
          stateNode && (stateNode.textContent = data.detail || "Could not end session right now.");
          return;
        }
        stateNode && (stateNode.textContent = `Session ended. Total charged: ₹${data.total_charge}.`);
        showSummary(data);
        form && (form.hidden = true);
        await refresh();
      });

    reviewForm &&
      reviewForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(reviewForm).entries());
        payload.astrologer_id = root.dataset.astrologerId;
        payload.session_id = root.dataset.sessionId;
        const { response, data } = await postJson(root.dataset.reviewUrl, payload);
        if (!response.ok) {
          reviewMessage.textContent = data.detail || "Could not submit review right now.";
          return;
        }
        reviewMessage.textContent = "Review submitted. Thank you for rating this astrologer.";
        reviewForm.reset();
      });

    renderMessages(feed, sessionData.messages || []);
    if (sessionData.status && sessionData.status !== "active") {
      form && (form.hidden = true);
      showSummary(sessionData);
    }
    updateTimer();
    refresh();
    setInterval(updateTimer, 1000);
    pollHandle = setInterval(refresh, 3000);
  }

  function bindWalletPage(root) {
    if (!root) {
      return;
    }

    const form = qs("#walletRechargeForm", root);
    const message = qs("#walletRechargeMessage", root);

    qsa("[data-amount]", root).forEach((button) => {
      button.addEventListener("click", () => {
        const amount = button.dataset.amount || "";
        const input = qs('input[name="amount"]', form);
        if (input) {
          input.value = amount;
        }
        qsa("[data-amount]", root).forEach((item) => item.classList.remove("is-selected"));
        button.classList.add("is-selected");
      });
    });

    form &&
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(form).entries());
        const { response, data } = await postJson(root.dataset.rechargeUrl, payload);
        message.textContent = data.detail || "Recharge updated.";
        if (response.ok) {
          window.location.reload();
        }
      });
  }

  function bindDashboard(root) {
    if (!root) {
      return;
    }

    const profileForm = qs("#astrologerDashboardProfileForm", root);
    const availabilityForm = qs("#astrologerAvailabilityForm", root);
    const message = qs("#astrologerDashboardMessage", root);

    profileForm &&
      profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(profileForm).entries());
        const { response } = await fetchJson(root.dataset.profileUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCsrfToken(),
          },
          body: JSON.stringify(payload),
        });
        message.textContent = response.ok ? "Profile updated." : "Could not update profile.";
      });

    availabilityForm &&
      availabilityForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(availabilityForm).entries());
        const { response, data } = await postJson(root.dataset.availabilityUrl, payload);
        if (!response.ok) {
          message.textContent = data.detail || "Could not add availability.";
          return;
        }
        window.location.reload();
      });
  }

  bindMarketplace(qs("#astrologerMarketplace"));
  bindProfile(qs("#astrologerProfilePage"));
  bindChatPage(qs("#consultChatPage"));
  bindWalletPage(qs("#walletPage"));
  bindDashboard(qs("#astrologerDashboardPage"));
})();
