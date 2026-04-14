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
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCSpylc4bIDzyGBUkLWzETpjF1T5XQIYw1DCHv9OPROPu_3rArGfvZryjAtBwqWGNE-Su5ABNM2uC1_7wEhxXU1sMm6wt49v_mbbdKbAtdFGsgafflZFP2QxG7bgFHZrZ3nxuLgz0s9tZC5QFie8CoSM22kfdNBQtGAwwc0jzSvlkjY9d1M5K_haxZKocy0b0SK4Ds6RA3GVHajAN_7etw_4kt9fig5-8WwpRzKXEKnGgQ2Bw3zYlfrE1dUhp8LDqsuI0vs2cNOP_YK",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDcB5mPZ8neflsd0RjKvYNAUOMZd4IdjSXFip7IiQ5mFG6r35Qg9ocLKQMqKr1xYwebwZy7gtv9aHEag6EKQGUMwik2U2fjvsdmFaYJCFBIB_t-lULSf1Eu0KeHD9-6az83e68C2FDy4EcUEAZN6uIzpU843DM4qUoYtwVSUJ9658MWixyElljCxQ-yygHcv4sQGiw_Lmh8OTLS6W5nxug7_kD9dvH8foEHelkoCuUaetjxxOcM_luOnsePVjeOdGkZ7oFy9DqboLsQ",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBOGyva3303proDeUscVSBb9AH6aKQB77bnDAPJrBrPeTkTPrW9c-sQY9fewQ3nytx_gcb2EghJ3kwQeTdgEedwriWz5sZyipxJ-ddc6jhiFnSm2al7E6PdJx3g8V6Rz9R0DnGkwxI6FNq5be5NiCyKPwyukrMt0g2w9U4lD32HgsM4OczprXBYLjF_U_KyaBoWa6vNFt3XnX7SKquswjS928bGAHB--0lYRRpoAEmnxNKCklftDeQXxItsEkLFGaWXPGVGZGDB5BWQ",
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
  Aartis: "https://lh3.googleusercontent.com/aida-public/AB6AXuDcB5mPZ8neflsd0RjKvYNAUOMZd4IdjSXFip7IiQ5mFG6r35Qg9ocLKQMqKr1xYwebwZy7gtv9aHEag6EKQGUMwik2U2fjvsdmFaYJCFBIB_t-lULSf1Eu0KeHD9-6az83e68C2FDy4EcUEAZN6uIzpU843DM4qUoYtwVSUJ9658MWixyElljCxQ-yygHcv4sQGiw_Lmh8OTLS6W5nxug7_kD9dvH8foEHelkoCuUaetjxxOcM_luOnsePVjeOdGkZ7oFy9DqboLsQ",
  Books: "https://lh3.googleusercontent.com/aida-public/AB6AXuBOGyva3303proDeUscVSBb9AH6aKQB77bnDAPJrBrPeTkTPrW9c-sQY9fewQ3nytx_gcb2EghJ3kwQeTdgEedwriWz5sZyipxJ-ddc6jhiFnSm2al7E6PdJx3g8V6Rz9R0DnGkwxI6FNq5be5NiCyKPwyukrMt0g2w9U4lD32HgsM4OczprXBYLjF_U_KyaBoWa6vNFt3XnX7SKquswjS928bGAHB--0lYRRpoAEmnxNKCklftDeQXxItsEkLFGaWXPGVGZGDB5BWQ",
  Upanishads: "https://lh3.googleusercontent.com/aida-public/AB6AXuCSpylc4bIDzyGBUkLWzETpjF1T5XQIYw1DCHv9OPROPu_3rArGfvZryjAtBwqWGNE-Su5ABNM2uC1_7wEhxXU1sMm6wt49v_mbbdKbAtdFGsgafflZFP2QxG7bgFHZrZ3nxuLgz0s9tZC5QFie8CoSM22kfdNBQtGAwwc0jzSvlkjY9d1M5K_haxZKocy0b0SK4Ds6RA3GVHajAN_7etw_4kt9fig5-8WwpRzKXEKnGgQ2Bw3zYlfrE1dUhp8LDqsuI0vs2cNOP_YK",
  Vedas: "https://res.cloudinary.com/dmnm8z8dc/image/upload/v1776006859/universe-revealed-img_oalmxr.jpg",
  "Sacred Hymns": "https://lh3.googleusercontent.com/aida-public/AB6AXuDcB5mPZ8neflsd0RjKvYNAUOMZd4IdjSXFip7IiQ5mFG6r35Qg9ocLKQMqKr1xYwebwZy7gtv9aHEag6EKQGUMwik2U2fjvsdmFaYJCFBIB_t-lULSf1Eu0KeHD9-6az83e68C2FDy4EcUEAZN6uIzpU843DM4qUoYtwVSUJ9658MWixyElljCxQ-yygHcv4sQGiw_Lmh8OTLS6W5nxug7_kD9dvH8foEHelkoCuUaetjxxOcM_luOnsePVjeOdGkZ7oFy9DqboLsQ",
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
  return {
    slug: item.slug,
    title: item.name || item.slug,
    subtitle: item.deity ? `${item.deity} • ${category}` : `${category} • Spiritual Library`,
    audioUrl,
    coverImage,
    category,
    hasExplicitAudio: true,
    sourceLabel: "Cloudinary source",
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
  let playerHistoryPushed = false;
  const favoriteSet = getAudioFavorites();

  const getTrack = () => queue[currentIndex] || null;
  const repeatModeLabel = () => repeatMode === "one" ? "Repeat One" : repeatMode === "all" ? "Repeat All" : "Repeat Off";
  const hasBlockingError = () => hasStreamError && Boolean(playerError);
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
    refs.playbackMode.textContent = track.hasExplicitAudio ? "Cloudinary source attached" : "Preview stream";
    refs.playbackMeta.textContent = hasBlockingError()
      ? "The active stream hit a playback issue. Retry or move to the next track."
      : "Streaming live from your hosted Cloudinary audio asset.";
    refs.ambient.style.backgroundImage = `linear-gradient(180deg, rgba(7,10,16,.18), rgba(7,10,16,.82)), url('${track.coverImage}')`;
    refs.favoriteBtn.textContent = favoriteSet.has(track.slug) ? "Favorited" : "Favorite";
    const duration = Number(audio.duration || 0);
    const currentTime = Number(audio.currentTime || 0);
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
    refs.volumeMeta.textContent = `${Math.round((isMuted ? 0 : volume) * 100)}%`;
    refs.bufferMeta.textContent = `${Math.round(bufferPct)}%`;
    refs.resumeMeta.textContent = currentTime > 1 ? `Saved at ${formatDuration(currentTime)}` : "No saved timestamp yet";
    refs.progressLabel.textContent = hasBlockingError()
      ? "Playback issue"
      : isLoading
        ? "Buffering sacred audio…"
        : audio.paused
          ? "Paused in your listening room"
          : "Now flowing";
    refs.trackState.textContent = hasBlockingError()
      ? "Error"
      : isLoading
        ? "Loading"
        : audio.paused
          ? "Paused"
          : "Playing";
    refs.miniState.textContent = hasBlockingError()
      ? "Playback issue"
      : isLoading
        ? "Loading…"
        : audio.paused
          ? "Paused"
          : "Now flowing";
    refs.errorBanner.hidden = !hasBlockingError();
    refs.errorMessage.textContent = playerError || "This stream could not be loaded.";
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
    playerError = "";
    isLoading = true;
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
      playerError = "";
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
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    queue = [];
    currentIndex = -1;
    isExpanded = false;
    pendingAutoplay = false;
    playerError = "";
    hasStreamError = false;
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

  refs.progressRange?.addEventListener("input", () => {
    isSeeking = true;
    refs.currentTime.textContent = formatDuration(refs.progressRange.value);
  });
  refs.progressRange?.addEventListener("change", () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number(refs.progressRange.value || 0);
      persist();
    }
    isSeeking = false;
    render();
  });

  refs.miniProgressRange?.addEventListener("input", () => {
    isMiniSeeking = true;
    refs.currentTime.textContent = formatDuration(refs.miniProgressRange.value);
  });
  refs.miniProgressRange?.addEventListener("change", () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number(refs.miniProgressRange.value || 0);
      persist();
    }
    isMiniSeeking = false;
    render();
  });

  audio.addEventListener("timeupdate", () => {
    if (audio.currentSrc && audio.readyState >= 2 && playerError) {
      playerError = "";
      hasStreamError = false;
    }
    persist();
    render();
  });
  audio.addEventListener("progress", render);
  audio.addEventListener("loadedmetadata", () => {
    isLoading = false;
    hasStreamError = false;
    playerError = "";
    audio.playbackRate = speed;
    audio.volume = volume;
    audio.muted = isMuted;
    render();
  });
  audio.addEventListener("canplay", () => {
    isLoading = false;
    playerError = "";
    hasStreamError = false;
    render();
  });
  audio.addEventListener("play", () => {
    isLoading = false;
    playerError = "";
    hasStreamError = false;
    render();
  });
  audio.addEventListener("pause", render);
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
    playerError = "";
    hasStreamError = false;
    render();
  });
  audio.addEventListener("error", () => {
    isLoading = false;
    hasStreamError = !(audio.currentSrc && audio.readyState >= 2);
    playerError = hasStreamError ? "This stream could not be loaded." : "";
    render();
  });
  audio.addEventListener("ended", () => {
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

const initLibraryListPage = () => {
  const seed = safeJson(libraryPayloadNode ? libraryPayloadNode.textContent : "", { items: [], featured: [], categories: [] });
  const error = libraryPage.dataset.error || "";
  const grid = document.getElementById("libraryGrid");
  const empty = document.getElementById("libraryEmpty");
  const featuredRail = document.getElementById("featuredRail");
  const continueReadingRail = document.getElementById("continueReadingRail");
  const continueReadingStatus = document.getElementById("continueReadingStatus");
  const continueReadingJumpBtn = document.getElementById("continueReadingJumpBtn");
  const continueBackBtn = document.getElementById("continueBackBtn");
  const continueForwardBtn = document.getElementById("continueForwardBtn");
  const audioHubRoot = document.getElementById("audioHubRoot");
  const searchInput = document.getElementById("librarySearch");
  const categoryFilter = document.getElementById("categoryFilter");
  const languageFilter = document.getElementById("languageFilter");
  const bookshelfToggle = document.getElementById("bookshelfToggle");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const featuredScrollBtn = document.getElementById("featuredScrollBtn");
  const exploreCollectionBtn = document.getElementById("exploreCollectionBtn");
  const heroContinueBtn = document.getElementById("heroContinueBtn");
  const statusNode = document.getElementById("libraryStatus");
  const heroTotalCount = document.getElementById("heroTotalCount");
  const heroCategoryCount = document.getElementById("heroCategoryCount");
  const heroLanguageCount = document.getElementById("heroLanguageCount");
  const sideTotalCount = document.getElementById("sideTotalCount");
  const sideProgressTitle = document.getElementById("sideProgressTitle");
  const sideProgressMeta = document.getElementById("sideProgressMeta");
  const sideProgressBar = document.getElementById("sideProgressBar");
  const sideProgressPct = document.getElementById("sideProgressPct");
  const resultsCount = document.getElementById("resultsCount");
  const recentlyViewed = document.getElementById("recentlyViewed");
  const presetCategories = [...FIXED_LIBRARY_CATEGORIES];
  const initialCategory = String(libraryPage.dataset.initialCategory || "all").trim().toLowerCase();
  const collectionSlug = String(libraryPage.dataset.collectionSlug || "").trim().toLowerCase();
  const buildLibraryItemHref = (slug) => appendCollectionQuery(`/library/${encodeURIComponent(slug)}/`, collectionSlug);
  const isAudioCollection = collectionSlug === "audios";

  let items = Array.isArray(seed.items) ? seed.items : [];
  let visibleCount = 9;
  let query = "";
  let category = initialCategory || "all";
  let language = "all";
  let viewMode = localStorage.getItem("sms-library-view") || "grid";
  const getAudioItems = () => items.filter((entry) => Boolean(String(entry.audio_url || "").trim()));
  const audioCoverFor = (item) => item?.cover_image || item?.coverImage || AUDIO_COVER_IMAGES[item?.category] || CONTINUE_READING_COVERS[0];

  const openAudioForSlug = (targetSlug) => {
    const target = items.find((entry) => entry.slug === targetSlug)
      || (Array.isArray(seed.featured) ? seed.featured.find((entry) => entry.slug === targetSlug) : null);
    if (!target) return;
    const activeTrack = buildAudioTrackFromItem(target);
    if (!activeTrack) return;
    const queueSource = isAudioCollection ? getAudioItems() : filteredItems();
    const queueTracks = queueSource.slice(0, 24).map(buildAudioTrackFromItem).filter(Boolean);
    libraryAudioPlayer.openTrack(activeTrack, queueTracks, { expand: true, autoPlay: true });
  };

  const animateCount = (node, target) => {
    if (!node) return;
    const end = Number(target) || 0;
    const start = Number(node.textContent.replace(/[^\d]/g, "")) || 0;
    const duration = 700;
    const startAt = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startAt) / duration);
      const value = Math.round(start + (end - start) * (1 - Math.pow(1 - progress, 3)));
      node.textContent = String(value);
      if (progress < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };

  const applyViewMode = () => {
    grid?.setAttribute("data-view", viewMode);
    bookshelfToggle?.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === viewMode);
    });
  };

  const renderRecent = () => {
    const recent = getRecent();
    if (!recentlyViewed) return;
    recentlyViewed.innerHTML = recent.length
      ? recent
          .map(
            (item) => `
              <a class="recent-chip" href="${buildLibraryItemHref(item.slug)}">
                <span>${escapeHtml(item.name)}</span>
                <span>${escapeHtml(item.category)}</span>
              </a>
            `
          )
          .join("")
      : `<div class="recent-chip"><span>No recent readings yet</span><span>Start exploring</span></div>`;
  };

  const renderContinueReading = () => {
    if (!continueReadingRail) return;
    const progress = getReadingProgress();
    if (!progress.length) {
      if (heroContinueBtn) heroContinueBtn.textContent = "Continue Reading";
      if (sideProgressTitle) sideProgressTitle.textContent = "Your latest sacred pause";
      if (sideProgressMeta) sideProgressMeta.textContent = "Open any text to build your shelf.";
      if (sideProgressPct) sideProgressPct.textContent = "0%";
      if (sideProgressBar) sideProgressBar.style.width = "0%";
      continueReadingRail.innerHTML = `
        <div class="cr-empty-state">
          <div class="cr-empty-state__body">
            <span class="featured-label">Continue Reading</span>
            <h3>Your sacred reading path will appear here.</h3>
            <p>Open any aarti, book, or scripture and the library will remember your exact place.</p>
          </div>
        </div>
      `;
      if (continueReadingStatus) continueReadingStatus.textContent = "Open a text to start building your journey";
      return;
    }

    const accents = [
      { glow: "cr-glow-gold", border: "cr-border-gold", progress: "cr-progress-gold", chapter: "text-gold" },
      { glow: "cr-glow-copper", border: "cr-border-copper", progress: "cr-progress-copper", chapter: "text-copper" },
      { glow: "cr-glow-sky", border: "cr-border-sky", progress: "cr-progress-sky", chapter: "text-sky" },
    ];

    const top = progress[0];
    if (sideProgressTitle) sideProgressTitle.textContent = top.title || top.slug;
    if (sideProgressMeta) sideProgressMeta.textContent = `${top.progressLabel || "Resume reading"} • ${formatRelativeTime(top.lastReadAt)}`;
    if (sideProgressPct) sideProgressPct.textContent = `${Math.round(Number(top.progress || 0))}%`;
    if (sideProgressBar) sideProgressBar.style.width = `${Math.max(4, Math.min(100, Number(top.progress || 0)))}%`;

    continueReadingRail.innerHTML = progress.slice(0, 8)
      .map((item, index) => {
        const accent = accents[index % accents.length];
        const cover = CONTINUE_READING_COVERS[index % CONTINUE_READING_COVERS.length];
        return `
        <a class="cr-book${index === 0 ? " is-spotlight" : ""}" href="${buildLibraryItemHref(item.slug)}">
          <div class="cr-book-wrap ${accent.glow}">
            <div class="cr-book-cover ${accent.border}">
              <div class="cr-book-spine"></div>
              <img class="cr-book-cover-img" src="${cover}" alt="${escapeHtml(item.title || item.slug)} cover art">
              <div class="cr-book-overlay">
                <div class="cr-book-chapter ${accent.chapter}">${escapeHtml(item.progressLabel || "Resume reading")}</div>
                <div class="cr-book-title">${escapeHtml(item.title || item.slug)}</div>
              </div>
            </div>
          </div>
          <div class="cr-progress-wrap">
            <div class="cr-progress-bg"><div class="cr-progress-fill ${accent.progress}" style="width:${Math.max(4, Math.min(100, Number(item.progress || 0)))}%"></div></div>
            <div class="cr-progress-meta">
              <span class="cr-progress-pct">${Math.max(0, Math.round(Number(item.progress || 0)))}%</span>
              <span class="cr-progress-pct">${escapeHtml(formatRelativeTime(item.lastReadAt))}</span>
            </div>
          </div>
        </a>
      `;})
      .join("");
    if (continueReadingStatus) continueReadingStatus.textContent = `${progress.length} recent reading path${progress.length > 1 ? "s" : ""}`;
    if (heroContinueBtn) heroContinueBtn.textContent = `Continue ${progress[0]?.title ? "“" + progress[0].title + "”" : "Reading"}`;
  };

  const renderFeatured = () => {
    if (!featuredRail) return;
    const featured = Array.isArray(seed.featured) && seed.featured.length ? seed.featured : items.slice(0, 3);
    featuredRail.innerHTML = (featured.length ? featured : [{
      slug: "",
      name: "No featured text yet",
      excerpt: "Add local library files to populate the featured shelf.",
      content_type: "text",
    }])
      .map(
        (item, index) => `
          <a class="featured-card" href="${item.slug ? buildLibraryItemHref(item.slug) : '#'}" style="animation-delay:${index * 90}ms">
            <span class="featured-label">✨ ${escapeHtml(item.content_type === "pdf" ? "Scripture" : "Featured")}</span>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.excerpt || item.category)}</p>
            ${item.audio_url ? `<button type="button" class="library-audio-trigger" data-audio-slug="${escapeHtml(item.slug)}">Listen</button>` : ""}
          </a>
        `
      )
      .join("");
  };

  const buildAudioShelfCard = (item, index = 0) => `
    <article class="audio-shelf-card" style="animation-delay:${index * 70}ms">
      <button type="button" class="audio-shelf-card__art" data-audio-slug="${escapeHtml(item.slug)}" aria-label="Play ${escapeHtml(item.name)}">
        <img src="${escapeHtml(audioCoverFor(item))}" alt="${escapeHtml(item.name)} cover art">
        <span class="audio-shelf-card__play">▶</span>
      </button>
      <div class="audio-shelf-card__meta">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.deity || item.category || "Sacred audio")}</p>
        </div>
        <button type="button" class="library-audio-trigger" data-audio-slug="${escapeHtml(item.slug)}">Listen</button>
      </div>
    </article>
  `;

  const buildAudioListRow = (item, index = 0) => `
    <article class="audio-list-row" style="animation-delay:${index * 45}ms">
      <div class="audio-list-row__index">${String(index + 1).padStart(2, "0")}</div>
      <button type="button" class="audio-list-row__cover" data-audio-slug="${escapeHtml(item.slug)}" aria-label="Play ${escapeHtml(item.name)}">
        <img src="${escapeHtml(audioCoverFor(item))}" alt="${escapeHtml(item.name)} cover art">
      </button>
      <div class="audio-list-row__copy">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.deity || item.category || "Spiritual audio")} • ${escapeHtml(item.category || "Audio")}</span>
      </div>
      <div class="audio-list-row__actions">
        <a href="${buildLibraryItemHref(item.slug)}" class="detail-action-btn">Open</a>
        <button type="button" class="library-audio-trigger" data-audio-slug="${escapeHtml(item.slug)}">Listen</button>
      </div>
    </article>
  `;

  const renderAudioHub = () => {
    if (!audioHubRoot) return;
    const audioItems = getAudioItems();
    libraryAudioPlayer.setQueue(audioItems.map(buildAudioTrackFromItem));
    const lead = audioItems[0] || null;
    const aartis = audioItems.filter((item) => String(item.category || "").toLowerCase() === "aartis");
    const chalisas = audioItems.filter((item) => String(item.category || "").toLowerCase() === "chalisas");
    const bhajans = audioItems.filter((item) => String(item.category || "").toLowerCase() === "bhajans");
    const recommended = [...audioItems]
      .sort((left, right) => Number(right.popularity || 0) - Number(left.popularity || 0))
      .slice(0, 6);
    const energized = audioItems.filter((item) => /hanuman|shiv|durga/i.test(`${item.slug} ${item.name} ${item.deity}`));

    const renderRail = (title, subtitle, collection) => `
      <section class="audio-hub-section">
        <div class="audio-hub-section__head">
          <div>
            <p class="panel-kicker">${escapeHtml(subtitle)}</p>
            <h3>${escapeHtml(title)}</h3>
          </div>
          <div class="audio-hub-section__controls">
            <button type="button" class="circle-btn" data-audio-rail-target="${escapeHtml(title)}" data-audio-rail-direction="-1">‹</button>
            <button type="button" class="circle-btn" data-audio-rail-target="${escapeHtml(title)}" data-audio-rail-direction="1">›</button>
          </div>
        </div>
        <div class="audio-shelf-rail" data-audio-rail="${escapeHtml(title)}">
          ${collection.length ? collection.map((item, index) => buildAudioShelfCard(item, index)).join("") : `<div class="audio-shelf-empty">Add Cloudinary audio links for this lane and it will appear here automatically.</div>`}
        </div>
      </section>
    `;

    audioHubRoot.innerHTML = `
      <section class="audio-hub-hero">
        <article class="audio-hub-spotlight">
          <p class="panel-kicker">Apple-style listening hub</p>
          <h2>${escapeHtml(lead?.name || "Audio sanctuary ready for sacred streaming")}</h2>
          <p>${escapeHtml(lead?.excerpt || "Only items with mapped Cloudinary audio appear here. Add links in the audio registry and this sanctuary updates automatically.")}</p>
          <div class="audio-hub-spotlight__actions">
            ${lead ? `<button type="button" class="hero-btn hero-btn--primary" data-audio-slug="${escapeHtml(lead.slug)}">Play now</button>` : `<button type="button" class="hero-btn hero-btn--primary" disabled>No audio yet</button>`}
            ${lead ? `<a href="${buildLibraryItemHref(lead.slug)}" class="hero-btn hero-btn--ghost">Open details</a>` : `<span class="hero-btn hero-btn--ghost">Map audio to begin</span>`}
          </div>
          <div class="audio-hub-spotlight__chips">
            <span>Cloudinary streams</span>
            <span>Mini player + fullscreen</span>
            <span>Queue + resume</span>
          </div>
        </article>
        <article class="audio-hub-album">
          ${lead ? `
            <button type="button" class="audio-hub-album__art" data-audio-slug="${escapeHtml(lead.slug)}" aria-label="Play ${escapeHtml(lead.name)}">
              <img src="${escapeHtml(audioCoverFor(lead))}" alt="${escapeHtml(lead.name)} cover art">
            </button>
            <div class="audio-hub-album__meta">
              <div>
                <p class="panel-kicker">Now highlighted</p>
                <h3>${escapeHtml(lead.name)}</h3>
                <p>${escapeHtml(lead.deity || "Spiritual Library")} • ${escapeHtml(lead.category || "Audio")}</p>
              </div>
              <button type="button" class="library-audio-trigger" data-audio-slug="${escapeHtml(lead.slug)}">Listen</button>
            </div>
          ` : `<div class="audio-shelf-empty">No audio items are mapped yet.</div>`}
        </article>
      </section>

      <section class="audio-playlist-grid">
        <article class="audio-playlist-card">
          <p class="panel-kicker">Playlist</p>
          <h3>Temple Aarti Flow</h3>
          <p>${aartis.length} devotional stream${aartis.length === 1 ? "" : "s"} available for direct listening.</p>
          ${aartis[0] ? `<button type="button" class="hero-btn hero-btn--ghost" data-audio-slug="${escapeHtml(aartis[0].slug)}">Start playlist</button>` : `<span class="audio-playlist-card__muted">Add an aarti audio to unlock this lane.</span>`}
        </article>
        <article class="audio-playlist-card">
          <p class="panel-kicker">Mood Mix</p>
          <h3>Strength & protection</h3>
          <p>${energized.length || audioItems.length} stream${(energized.length || audioItems.length) === 1 ? "" : "s"} centered on courage and devotional force.</p>
          ${energized[0] ? `<button type="button" class="hero-btn hero-btn--ghost" data-audio-slug="${escapeHtml(energized[0].slug)}">Open mix</button>` : `<span class="audio-playlist-card__muted">This mix fills as matching audio arrives.</span>`}
        </article>
        <article class="audio-playlist-card">
          <p class="panel-kicker">Library</p>
          <h3>All sacred audio</h3>
          <p>${audioItems.length} mapped audio item${audioItems.length === 1 ? "" : "s"} currently live in the sanctuary.</p>
          <a href="#allAudioList" class="hero-btn hero-btn--ghost">Browse list</a>
        </article>
      </section>

      ${renderRail("Featured Albums", "Premium shelf", recommended)}
      ${renderRail("Aartis", "Temple listening", aartis)}
      ${renderRail("Chalisas", "Prayer loops", chalisas)}
      ${renderRail("Bhajans", "Devotional flow", bhajans)}

      <section class="audio-hub-section" id="allAudioList">
        <div class="audio-hub-section__head">
          <div>
            <p class="panel-kicker">All audios</p>
            <h3>Complete listening archive</h3>
          </div>
          <div class="panel-meta">${audioItems.length} live stream${audioItems.length === 1 ? "" : "s"}</div>
        </div>
        <div class="audio-list-grid">
          ${audioItems.length ? audioItems.map((item, index) => buildAudioListRow(item, index)).join("") : `<div class="audio-shelf-empty">No Cloudinary audio is attached yet. Add links in the registry file and this page will populate automatically.</div>`}
        </div>
      </section>
    `;
  };

  const filteredItems = () =>
    items.filter((item) => {
      const matchesCategory =
        category === "all"
        || (category === "audios" ? Boolean(item.audio_url) : item.category.toLowerCase() === category);
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
    if (!grid) return;
    const filtered = filteredItems();
    const visible = filtered.slice(0, visibleCount);
    grid.innerHTML = visible
      .map(
        (item) => `
          <a class="library-card" href="${buildLibraryItemHref(item.slug)}">
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
              <span class="library-card__actions">${item.audio_url ? `<button type="button" class="library-audio-trigger" data-audio-slug="${escapeHtml(item.slug)}">Listen</button>` : ""}<span>Open →</span></span>
            </div>
          </a>
        `
      )
      .join("");

    empty.hidden = filtered.length !== 0;
    loadMoreBtn.hidden = filtered.length <= visible.length;
    setStatus(statusNode, filtered.length ? `${filtered.length} sacred text${filtered.length > 1 ? "s" : ""} found` : "No matching texts yet");
    animateCount(heroTotalCount, items.length);
    animateCount(heroCategoryCount, category !== "all" ? 1 : FIXED_LIBRARY_CATEGORIES.length);
    animateCount(heroLanguageCount, 3);
    animateCount(sideTotalCount, items.length);
    if (resultsCount) resultsCount.textContent = `${filtered.length} text${filtered.length === 1 ? "" : "s"}`;
    libraryAudioPlayer.setQueue(filtered.slice(0, 12).map(buildAudioTrackFromItem));
  };

  const populateCategories = () => {
    if (!categoryFilter) return;
    categoryFilter.innerHTML = `<option value="all">All categories</option>${FIXED_LIBRARY_CATEGORIES
      .map((entry) => `<option value="${escapeHtml(entry.toLowerCase())}">${escapeHtml(entry)}</option>`)
      .join("")}`;
    if (categoryFilter && category) categoryFilter.value = category;
  };

  const refreshFromApi = async () => {
    if (!items.length && error) {
      setStatus(statusNode, error);
      return;
    }

    try {
      setStatus(statusNode, "Syncing local library assets...");
      const refreshUrl = category !== "all" && category !== "audios"
        ? `/api/library/?refresh=1&category=${encodeURIComponent(category)}`
        : "/api/library/?refresh=1";
      const response = await fetch(refreshUrl);
      if (!response.ok) throw new Error("Could not refresh the library feed.");
      const payload = await response.json();
      items = Array.isArray(payload.items) ? payload.items : items;
      if (isAudioCollection) {
        items = items.filter((item) => Boolean(String(item.audio_url || "").trim()));
      }
      seed.categories = Array.isArray(payload.categories) ? payload.categories : seed.categories;
      seed.featured = Array.isArray(items) ? items.filter((item) => item.featured).slice(0, 8) : seed.featured;
      populateCategories();
      renderFeatured();
      renderAudioHub();
      renderGrid();
      setStatus(statusNode, "Local library synced and ready");
    } catch (fetchError) {
      setStatus(statusNode, error || fetchError.message || "Showing cached library");
      renderAudioHub();
      renderGrid();
    }
  };

  featuredScrollBtn?.addEventListener("click", () => {
    const firstFeatured = (Array.isArray(seed.featured) && seed.featured.length ? seed.featured[0] : items[0]) || null;
    if (firstFeatured?.slug) {
      window.location.href = buildLibraryItemHref(firstFeatured.slug);
      return;
    }
    featuredRail?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  heroContinueBtn?.addEventListener("click", () => {
    const first = getReadingProgress()[0];
    if (first?.slug) {
      window.location.href = buildLibraryItemHref(first.slug);
      return;
    }
    document.getElementById("continueReadingRail")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  continueReadingJumpBtn?.addEventListener("click", () => {
    const first = getReadingProgress()[0];
    if (first?.slug) window.location.href = buildLibraryItemHref(first.slug);
  });

  exploreCollectionBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    (document.getElementById(isAudioCollection ? "allAudioList" : "libraryGrid") || audioHubRoot)?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  bookshelfToggle?.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      viewMode = button.dataset.view || "grid";
      localStorage.setItem("sms-library-view", viewMode);
      applyViewMode();
    });
  });

  const placeholders = [
    "Search Ganesh, Shiva, Veda, Ramayan...",
    "Search by deity, verse, or sacred text...",
    "Try Hanuman, Durga, Upanishad, Chalisa...",
  ];
  let placeholderIndex = 0;
  let placeholderChar = 0;
  let deleting = false;
  const animatePlaceholder = () => {
    if (!searchInput || document.activeElement === searchInput) return;
    const current = placeholders[placeholderIndex];
    if (!deleting) {
      placeholderChar = Math.min(current.length, placeholderChar + 1);
      searchInput.placeholder = current.slice(0, placeholderChar);
      if (placeholderChar >= current.length) {
        deleting = true;
        return;
      }
      return;
    }
    placeholderChar = Math.max(0, placeholderChar - 1);
    searchInput.placeholder = current.slice(0, placeholderChar) || " ";
    if (placeholderChar === 0) {
      deleting = false;
      placeholderIndex = (placeholderIndex + 1) % placeholders.length;
    }
  };
  window.setInterval(animatePlaceholder, 110);

  const scrollContinueRail = (direction = 1) => {
    if (!continueReadingRail) return;
    continueReadingRail.scrollBy({ left: direction * Math.max(continueReadingRail.clientWidth * 0.92, 720), behavior: "smooth" });
  };
  continueBackBtn?.addEventListener("click", () => scrollContinueRail(-1));
  continueForwardBtn?.addEventListener("click", () => scrollContinueRail(1));
  libraryPage.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-audio-slug]");
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    openAudioForSlug(trigger.dataset.audioSlug);
  });
  libraryPage.addEventListener("click", (event) => {
    const control = event.target.closest("[data-audio-rail-target]");
    if (!control) return;
    const railName = control.dataset.audioRailTarget;
    const rail = railName ? libraryPage.querySelector(`[data-audio-rail="${railName}"]`) : null;
    if (!rail) return;
    rail.scrollBy({
      left: Number(control.dataset.audioRailDirection || 1) * Math.max(rail.clientWidth * 0.85, 420),
      behavior: "smooth",
    });
  });

  renderFeatured();
  populateCategories();
  renderRecent();
  renderContinueReading();
  renderAudioHub();
  applyViewMode();
  renderGrid();
  libraryAudioPlayer.syncSession(true);
  refreshFromApi();
};

