import json
import re
from pathlib import Path
from typing import Dict, List, Optional

from django.conf import settings
from django.core.cache import cache
from django.templatetags.static import static
from django.utils.text import slugify


LIBRARY_CACHE_KEY = "library::items::local::v7"
LIBRARY_DATA_DIR = Path(settings.BASE_DIR) / "accounts" / "data" / "library"
LIBRARY_SEED_PATH = Path(settings.BASE_DIR) / "accounts" / "data" / "library_seed.json"
LIBRARY_AUDIO_LINKS_PATH = Path(settings.BASE_DIR) / "accounts" / "data" / "library_audio_links.json"
LIBRARY_ASSETS_DIR = Path(settings.BASE_DIR) / "accounts" / "static" / "library" / "assets"
MANIFESTS_DIR = LIBRARY_DATA_DIR / "manifests"
PRESET_LIBRARY_CATEGORIES = [
    "Aartis",
    "Books",
    "Audios",
    "Bhajans",
    "Mantras",
    "Vedas",
    "Upanishads",
    "Sacred Hymns",
]

DEITY_PREFIX_PATTERN = re.compile(r"\b(lord|shri|shree|maa|mata|deity)\b", re.IGNORECASE)
DEITY_SPLIT_PATTERN = re.compile(r"\s*(?:,|/|&|\band\b)\s*", re.IGNORECASE)

PDF_CATALOG = {
    "ramcharitmanas.pdf": {
        "slug": "ramcharitmanas",
        "name": "Ramcharitmanas",
        "category": "Books",
        "deity": "Lord Rama",
        "featured": True,
        "popularity": 100,
        "excerpt": "Read Ramcharitmanas in an immersive scripture viewer with PDF mode and future-ready chapter or shloka navigation.",
    },
    "ramayan.pdf": {
        "slug": "ramayan",
        "name": "Ramayan",
        "category": "Books",
        "deity": "Lord Rama",
        "featured": True,
        "popularity": 96,
        "excerpt": "Explore the epic of Lord Rama with flexible reading modes designed for chapter-wise or verse-wise study.",
    },
    "mahabharat.pdf": {
        "slug": "mahabharat",
        "name": "Mahabharat",
        "category": "Books",
        "deity": "Dharma Yuddha",
        "featured": True,
        "popularity": 94,
        "excerpt": "Enter the wisdom, strategy, and dharma of the Mahabharat through a premium long-form reader.",
    },
    "bhagwatgita.pdf": {
        "slug": "bhagwatgita",
        "name": "Bhagwat Gita",
        "category": "Books",
        "deity": "Shri Krishna",
        "featured": True,
        "popularity": 98,
        "excerpt": "Study the Gita in PDF mode today, with chapter-wise and shloka-wise reading support ready for structured uploads.",
    },
    "bhagavadgita.pdf": {
        "slug": "bhagavad-gita",
        "name": "Bhagavad Gita",
        "category": "Books",
        "deity": "Shri Krishna",
        "featured": True,
        "popularity": 98,
        "excerpt": "Study the Gita in PDF mode today, with chapter-wise and shloka-wise reading support ready for structured uploads.",
    },
}


def _language_payload(source: Dict) -> Dict:
    languages = source.get("languages") or {}
    return {
        "hindi": str(languages.get("hindi") or "").strip(),
        "english": str(languages.get("english") or "").strip(),
        "sanskrit": str(languages.get("sanskrit") or "").strip(),
    }


def _normalize_deity_tags(value: str) -> List[str]:
    raw = str(value or "").strip()
    if not raw:
        return []

    tags = []
    seen = set()
    for part in DEITY_SPLIT_PATTERN.split(raw):
        cleaned = DEITY_PREFIX_PATTERN.sub("", part or "")
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" .•-")
        if not cleaned:
            continue
        normalized = cleaned.title()
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        tags.append(normalized)
    return tags


