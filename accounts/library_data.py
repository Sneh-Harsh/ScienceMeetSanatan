import json
from pathlib import Path
from typing import Dict, List, Optional
from zipfile import ZipFile
from xml.etree import ElementTree as ET

from django.conf import settings
from django.core.cache import cache
from django.templatetags.static import static
from django.utils.text import slugify


LIBRARY_CACHE_KEY = "library::items::local::v3"
LIBRARY_DATA_DIR = Path(settings.BASE_DIR) / "accounts" / "data" / "library"
LIBRARY_ASSETS_DIR = Path(settings.BASE_DIR) / "accounts" / "static" / "library" / "assets"
AARTI_SOURCE_PATH = LIBRARY_DATA_DIR / "Aartis.json"
MANIFESTS_DIR = LIBRARY_DATA_DIR / "manifests"

PDF_CATALOG = {
    "ramcharitmanas.pdf": {
        "slug": "ramcharitmanas",
        "name": "Ramcharitmanas",
        "category": "Ramayan",
        "deity": "Lord Rama",
        "featured": True,
        "popularity": 100,
        "excerpt": "Read Ramcharitmanas in an immersive scripture viewer with PDF mode and future-ready chapter or shloka navigation.",
    },
    "ramayan.pdf": {
        "slug": "ramayan",
        "name": "Ramayan",
        "category": "Ramayan",
        "deity": "Lord Rama",
        "featured": True,
        "popularity": 96,
        "excerpt": "Explore the epic of Lord Rama with flexible reading modes designed for chapter-wise or verse-wise study.",
    },
    "mahabharat.pdf": {
        "slug": "mahabharat",
        "name": "Mahabharat",
        "category": "Mahabharat",
        "deity": "Dharma Yuddha",
        "featured": True,
        "popularity": 94,
        "excerpt": "Enter the wisdom, strategy, and dharma of the Mahabharat through a premium long-form reader.",
    },
    "bhagwatgita.pdf": {
        "slug": "bhagwatgita",
        "name": "Bhagwat Gita",
        "category": "Bhagavad Gita",
        "deity": "Shri Krishna",
        "featured": True,
        "popularity": 98,
        "excerpt": "Study the Gita in PDF mode today, with chapter-wise and shloka-wise reading support ready for structured uploads.",
    },
    "bhagavadgita.pdf": {
        "slug": "bhagavad-gita",
        "name": "Bhagavad Gita",
        "category": "Bhagavad Gita",
        "deity": "Shri Krishna",
        "featured": True,
        "popularity": 98,
        "excerpt": "Study the Gita in PDF mode today, with chapter-wise and shloka-wise reading support ready for structured uploads.",
    },
}


def _parse_aarti_docx_like_json(path: Path):
    with ZipFile(path) as archive:
        xml_data = archive.read("word/document.xml")

    root = ET.fromstring(xml_data)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    lines = []
    for paragraph in root.findall(".//w:p", namespace):
        fragments = []
        for node in paragraph.findall(".//w:t", namespace):
            fragments.append(node.text or "")
        line = "".join(fragments).strip()
        if line:
            lines.append(line)

    return json.loads("\n".join(lines))


def _load_json_or_docx_json(path: Path):
    raw_bytes = path.read_bytes()
    try:
        return json.loads(raw_bytes.decode("utf-8"))
    except Exception:
        return _parse_aarti_docx_like_json(path)


def _language_payload(source: Dict) -> Dict:
    languages = source.get("languages") or {}
    return {
        "hindi": str(languages.get("hindi") or "").strip(),
        "english": str(languages.get("english") or "").strip(),
        "sanskrit": str(languages.get("sanskrit") or "").strip(),
    }


def _normalize_aarti_item(item: Dict) -> Dict:
    name = str(item.get("name") or item.get("title") or "").strip()
    slug = str(item.get("slug") or slugify(name) or "").strip()
    category = str(item.get("category") or "Aartis").strip().title()
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
    if not AARTI_SOURCE_PATH.exists():
        return []

    payload = _load_json_or_docx_json(AARTI_SOURCE_PATH)
    if isinstance(payload, dict):
        items = payload.get("items") or payload.get("aartis") or payload.get("data") or []
    elif isinstance(payload, list):
        items = payload
    else:
        items = []

    normalized = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        item = _normalize_aarti_item(raw)
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
        "excerpt": meta["excerpt"],
        "featured": bool(meta.get("featured", False)),
        "popularity": int(meta.get("popularity") or 75),
        "content_type": "pdf",
        "reader_modes": reader_modes,
        "default_reader_mode": "chapter" if has_chapters else "pdf",
        "languages": {"hindi": "", "english": "", "sanskrit": ""},
        "pdf_url": static("library/assets/{0}".format(file_name)),
        "structure": manifest,
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
    categories = sorted({item["category"] for item in items if item.get("category")})
    featured = [item for item in items if item.get("featured")] or items[:6]
    return {
        "items": items,
        "featured": featured[:8],
        "categories": categories,
        "total": len(items),
        "source": "local-assets",
        "debug": {
            "aarti_source_exists": AARTI_SOURCE_PATH.exists(),
            "pdf_assets_dir_exists": LIBRARY_ASSETS_DIR.exists(),
            "pdf_files_found": [path.name for path in LIBRARY_ASSETS_DIR.glob("*.pdf")] if LIBRARY_ASSETS_DIR.exists() else [],
        },
    }
