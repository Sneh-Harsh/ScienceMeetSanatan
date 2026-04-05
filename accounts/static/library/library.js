const libraryPage = document.getElementById("libraryPage");
const libraryDetailPage = document.getElementById("libraryDetailPage");
const libraryPayloadNode = document.getElementById("libraryPayloadData");
const FIXED_LIBRARY_CATEGORIES = [
  "Aartis",
  "Books",
  "Audios",
  "Bhajans",
  "Vedas",
  "Upanishads",
  "Chalisas",
  "Sacred Hymns",
];

const debounce = (callback, wait = 220) => {
  let timeoutId = null;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), wait);
  };
};

const safeJson = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed == null ? fallback : parsed;
  } catch (error) {
    return fallback;
  }
};

const setStatus = (node, text) => {
  if (node) node.textContent = text;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const highlight = (text, query) => {
  if (!query) return escapeHtml(text);
  const plain = String(text ?? "");
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escapeHtml(plain).replace(
    new RegExp(`(${escapedQuery})`, "ig"),
    "<mark>$1</mark>"
  );
};

const splitLines = (value) =>
  String(value || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

const rememberRecent = (item) => {
  const existing = safeJson(localStorage.getItem("sms-library-recent"), []);
  const trimmed = existing.filter((entry) => entry.slug !== item.slug);
  trimmed.unshift({
    slug: item.slug,
    name: item.name,
    category: item.category,
  });
  localStorage.setItem("sms-library-recent", JSON.stringify(trimmed.slice(0, 5)));
};

const getRecent = () => safeJson(localStorage.getItem("sms-library-recent"), []);

const bookmarkItem = (item) => {
  const current = safeJson(localStorage.getItem("sms-library-bookmarks"), []);
  const next = current.some((entry) => entry.slug === item.slug)
    ? current
    : [...current, { slug: item.slug, name: item.name }];
  localStorage.setItem("sms-library-bookmarks", JSON.stringify(next));
};

const initLibraryListPage = () => {
  const seed = safeJson(libraryPayloadNode ? libraryPayloadNode.textContent : "", { items: [], featured: [], categories: [] });
  const error = libraryPage.dataset.error || "";
  const grid = document.getElementById("libraryGrid");
  const empty = document.getElementById("libraryEmpty");
  const featuredRail = document.getElementById("featuredRail");
  const searchInput = document.getElementById("librarySearch");
  const categoryFilter = document.getElementById("categoryFilter");
  const languageFilter = document.getElementById("languageFilter");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const featuredScrollBtn = document.getElementById("featuredScrollBtn");
  const exploreCollectionBtn = document.getElementById("exploreCollectionBtn");
  const statusNode = document.getElementById("libraryStatus");
  const heroTotalCount = document.getElementById("heroTotalCount");
  const heroCategoryCount = document.getElementById("heroCategoryCount");
  const recentlyViewed = document.getElementById("recentlyViewed");
  const presetCategories = [...FIXED_LIBRARY_CATEGORIES];

  let items = Array.isArray(seed.items) ? seed.items : [];
  let visibleCount = 9;
  let query = "";
  let category = "all";
  let language = "all";

  const renderRecent = () => {
    const recent = getRecent();
    if (!recentlyViewed) return;
    recentlyViewed.innerHTML = recent.length
      ? recent
          .map(
            (item) => `
              <a class="recent-chip" href="/library/${encodeURIComponent(item.slug)}/">
                <span>${escapeHtml(item.name)}</span>
                <span>${escapeHtml(item.category)}</span>
              </a>
            `
          )
          .join("")
      : `<div class="recent-chip"><span>No recent readings yet</span><span>Start exploring</span></div>`;
  };

  const renderFeatured = () => {
    const featured = Array.isArray(seed.featured) && seed.featured.length ? seed.featured : items.slice(0, 3);
    featuredRail.innerHTML = (featured.length ? featured : [{
      slug: "",
      name: "No featured text yet",
      excerpt: "Add local library files to populate the featured shelf.",
      content_type: "text",
    }])
      .map(
        (item, index) => `
          <a class="featured-card" href="${item.slug ? `/library/${encodeURIComponent(item.slug)}/` : '#'}" style="animation-delay:${index * 90}ms">
            <span class="featured-label">✨ ${escapeHtml(item.content_type === "pdf" ? "Scripture" : "Featured")}</span>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.excerpt || item.category)}</p>
          </a>
        `
      )
      .join("");
  };

  const filteredItems = () =>
    items.filter((item) => {
      const matchesCategory = category === "all" || item.category.toLowerCase() === category;
      const matchesLanguage =
        language === "all" ||
        item.content_type === "pdf" ||
        category === "books" ||
        Boolean(item.languages?.[language]);
      const haystack = [
        item.name,
        item.deity,
        item.category,
        item.languages?.hindi,
        item.languages?.english,
        item.languages?.transliteration,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesCategory && matchesLanguage && matchesQuery;
    });

  const renderGrid = () => {
    const filtered = filteredItems();
    const visible = filtered.slice(0, visibleCount);
    grid.innerHTML = visible
      .map(
        (item) => `
          <a class="library-card" href="/library/${encodeURIComponent(item.slug)}/">
            <div class="library-card__head">
              <span class="library-card__badge">${escapeHtml(item.category)}</span>
              <span>${item.content_type === "pdf" ? "📘 PDF Reader" : "🪔 Aarti Reader"}</span>
            </div>
            <div>
              <h3 class="library-card__title">${highlight(item.name, query)}</h3>
              <p class="library-card__excerpt">${highlight(item.excerpt || "A premium reading experience for sacred literature.", query)}</p>
            </div>
            <div class="library-card__foot">
              <span>${item.content_type === "pdf" ? item.reader_modes.map((mode) => mode === "pdf" ? "PDF" : mode === "chapter" ? "Chapter Wise" : "Shloka Wise").join(" • ") : `${item.languages?.hindi ? "Hindi" : ""}${item.languages?.english ? " • English" : ""}${item.languages?.transliteration ? " • Transliteration" : ""}`}</span>
              <span>Open →</span>
            </div>
          </a>
        `
      )
      .join("");

    empty.hidden = filtered.length !== 0;
    loadMoreBtn.hidden = filtered.length <= visible.length;
    setStatus(statusNode, filtered.length ? `${filtered.length} sacred text${filtered.length > 1 ? "s" : ""} found` : "No matching texts yet");
    heroTotalCount.textContent = String(items.length);
    heroCategoryCount.textContent = String(FIXED_LIBRARY_CATEGORIES.length);
  };

  const populateCategories = () => {
    categoryFilter.innerHTML = `<option value="all">All categories</option>${FIXED_LIBRARY_CATEGORIES
      .map((entry) => `<option value="${escapeHtml(entry.toLowerCase())}">${escapeHtml(entry)}</option>`)
      .join("")}`;
  };

  const refreshFromApi = async () => {
    if (!items.length && error) {
      setStatus(statusNode, error);
      return;
    }

    try {
      setStatus(statusNode, "Syncing local library assets...");
      const response = await fetch("/api/library/?refresh=1");
      if (!response.ok) throw new Error("Could not refresh the library feed.");
      const payload = await response.json();
      items = Array.isArray(payload.items) ? payload.items : items;
      seed.categories = Array.isArray(payload.categories) ? payload.categories : seed.categories;
      seed.featured = Array.isArray(payload.items) ? payload.items.filter((item) => item.featured).slice(0, 8) : seed.featured;
      populateCategories();
      renderFeatured();
      renderGrid();
      setStatus(statusNode, "Local library synced and ready");
    } catch (fetchError) {
      setStatus(statusNode, error || fetchError.message || "Showing cached library");
      renderGrid();
    }
  };

  featuredScrollBtn?.addEventListener("click", () => {
    const firstFeatured = (Array.isArray(seed.featured) && seed.featured.length ? seed.featured[0] : items[0]) || null;
    if (firstFeatured?.slug) {
      window.location.href = `/library/${encodeURIComponent(firstFeatured.slug)}/`;
      return;
    }
    featuredRail?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  exploreCollectionBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("libraryGrid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  searchInput?.addEventListener(
    "input",
    debounce((event) => {
      query = event.target.value.trim().toLowerCase();
      visibleCount = 9;
      renderGrid();
    })
  );

  categoryFilter?.addEventListener("change", (event) => {
    category = event.target.value;
    visibleCount = 9;
    renderGrid();
  });

  languageFilter?.addEventListener("change", (event) => {
    language = event.target.value;
    visibleCount = 9;
    renderGrid();
  });

  loadMoreBtn?.addEventListener("click", () => {
    visibleCount += 6;
    renderGrid();
  });

  renderFeatured();
  populateCategories();
  renderRecent();
  renderGrid();
  refreshFromApi();
};

const initLibraryDetailPage = () => {
  const slug = libraryDetailPage.dataset.slug;
  const title = document.getElementById("detailTitle");
  const excerpt = document.getElementById("detailExcerpt");
  const categoryNode = document.getElementById("detailCategory");
  const deityNode = document.getElementById("detailDeity");
  const readerHeading = document.getElementById("readerHeading");
  const readerContent = document.getElementById("readerContent");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const readerPageStatus = document.getElementById("readerPageStatus");
  const readerNav = document.getElementById("readerNav");
  const prevPageBtnBottom = document.getElementById("prevPageBtnBottom");
  const nextPageBtnBottom = document.getElementById("nextPageBtnBottom");
  const readerPageStatusBottom = document.getElementById("readerPageStatusBottom");
  const readerNavBottom = document.getElementById("readerNavBottom");
  const fullscreenReaderBtn = document.getElementById("fullscreenReaderBtn");
  const fullscreenReaderBtnBottom = document.getElementById("fullscreenReaderBtnBottom");
  const copyTextBtn = document.getElementById("copyTextBtn");
  const bookmarkBtn = document.getElementById("bookmarkBtn");
  const shareBtn = document.getElementById("shareBtn");
  const languageToggle = document.getElementById("languageToggle");
  const readingModeToggle = document.getElementById("readingModeToggle");
  const toggleButtons = [...document.querySelectorAll("#languageToggle button")];
  const readingButtons = [...document.querySelectorAll("#readingModeToggle button")];

  let itemData = null;
  let currentLanguage = "hindi";
  let currentReadingMode = "language";
  let currentBookPage = 0;
  let currentPdfPage = 1;
  const fullscreenTarget = document.querySelector(".reader-card");

  const updateReaderNav = (options = {}) => {
    const {
      enabled = true,
      prevDisabled = false,
      nextDisabled = false,
      status = "",
    } = options;
    if (readerNav) {
      readerNav.hidden = !enabled;
    }
    if (readerNavBottom) {
      readerNavBottom.hidden = !enabled;
    }
    if (prevPageBtn) prevPageBtn.disabled = !enabled || prevDisabled;
    if (nextPageBtn) nextPageBtn.disabled = !enabled || nextDisabled;
    if (prevPageBtnBottom) prevPageBtnBottom.disabled = !enabled || prevDisabled;
    if (nextPageBtnBottom) nextPageBtnBottom.disabled = !enabled || nextDisabled;
    if (readerPageStatus) readerPageStatus.textContent = status;
    if (readerPageStatusBottom) readerPageStatusBottom.textContent = status;
  };

  const syncFullscreenButtons = () => {
    const active = document.fullscreenElement === fullscreenTarget
      || document.webkitFullscreenElement === fullscreenTarget;
    const label = active ? "⤢ Exit Fullscreen" : "⛶ Fullscreen";
    if (fullscreenReaderBtn) fullscreenReaderBtn.textContent = label;
    if (fullscreenReaderBtnBottom) fullscreenReaderBtnBottom.textContent = label;
  };

  const toggleFullscreenReader = async () => {
    if (!fullscreenTarget) return;
    try {
      const active = document.fullscreenElement === fullscreenTarget
        || document.webkitFullscreenElement === fullscreenTarget;
      if (active) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      } else if (fullscreenTarget.requestFullscreen) {
        await fullscreenTarget.requestFullscreen();
      } else if (fullscreenTarget.webkitRequestFullscreen) {
        fullscreenTarget.webkitRequestFullscreen();
      }
    } catch (error) {
      console.warn("Fullscreen mode unavailable", error);
    } finally {
      syncFullscreenButtons();
    }
  };

  const renderStructuredSection = (list, emptyMessage, titleKey, bodyKey) => {
    updateReaderNav({ enabled: false, status: "Structured reading view" });
    if (!Array.isArray(list) || !list.length) {
      readerContent.innerHTML = `<div class="reader-empty-state">${escapeHtml(emptyMessage)}</div>`;
      return;
    }

    readerContent.innerHTML = list
      .map((entry, index) => {
        const title = entry[titleKey] || entry.title || `Section ${index + 1}`;
        const body = entry[bodyKey] || entry.text || entry.content || "";
        return `
          <section class="structured-block">
            <div class="structured-block__title">${escapeHtml(title)}</div>
            <div class="structured-block__body">${splitLines(body)
              .map((line) => `<div class="reader-line">${escapeHtml(line)}</div>`)
              .join("")}</div>
          </section>
        `;
      })
      .join("");
  };

  const renderBookSpread = (lines, pageIndex) => {
    const linesPerSide = 8;
    const linesPerSpread = linesPerSide * 2;
    const totalSpreads = Math.max(1, Math.ceil(lines.length / linesPerSpread));
    const safePageIndex = Math.min(Math.max(pageIndex, 0), totalSpreads - 1);
    currentBookPage = safePageIndex;
    const start = safePageIndex * linesPerSpread;
    const leftLines = lines.slice(start, start + linesPerSide);
    const rightLines = lines.slice(start + linesPerSide, start + linesPerSpread);

    updateReaderNav({
      enabled: true,
      prevDisabled: safePageIndex === 0,
      nextDisabled: safePageIndex >= totalSpreads - 1,
      status: `Spread ${safePageIndex + 1} of ${totalSpreads}`,
    });

    const renderPage = (pageLines, label) => `
      <section class="book-page">
        <div class="book-page__label">${label}</div>
        <div class="book-page__body">
          ${pageLines.length
            ? pageLines
                .map(
                  (line, index) =>
                    `<div class="reader-line" style="animation-delay:${index * 35}ms">${escapeHtml(line)}</div>`
                )
                .join("")
            : `<div class="reader-line reader-line--muted">This page is intentionally left calm.</div>`}
        </div>
      </section>
    `;

    readerContent.innerHTML = `
      <div class="book-shell">
        <div class="book-spine" aria-hidden="true"></div>
        ${renderPage(leftLines, "Left Page")}
        ${renderPage(rightLines, "Right Page")}
      </div>
    `;
  };

  const renderPdfSpread = async () => {
    readerContent.classList.add("reader-content--pdf");
    updateReaderNav({
      enabled: true,
      prevDisabled: currentPdfPage <= 1,
      nextDisabled: false,
      status: `PDF page ${currentPdfPage}`,
    });
    if (!itemData.pdf_url) {
      readerContent.innerHTML = `<div class="reader-empty-state">PDF file is not available yet for this scripture.</div>`;
      return;
    }

    const pdfSource = `${itemData.pdf_url}#toolbar=0&navpanes=0&scrollbar=0&page=${currentPdfPage}&view=FitH`;
    readerContent.innerHTML = `
      <div class="pdf-reader-shell book-shell book-shell--pdf">
        <div class="pdf-reader-glow" aria-hidden="true"></div>
        <div class="book-page book-page--pdf">
          <div class="book-page__label">Digital Scripture</div>
          <div class="pdf-reader-stage">
            <div class="pdf-reader-topbar">
              <div class="pdf-reader-topbar__title">Immersive Reading Mode</div>
              <div class="pdf-reader-topbar__meta">Page ${currentPdfPage}</div>
            </div>
            <div class="pdf-frame-wrap">
              <iframe
                class="pdf-frame"
                id="pdfFrame"
                src="${escapeHtml(pdfSource)}"
                title="${escapeHtml(itemData.name)} PDF Reader"
                loading="lazy"
                allow="fullscreen"
              ></iframe>
            </div>
            <div class="pdf-reader-actions">
              <a class="detail-action-btn" href="${escapeHtml(pdfSource)}" target="_blank" rel="noreferrer">Open Full Page</a>
              <button type="button" class="detail-action-btn" id="pdfReloadBtn">Refresh Page</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const pdfFrame = document.getElementById("pdfFrame");
    const pdfReloadBtn = document.getElementById("pdfReloadBtn");
    const handlePdfFailure = () => {
      readerContent.innerHTML = `
        <div class="reader-empty-state">
          In-app preview is unavailable on this browser right now.
          <div style="margin-top:1rem; display:flex; gap:.8rem; justify-content:center; flex-wrap:wrap;">
            <a class="detail-action-btn" href="${escapeHtml(pdfSource)}" target="_blank" rel="noreferrer">Open Full Page</a>
            <a class="detail-action-btn" href="${escapeHtml(itemData.pdf_url)}" target="_blank" rel="noreferrer">Download PDF</a>
          </div>
        </div>
      `;
      updateReaderNav({ enabled: true, prevDisabled: currentPdfPage <= 1, nextDisabled: false, status: `PDF page ${currentPdfPage}` });
    };

    pdfFrame?.addEventListener("load", () => {
      updateReaderNav({
        enabled: true,
        prevDisabled: currentPdfPage <= 1,
        nextDisabled: false,
        status: `PDF page ${currentPdfPage}`,
      });
    });

    pdfFrame?.addEventListener("error", handlePdfFailure, { once: true });
    pdfReloadBtn?.addEventListener("click", () => {
      const frame = document.getElementById("pdfFrame");
      if (frame) {
        frame.src = `${itemData.pdf_url}#toolbar=0&navpanes=0&scrollbar=0&page=${currentPdfPage}&view=FitH&refresh=${Date.now()}`;
      }
    });

    window.setTimeout(() => {
      const frame = document.getElementById("pdfFrame");
      if (!frame || !frame.src) {
        handlePdfFailure();
      }
    }, 2200);
  };

  const renderReader = () => {
    if (!itemData) return;

    if (itemData.content_type === "pdf") {
      if (currentReadingMode === "chapter") {
        readerHeading.textContent = `${itemData.name} • Chapter Wise`;
        renderStructuredSection(
          itemData.structure?.chapters,
          "Chapter-wise data is ready for this scripture as soon as you add a companion manifest JSON.",
          "title",
          "content"
        );
        return;
      }

      if (currentReadingMode === "shloka") {
        readerHeading.textContent = `${itemData.name} • Shloka Wise`;
        renderStructuredSection(
          itemData.structure?.shlokas,
          "Shloka-wise reading will appear here when you add a shloka manifest JSON for this scripture.",
          "title",
          "content"
        );
        return;
      }

      readerHeading.textContent = `${itemData.name} • Kindle Style Reader`;
      renderPdfSpread();
      return;
    }

    readerContent.classList.remove("reader-content--pdf");
    const text = itemData.languages?.[currentLanguage] || itemData.languages?.english || itemData.languages?.hindi || itemData.languages?.transliteration || "";
    const lines = splitLines(text);
    readerHeading.textContent = `${itemData.name} • ${currentLanguage[0].toUpperCase()}${currentLanguage.slice(1)}`;
    if (!lines.length) {
      updateReaderNav({ enabled: false, status: "No text available" });
      readerContent.innerHTML = `<div class="reader-line">No ${currentLanguage} text is available yet for this entry.</div>`;
      return;
    }
    renderBookSpread(lines, currentBookPage);
  };

  const setActiveLanguage = (language) => {
    currentLanguage = language;
    currentBookPage = 0;
    toggleButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.language === language);
    });
    renderReader();
  };

  const setActiveReadingMode = (mode) => {
    currentReadingMode = mode;
    currentPdfPage = 1;
    readingButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
    renderReader();
  };

  const initActions = () => {
    const goPrev = () => {
      if (!itemData) return;
      if (itemData.content_type === "pdf" && currentReadingMode === "pdf") {
        currentPdfPage = Math.max(1, currentPdfPage - 1);
        renderReader();
        return;
      }
      currentBookPage = Math.max(0, currentBookPage - 1);
      renderReader();
    };

    const goNext = () => {
      if (!itemData) return;
      if (itemData.content_type === "pdf" && currentReadingMode === "pdf") {
        currentPdfPage += 1;
        renderReader();
        return;
      }
      currentBookPage += 1;
      renderReader();
    };

    toggleButtons.forEach((button) => {
      button.addEventListener("click", () => setActiveLanguage(button.dataset.language));
    });

    readingButtons.forEach((button) => {
      button.addEventListener("click", () => setActiveReadingMode(button.dataset.mode));
    });

    prevPageBtn?.addEventListener("click", goPrev);
    nextPageBtn?.addEventListener("click", goNext);
    prevPageBtnBottom?.addEventListener("click", goPrev);
    nextPageBtnBottom?.addEventListener("click", goNext);
    fullscreenReaderBtn?.addEventListener("click", toggleFullscreenReader);
    fullscreenReaderBtnBottom?.addEventListener("click", toggleFullscreenReader);
    document.addEventListener("fullscreenchange", syncFullscreenButtons);
    document.addEventListener("webkitfullscreenchange", syncFullscreenButtons);

    copyTextBtn?.addEventListener("click", async () => {
      if (!itemData) return;
      const text =
        itemData.content_type === "pdf"
          ? window.location.href
          : itemData.languages?.[currentLanguage] || itemData.languages?.english || itemData.languages?.hindi || itemData.languages?.transliteration || "";
      await navigator.clipboard.writeText(text);
      copyTextBtn.textContent = "Copied";
      window.setTimeout(() => {
        copyTextBtn.textContent = "Copy";
      }, 1200);
    });

    bookmarkBtn?.addEventListener("click", () => {
      if (!itemData) return;
      bookmarkItem(itemData);
      bookmarkBtn.textContent = "Bookmarked";
      window.setTimeout(() => {
        bookmarkBtn.textContent = "Bookmark";
      }, 1200);
    });

    shareBtn?.addEventListener("click", async () => {
      if (!itemData) return;
      const sharePayload = {
        title: itemData.name,
        text: itemData.excerpt || itemData.name,
        url: window.location.href,
      };

      if (navigator.share) {
        try {
          await navigator.share(sharePayload);
          return;
        } catch (error) {
          // ignore canceled share
        }
      }

      await navigator.clipboard.writeText(window.location.href);
      shareBtn.textContent = "Link Copied";
      window.setTimeout(() => {
        shareBtn.textContent = "Share";
      }, 1200);
    });
  };

  const loadDetail = async () => {
    try {
      const response = await fetch(`/api/library/${encodeURIComponent(slug)}/`);
      if (!response.ok) throw new Error("Could not load this sacred text.");
      itemData = await response.json();
      title.textContent = itemData.name;
      excerpt.textContent = itemData.excerpt || "A timeless devotional text from the spiritual library.";
      categoryNode.textContent = itemData.category;
      deityNode.textContent = itemData.deity || itemData.name;
      rememberRecent(itemData);
      if (itemData.content_type === "pdf") {
        languageToggle.hidden = true;
        readingModeToggle.hidden = false;
        readingButtons.forEach((button) => {
          button.hidden = !itemData.reader_modes?.includes(button.dataset.mode);
        });
        setActiveReadingMode(itemData.default_reader_mode || "pdf");
      } else {
        languageToggle.hidden = false;
        readingModeToggle.hidden = true;
        setActiveLanguage(itemData.languages?.hindi ? "hindi" : itemData.languages?.english ? "english" : "transliteration");
      }
    } catch (error) {
      excerpt.textContent = error.message || "Could not load this library entry.";
      categoryNode.textContent = "Unavailable";
      deityNode.textContent = "Unavailable";
      readerContent.innerHTML = `<div class="reader-line">${escapeHtml(error.message || "Please try again later.")}</div>`;
    }
  };

  initActions();
  syncFullscreenButtons();
  loadDetail();
};

if (libraryPage) {
  initLibraryListPage();
}

if (libraryDetailPage) {
  initLibraryDetailPage();
}