def _load_audio_links() -> Dict[str, Dict]:
    if not LIBRARY_AUDIO_LINKS_PATH.exists():
        return {}
    try:
        payload = json.loads(LIBRARY_AUDIO_LINKS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if not isinstance(payload, dict):
        return {}
    normalized = {}
    for slug, raw in payload.items():
        if not isinstance(raw, dict):
            continue
        key = str(slug or "").strip().lower()
        if not key:
            continue
        normalized[key] = {
            "audio_url": str(raw.get("audio_url") or "").strip(),
            "cover_image": str(raw.get("cover_image") or "").strip(),
            "duration": raw.get("duration"),
            "singer": str(raw.get("singer") or "").strip(),
        }
    return normalized


def _attach_audio_fields(item: Dict, audio_links: Dict[str, Dict]) -> Dict:
    link_meta = audio_links.get(str(item.get("slug") or "").strip().lower(), {})
    item["audio_url"] = str(link_meta.get("audio_url") or "").strip()
    item["cover_image"] = str(link_meta.get("cover_image") or "").strip()
    item["duration"] = link_meta.get("duration")
    item["singer"] = str(link_meta.get("singer") or "").strip()
    return item


def _normalize_aarti_item(item: Dict) -> Dict:
    name = str(item.get("name") or item.get("title") or "").strip()
    slug = str(item.get("slug") or slugify(name) or "").strip()
    category = str(item.get("category") or "Aartis").strip().title()
    if category.lower() in {"aarti", "aartis"}:
        category = "Aartis"
    elif category.lower() in {"book", "books", "ramayan", "mahabharat", "bhagavad gita", "bhagwat gita"}:
        category = "Books"
    elif category.lower() in {"chalisa", "chalisas"}:
        category = "Chalisas"
    elif category.lower() in {"sacred hymn", "sacred hymns", "hymn", "hymns"}:
        category = "Sacred Hymns"
    deity = str(item.get("deity") or name).strip()
    excerpt = str(item.get("excerpt") or item.get("summary") or "").strip()
    languages = _language_payload(item)
    if not excerpt:
        excerpt = (languages.get("english") or languages.get("hindi") or languages.get("sanskrit") or "")[:180].strip()

    return {
        "slug": slug,
        "name": name,
        "category": category,
        "deity": deity,
        "deity_tags": _normalize_deity_tags(deity),
        "excerpt": excerpt,
        "featured": bool(item.get("featured", True)),
        "popularity": int(item.get("popularity") or 80),
        "content_type": "text",
        "reader_modes": ["language"],
        "default_reader_mode": "language",
        "languages": languages,
        "pdf_url": "",
        "structure": {},
    }


def _load_aarti_items() -> List[Dict]:
    if not LIBRARY_SEED_PATH.exists():
        return []

    try:
        payload = json.loads(LIBRARY_SEED_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    if isinstance(payload, dict):
        items = payload.get("items") or payload.get("aartis") or payload.get("data") or []
    elif isinstance(payload, list):
        items = payload
    else:
        items = []

    audio_links = _load_audio_links()
    normalized = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        item = _attach_audio_fields(_normalize_aarti_item(raw), audio_links)
        if item["slug"] and item["name"]:
            normalized.append(item)
    return normalized


def _load_manifest_for_slug(slug: str) -> Dict:
    manifest_path = MANIFESTS_DIR / "{0}.json".format(slug)
    if not manifest_path.exists():
        return {}

    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _build_pdf_item(file_name: str, meta: Dict) -> Dict:
    manifest = _load_manifest_for_slug(meta["slug"])
    has_chapters = bool(manifest.get("chapters"))
    has_shlokas = bool(manifest.get("shlokas"))
    reader_modes = ["pdf"]
    if has_chapters:
        reader_modes.append("chapter")
    if has_shlokas:
        reader_modes.append("shloka")

    return {
        "slug": meta["slug"],
        "name": meta["name"],
        "category": meta["category"],
        "deity": meta["deity"],
        "deity_tags": _normalize_deity_tags(meta["deity"]),
        "excerpt": meta["excerpt"],
        "featured": bool(meta.get("featured", False)),
        "popularity": int(meta.get("popularity") or 75),
        "content_type": "pdf",
        "reader_modes": reader_modes,
        "default_reader_mode": "chapter" if has_chapters else "pdf",
        "languages": {"hindi": "", "english": "", "sanskrit": ""},
        "pdf_url": static("library/assets/{0}".format(file_name)),
        "structure": manifest,
        "audio_url": "",
        "cover_image": "",
        "duration": None,
        "singer": "",
    }


def _load_pdf_items() -> List[Dict]:
    items = []
    if not LIBRARY_ASSETS_DIR.exists():
        return items

    for file_name, meta in PDF_CATALOG.items():
        asset_path = LIBRARY_ASSETS_DIR / file_name
        if asset_path.exists():
            items.append(_build_pdf_item(file_name, meta))
    return items


def load_library_items(force_refresh: bool = False) -> List[Dict]:
    if not force_refresh:
        cached = cache.get(LIBRARY_CACHE_KEY)
        if cached is not None and len(cached) > 0:
            return cached

    items = _load_aarti_items() + _load_pdf_items()
    items = sorted(
        items,
        key=lambda entry: (
            0 if entry.get("featured") else 1,
            -(entry.get("popularity") or 0),
            entry.get("category", ""),
            entry.get("name", ""),
        ),
    )
    cache.set(LIBRARY_CACHE_KEY, items, timeout=900)
    return items


def get_library_item(slug: str) -> Optional[Dict]:
    target = (slug or "").strip().lower()
    if not target:
        return None
    for item in load_library_items():
        if item["slug"].lower() == target:
            return item
    return None


def build_library_payload() -> Dict:
    items = load_library_items()
    categories = list(PRESET_LIBRARY_CATEGORIES)
    featured = [item for item in items if item.get("featured")] or items[:6]
    deities = sorted(
        {
            tag
            for item in items
            for tag in (item.get("deity_tags") or _normalize_deity_tags(item.get("deity")))
            if tag
        }
    )
    return {
        "items": items,
        "featured": featured[:8],
        "categories": categories,
        "deities": deities,
        "total": len(items),
        "source": "local-assets",
        "debug": {
            "library_seed_exists": LIBRARY_SEED_PATH.exists(),
            "pdf_assets_dir_exists": LIBRARY_ASSETS_DIR.exists(),
            "pdf_files_found": [path.name for path in LIBRARY_ASSETS_DIR.glob("*.pdf")] if LIBRARY_ASSETS_DIR.exists() else [],
        },
    }
