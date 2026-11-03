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
    deity: item.deity || "",
    lyrics: item.languages || {},
    art: window.KL && window.KL.artFor ? (({ c1, c2, emb, key }) => ({ c1, c2, emb, key }))(window.KL.artFor(item)) : null,
    href: `/library/${encodeURIComponent(item.slug)}/`,
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

// The player (apple-player.js) is loaded first and registers itself; this stub keeps pages working if it is ever missing.
const libraryAudioPlayer = window.__smsLibraryAudioPlayer || { openTrack() {}, setQueue() {}, syncSession() {}, expand() {} };
