const libraryPage = document.getElementById("libraryPage");
const libraryDetailPage = document.getElementById("libraryDetailPage");
const libraryPayloadNode = document.getElementById("libraryPayloadData");
const FIXED_LIBRARY_CATEGORIES = [
  "Aartis",
  "Books",
  "Audios",
  "Bhajans",
  "Mantras",
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

const formatRelativeTime = (value) => {
  if (!value) return "Recently opened";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Recently opened";
  const diff = Date.now() - dt.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

const rememberReadingProgress = (entry) => {
  if (!entry?.slug) return;
  const existing = safeJson(localStorage.getItem("sms-library-progress"), []);
  const next = existing.filter((item) => item.slug !== entry.slug);
  next.unshift(entry);
  localStorage.setItem("sms-library-progress", JSON.stringify(next.slice(0, 8)));
};

const getReadingProgress = () => safeJson(localStorage.getItem("sms-library-progress"), []);

const CONTINUE_READING_COVERS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCSpylc4bIDzyGBUkLWzETpjF1T5XQIYw1DCHv9OPROPu_3rArGfvZryjAtBwqWGNE-Su5ABNM2uC1_7wEhxXU1sMm6wt49v_mbbdKbAtdFGsgafflZFP2QxG7bgFHZrZ3nxuLgz0s9tZC5QFie8CoSM22kfdNBQtGAwwc0jzSvlkjY9d1M5K_haxZKocy0b0SK4Ds6RA3GVHajAN_7etw_4kt9fig5-8WwpRzKXEKnGgQ2Bw3zYlfrE1dUhp8LDqsuI0vs2cNOP_YK=s384-rw",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDcB5mPZ8neflsd0RjKvYNAUOMZd4IdjSXFip7IiQ5mFG6r35Qg9ocLKQMqKr1xYwebwZy7gtv9aHEag6EKQGUMwik2U2fjvsdmFaYJCFBIB_t-lULSf1Eu0KeHD9-6az83e68C2FDy4EcUEAZN6uIzpU843DM4qUoYtwVSUJ9658MWixyElljCxQ-yygHcv4sQGiw_Lmh8OTLS6W5nxug7_kD9dvH8foEHelkoCuUaetjxxOcM_luOnsePVjeOdGkZ7oFy9DqboLsQ=s384-rw",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBOGyva3303proDeUscVSBb9AH6aKQB77bnDAPJrBrPeTkTPrW9c-sQY9fewQ3nytx_gcb2EghJ3kwQeTdgEedwriWz5sZyipxJ-ddc6jhiFnSm2al7E6PdJx3g8V6Rz9R0DnGkwxI6FNq5be5NiCyKPwyukrMt0g2w9U4lD32HgsM4OczprXBYLjF_U_KyaBoWa6vNFt3XnX7SKquswjS928bGAHB--0lYRRpoAEmnxNKCklftDeQXxItsEkLFGaWXPGVGZGDB5BWQ=s384-rw",
];

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

const AUDIO_SESSION_KEY = "sms-library-audio-session";
const AUDIO_BOOKMARKS_KEY = "sms-library-audio-bookmarks";
const AUDIO_FAVORITES_KEY = "sms-library-audio-favorites";
const AUDIO_SESSION_VERSION = 2;
const AUDIO_SPEEDS = [1, 1.25, 1.5];
const AUDIO_COVER_IMAGES = {
  Aartis: "https://lh3.googleusercontent.com/aida-public/AB6AXuDcB5mPZ8neflsd0RjKvYNAUOMZd4IdjSXFip7IiQ5mFG6r35Qg9ocLKQMqKr1xYwebwZy7gtv9aHEag6EKQGUMwik2U2fjvsdmFaYJCFBIB_t-lULSf1Eu0KeHD9-6az83e68C2FDy4EcUEAZN6uIzpU843DM4qUoYtwVSUJ9658MWixyElljCxQ-yygHcv4sQGiw_Lmh8OTLS6W5nxug7_kD9dvH8foEHelkoCuUaetjxxOcM_luOnsePVjeOdGkZ7oFy9DqboLsQ=s384-rw",
  Audios: "https://res.cloudinary.com/dmnm8z8dc/image/upload/f_auto,q_auto,w_1000/v1776006859/universe-revealed-img_oalmxr.jpg",
  Bhajans: "https://lh3.googleusercontent.com/aida-public/AB6AXuCSpylc4bIDzyGBUkLWzETpjF1T5XQIYw1DCHv9OPROPu_3rArGfvZryjAtBwqWGNE-Su5ABNM2uC1_7wEhxXU1sMm6wt49v_mbbdKbAtdFGsgafflZFP2QxG7bgFHZrZ3nxuLgz0s9tZC5QFie8CoSM22kfdNBQtGAwwc0jzSvlkjY9d1M5K_haxZKocy0b0SK4Ds6RA3GVHajAN_7etw_4kt9fig5-8WwpRzKXEKnGgQ2Bw3zYlfrE1dUhp8LDqsuI0vs2cNOP_YK=s384-rw",
  Books: "https://lh3.googleusercontent.com/aida-public/AB6AXuBOGyva3303proDeUscVSBb9AH6aKQB77bnDAPJrBrPeTkTPrW9c-sQY9fewQ3nytx_gcb2EghJ3kwQeTdgEedwriWz5sZyipxJ-ddc6jhiFnSm2al7E6PdJx3g8V6Rz9R0DnGkwxI6FNq5be5NiCyKPwyukrMt0g2w9U4lD32HgsM4OczprXBYLjF_U_KyaBoWa6vNFt3XnX7SKquswjS928bGAHB--0lYRRpoAEmnxNKCklftDeQXxItsEkLFGaWXPGVGZGDB5BWQ=s384-rw",
  Chalisas: "https://lh3.googleusercontent.com/aida-public/AB6AXuBOGyva3303proDeUscVSBb9AH6aKQB77bnDAPJrBrPeTkTPrW9c-sQY9fewQ3nytx_gcb2EghJ3kwQeTdgEedwriWz5sZyipxJ-ddc6jhiFnSm2al7E6PdJx3g8V6Rz9R0DnGkwxI6FNq5be5NiCyKPwyukrMt0g2w9U4lD32HgsM4OczprXBYLjF_U_KyaBoWa6vNFt3XnX7SKquswjS928bGAHB--0lYRRpoAEmnxNKCklftDeQXxItsEkLFGaWXPGVGZGDB5BWQ=s384-rw",
  Mantras: "https://res.cloudinary.com/dmnm8z8dc/image/upload/f_auto,q_auto,w_1000/v1776006859/universe-revealed-img_oalmxr.jpg",
  Upanishads: "https://lh3.googleusercontent.com/aida-public/AB6AXuCSpylc4bIDzyGBUkLWzETpjF1T5XQIYw1DCHv9OPROPu_3rArGfvZryjAtBwqWGNE-Su5ABNM2uC1_7wEhxXU1sMm6wt49v_mbbdKbAtdFGsgafflZFP2QxG7bgFHZrZ3nxuLgz0s9tZC5QFie8CoSM22kfdNBQtGAwwc0jzSvlkjY9d1M5K_haxZKocy0b0SK4Ds6RA3GVHajAN_7etw_4kt9fig5-8WwpRzKXEKnGgQ2Bw3zYlfrE1dUhp8LDqsuI0vs2cNOP_YK=s384-rw",
  Vedas: "https://res.cloudinary.com/dmnm8z8dc/image/upload/f_auto,q_auto,w_1000/v1776006859/universe-revealed-img_oalmxr.jpg",
  "Sacred Hymns": "https://lh3.googleusercontent.com/aida-public/AB6AXuDcB5mPZ8neflsd0RjKvYNAUOMZd4IdjSXFip7IiQ5mFG6r35Qg9ocLKQMqKr1xYwebwZy7gtv9aHEag6EKQGUMwik2U2fjvsdmFaYJCFBIB_t-lULSf1Eu0KeHD9-6az83e68C2FDy4EcUEAZN6uIzpU843DM4qUoYtwVSUJ9658MWixyElljCxQ-yygHcv4sQGiw_Lmh8OTLS6W5nxug7_kD9dvH8foEHelkoCuUaetjxxOcM_luOnsePVjeOdGkZ7oFy9DqboLsQ=s384-rw",
};

const getItemDeityTags = (item = {}) => {
  if (Array.isArray(item.deity_tags) && item.deity_tags.length) {
    return item.deity_tags
      .map((tag) => String(tag || "").trim())
      .filter(Boolean);
  }
  return String(item.deity || "")
    .split(/\s*(?:,|\/|&|\band\b)\s*/i)
    .map((tag) => tag.replace(/\b(lord|shri|shree|maa|mata|deity)\b/gi, "").trim())
    .map((tag) => tag.replace(/\s+/g, " ").trim())
    .filter(Boolean);
};

const buildRangeSeekPreview = (seconds, duration, refs) => {
  const safeDuration = Number(duration || 0);
  const safeSeconds = Math.max(0, Math.min(safeDuration || Number(seconds || 0), Number(seconds || 0)));
  const pct = safeDuration > 0 ? (safeSeconds / safeDuration) * 100 : 0;
  if (refs.currentTime) refs.currentTime.textContent = formatDuration(safeSeconds);
  if (refs.progressRange) refs.progressRange.value = String(safeSeconds);
  if (refs.miniProgressRange) refs.miniProgressRange.value = String(safeSeconds);
  if (refs.playedFill) refs.playedFill.style.width = `${pct}%`;
  if (refs.miniProgressFill) refs.miniProgressFill.style.width = `${pct}%`;
};

const formatDuration = (value) => {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getAudioFavorites = () => new Set(safeJson(localStorage.getItem(AUDIO_FAVORITES_KEY), []));

const appendCollectionQuery = (href, collectionSlug = "") => {
  const normalized = String(collectionSlug || "").trim().toLowerCase();
  if (!normalized || normalized === "all") return href;
  const joiner = href.includes("?") ? "&" : "?";
  return `${href}${joiner}from_collection=${encodeURIComponent(normalized)}`;
};

const buildAudioTrackFromItem = (item) => {
  if (!item?.slug) return null;
  const audioUrl = String(item.audio_url || "").trim();
  if (!audioUrl) return null;
  const category = item.category || "Aartis";
  const coverImage = item.cover_image || item.coverImage || AUDIO_COVER_IMAGES[category] || CONTINUE_READING_COVERS[0];
  const singer = String(item.singer || "").trim();
  const subtitleParts = [];
  if (singer) subtitleParts.push(singer);
  if (item.deity) subtitleParts.push(item.deity);
  subtitleParts.push(category);
  return {
    slug: item.slug,
    title: item.name || item.slug,
    subtitle: subtitleParts.filter(Boolean).join(" • "),
    audioUrl,
    coverImage,
    category,
    singer,
    hasExplicitAudio: true,
    sourceLabel: "Sacred audio",
  };
};

const dedupeAudioTracks = (tracks = []) => {
  const seen = new Set();
  return tracks.filter((track) => {
    if (!track?.slug || !track.audioUrl || seen.has(track.slug)) return false;
    seen.add(track.slug);
    return true;
  });
};

const createLibraryAudioPlayer = () => {
  if (window.__smsLibraryAudioPlayer) return window.__smsLibraryAudioPlayer;
  const shell = document.getElementById("audioPlayerShell");
  if (!shell) {
    const stub = {
      openTrack() {},
      setQueue() {},
      syncSession() {},
    };
    window.__smsLibraryAudioPlayer = stub;
    return stub;
  }

  const refs = {
    mini: document.getElementById("audioMiniPlayer"),
    miniExpandBtn: document.getElementById("audioMiniExpandBtn"),
    miniCoverImage: document.getElementById("audioMiniCoverImage"),
    miniTitle: document.getElementById("audioMiniTitle"),
    miniSubtitle: document.getElementById("audioMiniSubtitle"),
    miniState: document.getElementById("audioMiniState"),
    miniProgressFill: document.getElementById("audioMiniProgressFill"),
    miniBufferedFill: document.getElementById("audioMiniBufferedFill"),
    miniProgressRange: document.getElementById("audioMiniProgressRange"),
    miniPrevBtn: document.getElementById("audioMiniPrevBtn"),
    miniPlayBtn: document.getElementById("audioMiniPlayBtn"),
    miniNextBtn: document.getElementById("audioMiniNextBtn"),
    miniCloseBtn: document.getElementById("audioMiniCloseBtn"),
    fullscreen: document.getElementById("audioFullscreen"),
    closeBackdrop: document.getElementById("audioCloseBackdrop"),
    fullscreenPanel: document.getElementById("audioFullscreenPanel"),
    ambient: document.getElementById("audioAmbient"),
    minimizeBtn: document.getElementById("audioMinimizeBtn"),
    stopBtn: document.getElementById("audioStopBtn"),
    bookmarkTimeBtn: document.getElementById("audioBookmarkTimeBtn"),
    favoriteBtn: document.getElementById("audioFavoriteBtn"),
    coverImage: document.getElementById("audioCoverImage"),
    trackKicker: document.getElementById("audioTrackKicker"),
    trackTitle: document.getElementById("audioTrackTitle"),
    trackSubtitle: document.getElementById("audioTrackSubtitle"),
    trackCounter: document.getElementById("audioTrackCounter"),
    trackState: document.getElementById("audioTrackState"),
    errorBanner: document.getElementById("audioErrorBanner"),
    errorMessage: document.getElementById("audioErrorMessage"),
    currentTime: document.getElementById("audioCurrentTime"),
    duration: document.getElementById("audioDuration"),
    progressRange: document.getElementById("audioProgressRange"),
    bufferedFill: document.getElementById("audioBufferedFill"),
    playedFill: document.getElementById("audioPlayedFill"),
    progressLabel: document.getElementById("audioProgressLabel"),
    speedLabel: document.getElementById("audioSpeedLabel"),
    playBtn: document.getElementById("audioPlayBtn"),
    prevBtn: document.getElementById("audioPrevBtn"),
    nextBtn: document.getElementById("audioNextBtn"),
    back10Btn: document.getElementById("audioBack10Btn"),
    forward10Btn: document.getElementById("audioForward10Btn"),
    repeatBtn: document.getElementById("audioRepeatBtn"),
    speedBtn: document.getElementById("audioSpeedBtn"),
    muteBtn: document.getElementById("audioMuteBtn"),
    volumeRange: document.getElementById("audioVolumeRange"),
    bufferMeta: document.getElementById("audioBufferMeta"),
    volumeMeta: document.getElementById("audioVolumeMeta"),
    playbackMode: document.getElementById("audioPlaybackMode"),
    playbackMeta: document.getElementById("audioPlaybackMeta"),
    resumeMeta: document.getElementById("audioResumeMeta"),
    queueMeta: document.getElementById("audioQueueMeta"),
    queueList: document.getElementById("audioQueueList"),
  };

  const audio = new Audio();
  audio.preload = "metadata";
  audio.crossOrigin = "anonymous";
  audio.playsInline = true;
  audio.volume = 1;
  audio.muted = false;

  let queue = [];
  let currentIndex = -1;
  let isExpanded = false;
  let repeatMode = "off";
  let speed = 1;
  let volume = 1;
  let isMuted = false;
  let isLoading = false;
  let playerError = "";
  let hasStreamError = false;
  let pendingAutoplay = false;
  let isSeeking = false;
  let isMiniSeeking = false;
  let seekPreviewTime = null;
  let playerHistoryPushed = false;
  let progressRaf = 0;
  let pendingErrorTimer = 0;
  const favoriteSet = getAudioFavorites();

  const getTrack = () => queue[currentIndex] || null;
  const repeatModeLabel = () => repeatMode === "one" ? "Repeat One" : repeatMode === "all" ? "Repeat All" : "Repeat Off";
  const hasReliablePlaybackSignal = () =>
    Number(audio.currentTime || 0) > 0
    || Number(audio.duration || 0) > 0
    || (!audio.paused && audio.readyState >= 2)
    || audio.readyState >= 3;
  const shouldMarkHardError = () => {
    if (hasReliablePlaybackSignal()) return false;
    if (!audio.currentSrc) return true;
    if (audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) return true;
    if (Boolean(audio.error) && audio.readyState === 0 && audio.networkState !== HTMLMediaElement.NETWORK_LOADING) return true;
    return false;
  };
  const clearPlaybackError = () => {
    playerError = "";
    hasStreamError = false;
    if (pendingErrorTimer) {
      window.clearTimeout(pendingErrorTimer);
      pendingErrorTimer = 0;
    }
  };
  const hasBlockingError = () => {
    if (!hasStreamError || !playerError) return false;
    if (isLoading || !audio.paused) return false;
    return shouldMarkHardError();
  };
  const bufferedPct = () => {
    const duration = Number(audio.duration || 0);
    if (!duration || !audio.buffered?.length) return 0;
    try {
      const end = audio.buffered.end(audio.buffered.length - 1);
      return Math.max(0, Math.min(100, (end / duration) * 100));
    } catch (error) {
      return 0;
    }
  };

  const stopProgressLoop = () => {
    if (progressRaf) {
      window.cancelAnimationFrame(progressRaf);
      progressRaf = 0;
    }
  };

  const startProgressLoop = () => {
    stopProgressLoop();
    const tick = () => {
      if (audio.paused || !getTrack()) {
        progressRaf = 0;
        return;
      }
      render();
      progressRaf = window.requestAnimationFrame(tick);
    };
    progressRaf = window.requestAnimationFrame(tick);
  };

  const persist = () => {
    const track = getTrack();
    if (!track) return;
    localStorage.setItem(
      AUDIO_SESSION_KEY,
      JSON.stringify({
        version: AUDIO_SESSION_VERSION,
        queue,
        currentIndex,
        currentTime: Number(audio.currentTime || 0),
        wasPlaying: !audio.paused,
        repeatMode,
        speed,
        volume,
        isMuted,
      })
    );
  };

  const updateMountState = () => {
    document.body.classList.toggle("library-audio-mounted", !shell.hidden);
    document.body.classList.toggle("library-audio-open", isExpanded);
    shell.classList.toggle("is-playing", !audio.paused);
    shell.classList.toggle("is-loading", isLoading);
    shell.classList.toggle("has-error", hasBlockingError());
  };

  const clearSession = () => {
    localStorage.removeItem(AUDIO_SESSION_KEY);
  };

  const pushPlayerHistoryState = () => {
    if (playerHistoryPushed) return;
    try {
      window.history.pushState({ ...(window.history.state || {}), smsAudioPlayerOpen: true }, "", window.location.href);
      playerHistoryPushed = true;
    } catch (error) {
      playerHistoryPushed = false;
    }
  };

  const closeExpandedPlayerState = () => {
    if (!isExpanded) return;
    if (playerHistoryPushed) {
      window.history.back();
      return;
    }
    isExpanded = false;
    render();
  };

  const updateQueue = () => {
    refs.queueList.innerHTML = queue.length
      ? queue
          .map((track, index) => `
            <button type="button" class="audio-queue-item ${index === currentIndex ? "is-active" : ""}" data-index="${index}">
              <img src="${escapeHtml(track.coverImage)}" alt="" />
              <span class="audio-queue-item__meta">
                <strong>${escapeHtml(track.title)}</strong>
                <span>${escapeHtml(track.subtitle)}</span>
              </span>
              <span class="audio-queue-item__tag">${index === currentIndex ? "Now" : track.sourceLabel}</span>
            </button>
          `)
          .join("")
      : `<div class="audio-queue-empty">Choose an item from the library to start the audio sanctuary.</div>`;
    refs.queueMeta.textContent = `${queue.length} track${queue.length === 1 ? "" : "s"}`;
    refs.queueList.querySelectorAll("[data-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextIndex = Number(button.dataset.index);
        if (Number.isFinite(nextIndex)) {
          currentIndex = nextIndex;
          loadCurrentTrack(true, 0);
        }
      });
    });
  };

  const render = () => {
    const track = getTrack();
    if (!track) {
      shell.hidden = true;
      updateMountState();
      return;
    }

    shell.hidden = false;
    refs.fullscreen.hidden = !isExpanded;
    refs.miniCoverImage.src = track.coverImage;
    refs.coverImage.src = track.coverImage;
    refs.miniTitle.textContent = track.title;
    refs.trackTitle.textContent = track.title;
    refs.miniSubtitle.textContent = track.subtitle;
    refs.trackSubtitle.textContent = track.subtitle;
    refs.trackKicker.textContent = track.sourceLabel;
    refs.trackCounter.textContent = `Track ${currentIndex + 1} of ${queue.length}`;
    if (refs.playbackMode) refs.playbackMode.textContent = track.hasExplicitAudio ? "Audio ready" : "Preview stream";
    if (refs.playbackMeta) {
      refs.playbackMeta.textContent = "Streaming from your spiritual library audio collection.";
    }
    refs.ambient.style.backgroundImage = `linear-gradient(180deg, rgba(7,10,16,.18), rgba(7,10,16,.82)), url('${track.coverImage}')`;
    refs.favoriteBtn.textContent = favoriteSet.has(track.slug) ? "Favorited" : "Favorite";
    const duration = Number(audio.duration || 0);
    const currentTime = Number((isSeeking || isMiniSeeking) && seekPreviewTime != null ? seekPreviewTime : audio.currentTime || 0);
    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferPct = bufferedPct();
    refs.currentTime.textContent = formatDuration(currentTime);
    refs.duration.textContent = formatDuration(duration);
    refs.progressRange.max = String(duration || 100);
    if (!isSeeking) refs.progressRange.value = String(currentTime);
    refs.miniProgressRange.max = String(duration || 100);
    if (!isMiniSeeking) refs.miniProgressRange.value = String(currentTime);
    refs.miniProgressFill.style.width = `${progressPct}%`;
    refs.miniBufferedFill.style.width = `${bufferPct}%`;
    refs.playedFill.style.width = `${progressPct}%`;
    refs.bufferedFill.style.width = `${bufferPct}%`;
    refs.playBtn.textContent = audio.paused ? "▶" : "❚❚";
    refs.miniPlayBtn.textContent = audio.paused ? "▶" : "❚❚";
    refs.repeatBtn.textContent = repeatModeLabel();
    refs.speedBtn.textContent = `Speed ${speed}×`;
    refs.speedLabel.textContent = `${speed}×`;
    refs.muteBtn.textContent = isMuted || volume === 0 ? "Unmute" : "Mute";
    refs.volumeRange.value = String(isMuted ? 0 : volume);
    if (refs.volumeMeta) refs.volumeMeta.textContent = `${Math.round((isMuted ? 0 : volume) * 100)}%`;
    if (refs.bufferMeta) refs.bufferMeta.textContent = `${Math.round(bufferPct)}%`;
    if (refs.resumeMeta) refs.resumeMeta.textContent = currentTime > 1 ? `Saved at ${formatDuration(currentTime)}` : "No saved timestamp yet";
    refs.progressLabel.textContent = isLoading
      ? "Buffering sacred audio…"
      : audio.paused
        ? "Paused in your listening room"
        : "Now flowing";
    refs.trackState.textContent = isLoading
      ? "Loading"
      : audio.paused
        ? "Paused"
        : "Playing";
    refs.miniState.textContent = isLoading
      ? "Loading…"
      : audio.paused
        ? "Paused"
        : "Now flowing";
    refs.errorBanner.hidden = true;
    refs.errorMessage.textContent = "";
    if ("mediaSession" in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.title,
        artist: track.subtitle,
        album: "Spiritual Library",
        artwork: [{ src: track.coverImage, sizes: "512x512", type: "image/jpeg" }],
      });
    }
    updateQueue();
    updateMountState();
  };

  const playWithRecovery = async () => {
    try {
      playerError = "";
      await audio.play();
      pendingAutoplay = false;
    } catch (error) {
      pendingAutoplay = true;
      playerError = "";
      refs.progressLabel.textContent = "Tap play to resume audio on this page.";
    } finally {
      render();
    }
  };

  const loadCurrentTrack = (autoPlay = false, restoreTime = 0) => {
    const track = getTrack();
    if (!track) return;
    clearPlaybackError();
    isLoading = true;
    seekPreviewTime = null;
    audio.src = track.audioUrl;
    audio.load();
    audio.currentTime = 0;
    render();
    const applyRestore = () => {
      if (restoreTime > 0) {
        try {
          audio.currentTime = restoreTime;
        } catch (error) {
          // ignore bad seek
        }
      }
      isLoading = false;
      if (autoPlay) playWithRecovery();
      render();
      persist();
    };
    if (audio.readyState >= 1) {
      applyRestore();
    } else {
      audio.addEventListener("loadedmetadata", applyRestore, { once: true });
    }
  };

  const openTrack = (track, nextQueue = [], options = {}) => {
    if (!track) return;
    const normalizedQueue = dedupeAudioTracks(Array.isArray(nextQueue) && nextQueue.length ? nextQueue : [track]);
    queue = normalizedQueue;
    const queueIndex = normalizedQueue.findIndex((entry) => entry.slug === track.slug);
    currentIndex = queueIndex >= 0 ? queueIndex : 0;
    isExpanded = options.expand ?? true;
    if (isExpanded) pushPlayerHistoryState();
    persist();
    loadCurrentTrack(options.autoPlay !== false, options.restoreTime || 0);
  };

  const setQueue = (nextQueue = []) => {
    const nextTracks = dedupeAudioTracks(Array.isArray(nextQueue) ? nextQueue : []);
    const activeTrack = getTrack();
    if (activeTrack) {
      const preserved = nextTracks.find((entry) => entry.slug === activeTrack.slug);
      queue = preserved ? nextTracks : dedupeAudioTracks([activeTrack, ...nextTracks]);
      currentIndex = queue.findIndex((entry) => entry.slug === activeTrack.slug);
    } else {
      queue = nextTracks;
      currentIndex = queue.length ? 0 : -1;
    }
    if (!queue.length) {
      currentIndex = -1;
      shell.hidden = true;
      clearPlaybackError();
      isLoading = false;
    }
    render();
    persist();
  };

  const toggleExpanded = (nextState = !isExpanded) => {
    if (nextState === isExpanded) return;
    if (nextState) {
      pushPlayerHistoryState();
    } else if (playerHistoryPushed) {
      window.history.back();
      return;
    }
    isExpanded = nextState;
    render();
  };

  const goToTrack = (delta) => {
    if (!queue.length) return;
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= queue.length) return;
    currentIndex = nextIndex;
    loadCurrentTrack(true, 0);
  };

  const stopPlayback = () => {
    stopProgressLoop();
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    queue = [];
    currentIndex = -1;
    isExpanded = false;
    pendingAutoplay = false;
    seekPreviewTime = null;
    clearPlaybackError();
    isLoading = false;
    playerHistoryPushed = false;
    shell.hidden = true;
    clearSession();
    render();
  };

  refs.mini?.addEventListener("click", (event) => {
    const interactive = event.target.closest("button, input, a");
    if (interactive) return;
    toggleExpanded(true);
  });
  refs.miniExpandBtn?.addEventListener("click", () => toggleExpanded(true));
  refs.minimizeBtn?.addEventListener("click", closeExpandedPlayerState);
  refs.closeBackdrop?.addEventListener("click", closeExpandedPlayerState);
  refs.prevBtn?.addEventListener("click", () => goToTrack(-1));
  refs.nextBtn?.addEventListener("click", () => goToTrack(1));
  refs.miniPrevBtn?.addEventListener("click", () => goToTrack(-1));
  refs.miniNextBtn?.addEventListener("click", () => goToTrack(1));
  refs.miniCloseBtn?.addEventListener("click", stopPlayback);
  refs.stopBtn?.addEventListener("click", stopPlayback);
  const togglePlayPause = () => {
    if (!getTrack()) return;
    if (audio.paused) {
      playWithRecovery();
    } else {
      audio.pause();
      persist();
      render();
    }
  };
  refs.playBtn?.addEventListener("click", togglePlayPause);
  refs.miniPlayBtn?.addEventListener("click", togglePlayPause);
  refs.back10Btn?.addEventListener("click", () => {
    audio.currentTime = Math.max(0, Number(audio.currentTime || 0) - 10);
    persist();
    render();
  });
  refs.forward10Btn?.addEventListener("click", () => {
    audio.currentTime = Math.min(Number(audio.duration || audio.currentTime || 0), Number(audio.currentTime || 0) + 10);
    persist();
    render();
  });
  refs.repeatBtn?.addEventListener("click", () => {
    repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
    persist();
    render();
  });
  refs.speedBtn?.addEventListener("click", () => {
    const currentIndex = AUDIO_SPEEDS.indexOf(speed);
    speed = AUDIO_SPEEDS[(currentIndex + 1) % AUDIO_SPEEDS.length];
    audio.playbackRate = speed;
    persist();
    render();
  });
  refs.muteBtn?.addEventListener("click", () => {
    isMuted = !isMuted;
    audio.muted = isMuted;
    if (!isMuted && volume === 0) {
      volume = 0.7;
      audio.volume = volume;
    }
    persist();
    render();
  });
  refs.volumeRange?.addEventListener("input", () => {
    volume = Math.max(0, Math.min(1, Number(refs.volumeRange.value || 0)));
    isMuted = volume === 0;
    audio.muted = isMuted;
    audio.volume = volume;
    persist();
    render();
  });
  refs.favoriteBtn?.addEventListener("click", () => {
    const track = getTrack();
    if (!track) return;
    if (favoriteSet.has(track.slug)) {
      favoriteSet.delete(track.slug);
    } else {
      favoriteSet.add(track.slug);
    }
    localStorage.setItem(AUDIO_FAVORITES_KEY, JSON.stringify([...favoriteSet]));
    render();
  });
  refs.bookmarkTimeBtn?.addEventListener("click", () => {
    const track = getTrack();
    if (!track) return;
    const bookmarks = safeJson(localStorage.getItem(AUDIO_BOOKMARKS_KEY), []);
    bookmarks.unshift({
      slug: track.slug,
      title: track.title,
      at: Number(audio.currentTime || 0),
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(AUDIO_BOOKMARKS_KEY, JSON.stringify(bookmarks.slice(0, 20)));
    refs.bookmarkTimeBtn.textContent = "Saved";
    window.setTimeout(() => {
      refs.bookmarkTimeBtn.textContent = "Bookmark time";
    }, 1100);
  });

  const previewSeek = (value) => {
    const duration = Number(audio.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0) return;
    seekPreviewTime = Math.max(0, Math.min(duration, Number(value || 0)));
    try {
      audio.currentTime = seekPreviewTime;
    } catch (error) {
      // Ignore transient seek errors while scrubbing.
    }
    buildRangeSeekPreview(seekPreviewTime, duration, refs);
    render();
  };

  const commitSeek = (value) => {
    const duration = Number(audio.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const nextTime = Math.max(0, Math.min(duration, Number(value || 0)));
    audio.currentTime = nextTime;
    seekPreviewTime = null;
    persist();
    render();
  };

  refs.progressRange?.addEventListener("input", () => {
    isSeeking = true;
    previewSeek(refs.progressRange.value);
  });
  refs.progressRange?.addEventListener("pointerdown", (event) => event.stopPropagation());
  refs.progressRange?.addEventListener("mousedown", (event) => event.stopPropagation());
  refs.progressRange?.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
  refs.progressRange?.addEventListener("click", (event) => event.stopPropagation());
  refs.progressRange?.addEventListener("change", () => {
    commitSeek(refs.progressRange.value);
    isSeeking = false;
    render();
  });
  refs.progressRange?.addEventListener("pointerup", () => {
    if (!isSeeking) return;
    commitSeek(refs.progressRange.value);
    isSeeking = false;
  });

  refs.miniProgressRange?.addEventListener("input", () => {
    isMiniSeeking = true;
    previewSeek(refs.miniProgressRange.value);
  });
  refs.miniProgressRange?.addEventListener("pointerdown", (event) => event.stopPropagation());
  refs.miniProgressRange?.addEventListener("mousedown", (event) => event.stopPropagation());
  refs.miniProgressRange?.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
  refs.miniProgressRange?.addEventListener("click", (event) => event.stopPropagation());
  refs.miniProgressRange?.addEventListener("change", () => {
    commitSeek(refs.miniProgressRange.value);
    isMiniSeeking = false;
    render();
  });
  refs.miniProgressRange?.addEventListener("pointerup", () => {
    if (!isMiniSeeking) return;
    commitSeek(refs.miniProgressRange.value);
    isMiniSeeking = false;
  });

  audio.addEventListener("timeupdate", () => {
    if (audio.currentSrc && audio.readyState >= 2 && playerError) {
      clearPlaybackError();
    }
    persist();
    render();
  });
  audio.addEventListener("progress", render);
  audio.addEventListener("loadedmetadata", () => {
    isLoading = false;
    clearPlaybackError();
    audio.playbackRate = speed;
    audio.volume = volume;
    audio.muted = isMuted;
    render();
  });
  audio.addEventListener("loadeddata", () => {
    isLoading = false;
    clearPlaybackError();
    render();
  });
  audio.addEventListener("canplay", () => {
    isLoading = false;
    clearPlaybackError();
    render();
  });
  audio.addEventListener("play", () => {
    isLoading = false;
    clearPlaybackError();
    startProgressLoop();
    render();
  });
  audio.addEventListener("pause", () => {
    stopProgressLoop();
    render();
  });
  audio.addEventListener("waiting", () => {
    isLoading = true;
    render();
  });
  audio.addEventListener("stalled", () => {
    isLoading = true;
    render();
  });
  audio.addEventListener("playing", () => {
    isLoading = false;
    clearPlaybackError();
    startProgressLoop();
    render();
  });
  audio.addEventListener("error", () => {
    isLoading = false;
    if (pendingErrorTimer) {
      window.clearTimeout(pendingErrorTimer);
      pendingErrorTimer = 0;
    }
    pendingErrorTimer = window.setTimeout(() => {
      pendingErrorTimer = 0;
      if (!shouldMarkHardError()) {
        clearPlaybackError();
      } else {
        hasStreamError = true;
        playerError = "This track could not be started.";
      }
      render();
    }, 1200);
  });
  audio.addEventListener("ended", () => {
    stopProgressLoop();
    if (repeatMode === "one") {
      audio.currentTime = 0;
      playWithRecovery();
      return;
    }
    if (currentIndex < queue.length - 1) {
      currentIndex += 1;
      loadCurrentTrack(true, 0);
      return;
    }
    if (repeatMode === "all" && queue.length) {
      currentIndex = 0;
      loadCurrentTrack(true, 0);
      return;
    }
    persist();
    render();
  });

  const restoreSession = () => {
    const session = safeJson(localStorage.getItem(AUDIO_SESSION_KEY), null);
    if (!session?.queue?.length) return;
    if (Number(session.version || 0) !== AUDIO_SESSION_VERSION) {
      clearSession();
      return;
    }
    queue = dedupeAudioTracks(session.queue.filter((entry) => entry?.slug && entry?.audioUrl && entry?.hasExplicitAudio !== false));
    currentIndex = Math.min(queue.length - 1, Math.max(0, Number(session.currentIndex || 0)));
    repeatMode = ["off", "all", "one"].includes(session.repeatMode) ? session.repeatMode : "off";
    speed = AUDIO_SPEEDS.includes(Number(session.speed)) ? Number(session.speed) : 1;
    volume = Math.max(0, Math.min(1, Number(session.volume ?? 1)));
    isMuted = Boolean(session.isMuted);
    audio.volume = volume;
    audio.muted = isMuted;
    if (!queue.length) return;
    loadCurrentTrack(Boolean(session.wasPlaying), Number(session.currentTime || 0));
    isExpanded = false;
    render();
  };

  window.addEventListener("pagehide", persist);
  window.addEventListener("beforeunload", persist);
  window.addEventListener("popstate", () => {
    if (!isExpanded) {
      playerHistoryPushed = false;
      return;
    }
    isExpanded = false;
    playerHistoryPushed = false;
    render();
  });
  window.addEventListener("pageshow", () => {
    if (!getTrack()) restoreSession();
    render();
  });

  document.addEventListener(
    "pointerdown",
    () => {
      if (pendingAutoplay && getTrack()) {
        playWithRecovery();
      }
    },
    { once: true }
  );

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", togglePlayPause);
    navigator.mediaSession.setActionHandler("pause", togglePlayPause);
    navigator.mediaSession.setActionHandler("previoustrack", () => goToTrack(-1));
    navigator.mediaSession.setActionHandler("nexttrack", () => goToTrack(1));
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      audio.currentTime = Math.max(0, Number(audio.currentTime || 0) - 10);
      persist();
      render();
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      audio.currentTime = Math.min(Number(audio.duration || audio.currentTime || 0), Number(audio.currentTime || 0) + 10);
      persist();
      render();
    });
  }

  restoreSession();

  const api = {
    openTrack,
    setQueue,
    syncSession: (force = false) => {
      if (force || !getTrack()) restoreSession();
      render();
    },
  };
  window.__smsLibraryAudioPlayer = api;
  return api;
};

const libraryAudioPlayer = createLibraryAudioPlayer();