const initLibraryDetailPage = () => {
  libraryAudioPlayer.syncSession(true);
  const slug = libraryDetailPage.dataset.slug;
  const title = document.getElementById("detailTitle");
  const excerpt = document.getElementById("detailExcerpt");
  const categoryNode = document.getElementById("detailCategory");
  const deityNode = document.getElementById("detailDeity");
  const readerHeading = document.getElementById("readerHeading");
  const readerContent = document.getElementById("readerContent");
  const readerCard = document.getElementById("readerCard");
  const readerHeader = document.getElementById("readerHeader");
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
  const openAudioBtn = document.getElementById("openAudioBtn");
  const copyTextBtn = document.getElementById("copyTextBtn");
  const bookmarkBtn = document.getElementById("bookmarkBtn");
  const shareBtn = document.getElementById("shareBtn");
  const languageToggle = document.getElementById("languageToggle");
  const readingModeToggle = document.getElementById("readingModeToggle");
  const fontSizeControl = document.getElementById("fontSizeControl");
  const lineHeightControl = document.getElementById("lineHeightControl");
  const readerThemeToggle = document.getElementById("readerThemeToggle");
  const readerFlowToggle = document.getElementById("readerFlowToggle");
  const focusModeBtn = document.getElementById("focusModeBtn");
  const readerProgressBar = document.getElementById("readerProgressBar");
  const readerProgressLabel = document.getElementById("readerProgressLabel");
  const readerLastRead = document.getElementById("readerLastRead");
  const toggleButtons = [...document.querySelectorAll("#languageToggle button")];
  const readingButtons = [...document.querySelectorAll("#readingModeToggle button")];
  const themeButtons = [...document.querySelectorAll("#readerThemeToggle button")];
  const flowButtons = [...document.querySelectorAll("#readerFlowToggle button")];

  let itemData = null;
  let currentLanguage = "hindi";
  let currentReadingMode = "language";
  let currentBookPage = 0;
  let currentPdfPage = 1;
  let currentFlowMode = localStorage.getItem("sms-library-reader-flow") || "page";
  let currentTheme = localStorage.getItem("sms-library-reader-theme") || "dark";
  let focusMode = false;
  let audioQueueItems = [];
  const fullscreenTarget = document.querySelector(".reader-card");

  const syncReaderChrome = () => {
    if (readerCard) {
      readerCard.dataset.theme = currentTheme;
      readerCard.dataset.flow = currentFlowMode;
      readerCard.classList.toggle("reader-card--focus", focusMode);
    }
    themeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.theme === currentTheme);
    });
    flowButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.flow === currentFlowMode);
    });
    if (focusModeBtn) focusModeBtn.textContent = focusMode ? "Exit Focus Mode" : "Focus Mode";
  };

  const saveProgress = (progress = 0, label = "Resume reading") => {
    if (!itemData) return;
    const entry = {
      slug: itemData.slug || slug,
      title: itemData.name,
      contentType: itemData.content_type,
      progress,
      progressLabel: label,
      pageIndex: currentBookPage,
      pdfPage: currentPdfPage,
      language: currentLanguage,
      readingMode: currentReadingMode,
      flowMode: currentFlowMode,
      theme: currentTheme,
      lastReadAt: new Date().toISOString(),
    };
    rememberReadingProgress(entry);
    if (readerProgressBar) readerProgressBar.style.width = `${Math.max(4, Math.min(100, progress))}%`;
    if (readerProgressLabel) readerProgressLabel.textContent = `${Math.round(progress)}%`;
    if (readerLastRead) readerLastRead.textContent = label;
  };

  const restoreProgress = () => {
    const saved = getReadingProgress().find((entry) => entry.slug === slug);
    if (!saved) return;
    currentBookPage = Number(saved.pageIndex || 0);
    currentPdfPage = Math.max(1, Number(saved.pdfPage || 1));
    currentLanguage = saved.language || currentLanguage;
    currentReadingMode = saved.readingMode || currentReadingMode;
    currentFlowMode = saved.flowMode || currentFlowMode;
    currentTheme = saved.theme || currentTheme;
  };

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
    saveProgress(((safePageIndex + 1) / totalSpreads) * 100, `Spread ${safePageIndex + 1} of ${totalSpreads}`);

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

  const renderScrollText = (lines) => {
    updateReaderNav({ enabled: false, status: "Scroll mode" });
    const total = Math.max(1, lines.length);
    readerContent.innerHTML = `
      <div class="reader-scroll-shell">
        ${lines.map((line, index) => `<div class="reader-line" data-line="${index}">${escapeHtml(line)}</div>`).join("")}
      </div>
    `;
    const onScroll = debounce(() => {
      const maxScroll = Math.max(1, readerContent.scrollHeight - readerContent.clientHeight);
      const progress = Math.min(100, (readerContent.scrollTop / maxScroll) * 100);
      const lineIndex = Math.min(total, Math.max(1, Math.round((progress / 100) * total)));
      saveProgress(progress, `Line ${lineIndex} of ${total}`);
    }, 120);
    readerContent.onscroll = onScroll;
    const saved = getReadingProgress().find((entry) => entry.slug === slug);
    if (saved?.flowMode === "scroll" && saved.progress) {
      const maxScroll = Math.max(0, readerContent.scrollHeight - readerContent.clientHeight);
      readerContent.scrollTop = maxScroll * (Number(saved.progress) / 100);
    }
  };

  const renderPdfSpread = async () => {
    readerContent.classList.add("reader-content--pdf");
    updateReaderNav({
      enabled: true,
      prevDisabled: currentPdfPage <= 1,
      nextDisabled: false,
      status: `PDF page ${currentPdfPage}`,
    });
    saveProgress(Math.min(100, currentPdfPage * 4), `PDF page ${currentPdfPage}`);
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
    syncReaderChrome();

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
    if (currentFlowMode === "scroll") {
      readerContent.classList.remove("reader-content--pdf");
      renderScrollText(lines);
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

    fontSizeControl?.addEventListener("input", () => {
      readerCard?.style.setProperty("--reader-font-size", `${fontSizeControl.value}px`);
    });

    lineHeightControl?.addEventListener("input", () => {
      readerCard?.style.setProperty("--reader-line-height", String(lineHeightControl.value));
    });

    themeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        currentTheme = button.dataset.theme || "dark";
        localStorage.setItem("sms-library-reader-theme", currentTheme);
        syncReaderChrome();
      });
    });

    flowButtons.forEach((button) => {
      button.addEventListener("click", () => {
        currentFlowMode = button.dataset.flow || "page";
        localStorage.setItem("sms-library-reader-flow", currentFlowMode);
        syncReaderChrome();
        renderReader();
      });
    });

    focusModeBtn?.addEventListener("click", () => {
      focusMode = !focusMode;
      document.body.classList.toggle("library-focus-mode", focusMode);
      syncReaderChrome();
    });

    openAudioBtn?.addEventListener("click", () => {
      if (!itemData?.audio_url) return;
      const queueTracks = (audioQueueItems.length ? audioQueueItems : [itemData]).map(buildAudioTrackFromItem).filter(Boolean);
      libraryAudioPlayer.openTrack(buildAudioTrackFromItem(itemData), queueTracks, { expand: true, autoPlay: true });
    });
  };

  const loadDetail = async () => {
    try {
      const response = await fetch(`/api/library/${encodeURIComponent(slug)}/`);
      if (!response.ok) throw new Error("Could not load this sacred text.");
      itemData = await response.json();
      restoreProgress();
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
        const preferredMode = itemData.reader_modes?.includes(currentReadingMode)
          ? currentReadingMode
          : (itemData.default_reader_mode || "pdf");
        setActiveReadingMode(preferredMode);
      } else {
        languageToggle.hidden = false;
        readingModeToggle.hidden = true;
        const preferredLanguage = itemData.languages?.[currentLanguage]
          ? currentLanguage
          : itemData.languages?.hindi
            ? "hindi"
            : itemData.languages?.english
              ? "english"
              : "transliteration";
        setActiveLanguage(preferredLanguage);
      }
      if (fontSizeControl) readerCard?.style.setProperty("--reader-font-size", `${fontSizeControl.value}px`);
      if (lineHeightControl) readerCard?.style.setProperty("--reader-line-height", String(lineHeightControl.value));
      openAudioBtn.hidden = !itemData.audio_url;
      openAudioBtn.textContent = itemData.audio_url ? "Listen" : "Audio unavailable";
      syncReaderChrome();
      try {
        const relatedResponse = await fetch(`/api/library/?category=${encodeURIComponent(String(itemData.category || "").toLowerCase())}`);
        if (relatedResponse.ok) {
          const relatedPayload = await relatedResponse.json();
          const relatedItems = Array.isArray(relatedPayload.items) ? relatedPayload.items : [];
          const ordered = [
            itemData,
            ...relatedItems.filter((entry) => entry.slug !== itemData.slug),
          ].filter((entry) => entry.audio_url);
          audioQueueItems = ordered.slice(0, 12);
          libraryAudioPlayer.setQueue(audioQueueItems.map(buildAudioTrackFromItem));
        } else {
          audioQueueItems = itemData.audio_url ? [itemData] : [];
        }
      } catch (error) {
        audioQueueItems = itemData.audio_url ? [itemData] : [];
      }
    } catch (error) {
      excerpt.textContent = error.message || "Could not load this library entry.";
      categoryNode.textContent = "Unavailable";
      deityNode.textContent = "Unavailable";
      readerContent.innerHTML = `<div class="reader-line">${escapeHtml(error.message || "Please try again later.")}</div>`;
      openAudioBtn.hidden = true;
    }
  };

  initActions();
  syncFullscreenButtons();
  syncReaderChrome();
  loadDetail();
};

if (libraryPage) {
  initLibraryListPage();
}

if (libraryDetailPage) {
  initLibraryDetailPage();
}
