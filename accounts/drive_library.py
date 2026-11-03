"""Builds library books from a folder of PDFs, so new books show up without any code change.

The folder layout is the whole configuration:

    SanatanSeva Library/        <- LIBRARY_DRIVE_FOLDER_ID (or LIBRARY_LOCAL_DIR)
        Gita/                   <- a top-level folder becomes a collection ("Gita")
            Bhagavad Gita.pdf   <- every PDF becomes a book in it
        Purans/
            Shiv Puran.pdf
            Vishnu Puran/       <- deeper folders group books (shown as "Purans › Vishnu Puran")
                Part 1.pdf

Two sources are supported. Google Drive is read through its API, either with an API key (the folder must be shared as "Anyone
with the link") or with a service account (share the folder with the service account's e-mail address; it can stay private).
A local folder with the same layout works too, which is handy for development. The folder tree is cached, and the PDFs are
streamed through the site (see stream_file) so the Drive links themselves never have to be public.
"""
import base64
import hashlib
import json
import logging
import mimetypes
import os
import re
import shutil
import tempfile
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from django.conf import settings
from django.core.cache import cache
from django.http import Http404, HttpResponse, StreamingHttpResponse
from django.urls import reverse
from django.utils.text import slugify

logger = logging.getLogger(__name__)

DRIVE_API = "https://www.googleapis.com/drive/v3"
FOLDER_MIME = "application/vnd.google-apps.folder"
SHORTCUT_MIME = "application/vnd.google-apps.shortcut"
PDF_MIME = "application/pdf"
MAX_DEPTH = 6
MAX_FILES = 3000
TREE_KEY = "library::drive::tree::v1"
STALE_KEY = "library::drive::tree::stale::v1"
FAIL_KEY = "library::drive::tree::failed::v1"

# one pooled session, so every PDF request reuses an open connection to Google instead of paying for a new TLS handshake
_http = requests.Session()
_http.mount("https://", requests.adapters.HTTPAdapter(pool_connections=4, pool_maxsize=16))

_token_lock = threading.Lock()
_token = {"value": "", "expires": 0.0}


# ---- the cache must never be able to take the library down (a serverless cache can be slow or briefly unavailable) -----------------
def _cget(key):
    try:
        return cache.get(key)
    except Exception as exc:
        logger.warning("Library cache read failed: %s", exc)
        return None


def _cset(key, value, timeout):
    try:
        cache.set(key, value, timeout)
    except Exception as exc:
        logger.warning("Library cache write failed: %s", exc)


def _cdel(key):
    try:
        cache.delete(key)
    except Exception:
        pass


def _serverless() -> bool:
    return bool(getattr(settings, "ON_VERCEL", False))


# ---- configuration ----------------------------------------------------------------------------------------------------------------
def _cfg(name: str, default=""):
    return getattr(settings, name, default) or default


def folder_id() -> str:
    raw = str(_cfg("LIBRARY_DRIVE_FOLDER_ID")).strip()
    # accept a pasted share link as well as a bare id
    m = re.search(r"/folders/([A-Za-z0-9_-]+)", raw)
    return m.group(1) if m else raw


def local_dir() -> Optional[Path]:
    raw = str(_cfg("LIBRARY_LOCAL_DIR")).strip()
    if not raw:
        return None
    p = Path(raw).expanduser()
    return p if p.is_dir() else None


def ttl() -> int:
    try:
        return max(30, int(_cfg("LIBRARY_DRIVE_TTL", 600)))
    except (TypeError, ValueError):
        return 600


def is_configured() -> bool:
    return bool(local_dir() or folder_id())


def auth_mode() -> str:
    """How Drive is read: a private folder shared with a service account, an API key, or (default) a public folder with no key."""
    if local_dir():
        return "local"
    if _service_account_info():
        return "service-account"
    if str(_cfg("GOOGLE_DRIVE_API_KEY")).strip():
        return "api-key"
    return "public"


def _service_account_info() -> Optional[Dict]:
    raw = str(_cfg("GOOGLE_SERVICE_ACCOUNT_JSON")).strip()
    if not raw:
        path = str(_cfg("GOOGLE_SERVICE_ACCOUNT_FILE")).strip()
        if path and Path(path).expanduser().is_file():
            raw = Path(path).expanduser().read_text(encoding="utf-8")
    if not raw:
        return None
    try:
        info = json.loads(raw if raw.lstrip().startswith("{") else base64.b64decode(raw).decode("utf-8"))
    except Exception:
        logger.error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON (or base64 JSON).")
        return None
    return info if info.get("client_email") and info.get("private_key") else None


def _access_token() -> str:
    info = _service_account_info()
    if not info:
        return ""
    with _token_lock:
        if _token["value"] and _token["expires"] > time.time() + 60:
            return _token["value"]
        import jwt  # PyJWT, with the cryptography backend for RS256

        now = int(time.time())
        assertion = jwt.encode(
            {"iss": info["client_email"], "scope": "https://www.googleapis.com/auth/drive.readonly",
             "aud": info.get("token_uri") or "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 3600},
            info["private_key"], algorithm="RS256",
        )
        r = requests.post(info.get("token_uri") or "https://oauth2.googleapis.com/token",
                          data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion}, timeout=10)
        r.raise_for_status()
        data = r.json()
        _token["value"] = data["access_token"]
        _token["expires"] = time.time() + int(data.get("expires_in", 3600))
        return _token["value"]


def _auth() -> Tuple[Dict[str, str], Dict[str, str]]:
    token = _access_token()
    if token:
        return {"Authorization": "Bearer " + token}, {}
    key = str(_cfg("GOOGLE_DRIVE_API_KEY")).strip()
    if key:
        return {}, {"key": key}
    raise RuntimeError("No Google credentials: set GOOGLE_DRIVE_API_KEY or GOOGLE_SERVICE_ACCOUNT_JSON.")


# ---- naming -----------------------------------------------------------------------------------------------------------------------
def pretty(name: str) -> str:
    """A file or folder name as a reader would write it: no extension, no sort prefix, no underscores."""
    s = re.sub(r"\.pdf$", "", str(name), flags=re.I)
    s = re.sub(r"^\s*\d{1,3}\s*[-_.)]\s*", "", s)  # "01 - Gita" -> "Gita" (people number folders to control order)
    s = re.sub(r"\s*\(\d+\)\s*$", "", s)  # browser duplicates: "Gita (1)"
    s = re.sub(r"[_]+", " ", s)
    if " " not in s and "-" in s:  # "agni-puran" is a name written with hyphens, not a hyphenated word
        s = s.replace("-", " ")
    s = re.sub(r"\s+", " ", s).strip(" -.")
    if s and (s.islower() or s.isupper()):
        s = s.title()
    return s or str(name)


def _natural_key(value: str):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", str(value))]


DEITY_RULES = [
    (r"gita|krishna|govind|gopal|murari|janmashtami", "Shri Krishna"),
    (r"shiv|mahadev|rudra|shankar", "Lord Shiva"),
    (r"hanuman|bajrang|sundar ?kand", "Lord Hanuman"),
    (r"\bram\b|rama|raghu|ramayan|ramcharit", "Lord Rama"),
    (r"vishnu|narayan|bhagwat|bhagavat|hari\b", "Lord Vishnu"),
    (r"ganesh|ganapati|vinayak", "Lord Ganesha"),
    (r"durga|devi|shakti|kali|chandi|navratri", "Maa Durga"),
    (r"lakshmi|laxmi", "Maa Lakshmi"),
    (r"saraswati", "Maa Saraswati"),
    (r"surya|aditya", "Lord Surya"),
    (r"veda|upanishad", "Vedic Wisdom"),
]


def infer_deity(*parts: str) -> str:
    hay = " ".join(p for p in parts if p).lower()
    for pattern, deity in DEITY_RULES:
        if re.search(pattern, hay):
            return deity
    return ""


def _token_of(file_id: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(file_id).lower())[-6:]


def _human_size(n) -> str:
    try:
        n = float(n)
    except (TypeError, ValueError):
        return ""
    if n <= 0:
        return ""
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return ("%d %s" % (n, unit)) if unit == "B" else ("%.1f %s" % (n, unit))
        n /= 1024
    return ""


IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp")


def _attach_cover_images(pdfs: List[Dict], images: List[Dict]) -> None:
    """A picture with the same name as a PDF (agni-puran.jpg next to agni-puran.pdf) becomes that book's cover; a single
    'cover.jpg' in a folder with one PDF does too. It wins over the first-page thumbnail."""
    by_stem = {}
    for img in images:
        if img.get("thumb"):
            by_stem[re.sub(r"\.[A-Za-z0-9]+$", "", img["name"]).strip().lower()] = img["thumb"]
    for pdf in pdfs:
        stem = re.sub(r"\.pdf$", "", pdf["name"], flags=re.I).strip().lower()
        if stem in by_stem:
            pdf["thumb"] = by_stem[stem]
        elif len(pdfs) == 1 and "cover" in by_stem:
            pdf["thumb"] = by_stem["cover"]


# ---- reading the folder tree --------------------------------------------------------------------------------------------------------
def _list_children(fid: str, headers: Dict[str, str], params: Dict[str, str]) -> List[Dict]:
    out: List[Dict] = []
    page = None
    while True:
        p = dict(params)
        p.update({
            "q": "'%s' in parents and trashed=false" % fid,
            "fields": "nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,shortcutDetails(targetId,targetMimeType))",
            "pageSize": "1000", "supportsAllDrives": "true", "includeItemsFromAllDrives": "true",
        })
        if page:
            p["pageToken"] = page
        r = requests.get(DRIVE_API + "/files", headers=headers, params=p, timeout=(5, 20))
        if r.status_code in (403, 404):
            raise RuntimeError("Google Drive refused access to the folder (%s). Share it with the service account, or set it to 'Anyone with the link'. %s" % (r.status_code, r.text[:200]))
        r.raise_for_status()
        data = r.json()
        out.extend(data.get("files", []))
        page = data.get("nextPageToken")
        if not page:
            return out


def _walk_drive(root: str) -> List[Dict]:
    headers, params = _auth()
    files: List[Dict] = []
    stack: List[Tuple[str, List[str]]] = [(root, [])]
    seen = set()
    while stack and len(files) < MAX_FILES:
        fid, path = stack.pop()
        if fid in seen or len(path) > MAX_DEPTH:
            continue
        seen.add(fid)
        here: List[Dict] = []
        images: List[Dict] = []
        for f in _list_children(fid, headers, params):
            mime, target, name = f.get("mimeType", ""), f.get("id"), f.get("name", "")
            if mime.startswith("image/") or name.lower().endswith(IMAGE_EXT):
                images.append({"name": name, "thumb": re.sub(r"=s\d+(-c)?$", "", f.get("thumbnailLink", ""))})
                continue
            if mime == SHORTCUT_MIME:
                detail = f.get("shortcutDetails") or {}
                mime, target = detail.get("targetMimeType", ""), detail.get("targetId") or target
            if mime == FOLDER_MIME:
                stack.append((target, path + [name]))
            elif mime == PDF_MIME or name.lower().endswith(".pdf"):
                here.append({"id": target, "name": name, "path": path, "size": int(f.get("size") or 0), "modified": f.get("modifiedTime", ""), "source": "drive",
                              "thumb": re.sub(r"=s\d+(-c)?$", "", f.get("thumbnailLink", ""))})
        _attach_cover_images(here, images)
        files.extend(here)
    return files


def _list_public(fid: str) -> List[Dict]:
    """A public folder's contents, read from the same page Google uses to embed a folder (no API key needed)."""
    import html as _html

    r = requests.get("https://drive.google.com/embeddedfolderview", params={"id": fid}, timeout=(5, 20),
                     headers={"User-Agent": "Mozilla/5.0 (SanatanSeva library sync)"})
    if r.status_code != 200 or "flip-entries" not in r.text and "flip-entry" not in r.text:
        raise RuntimeError("Google Drive did not list the folder (HTTP %s). Is it shared as 'Anyone with the link'?" % r.status_code)
    out = []
    for blk in r.text.split('<div class="flip-entry" id="entry-')[1:]:
        entry_id = blk.split('"', 1)[0]
        href = re.search(r'<a href="([^"]+)"', blk)
        name = re.search(r'class="flip-entry-title">(.*?)</div>', blk, re.S)
        if not href or not name:
            continue
        img = re.search(r'<img src="(https://lh3\.googleusercontent\.com/drive-storage/[^"]+)"', blk)
        thumb = re.sub(r"=s\d+(-c)?$", "", _html.unescape(img.group(1))) if img else ""
        out.append({"id": entry_id, "name": _html.unescape(name.group(1)).strip(), "folder": "/folders/" in _html.unescape(href.group(1)), "thumb": thumb})
    return out


def _walk_public(root: str) -> List[Dict]:
    """Reads the folder level by level, listing every folder of a level at the same time."""
    from concurrent.futures import ThreadPoolExecutor

    files: List[Dict] = []
    seen = {root}
    level: List[Tuple[str, List[str]]] = [(root, [])]

    def list_one(item):
        fid, path = item
        try:
            return item, _list_public(fid)
        except Exception as exc:
            if not path:  # the top folder failing means nothing can be shown
                raise
            logger.warning("Library sub-folder skipped (%s): %s", "/".join(path), exc)
            return item, []

    with ThreadPoolExecutor(max_workers=8) as pool:
        for _ in range(MAX_DEPTH + 1):
            if not level or len(files) >= MAX_FILES:
                break
            nxt: List[Tuple[str, List[str]]] = []
            for (fid, path), entries in pool.map(list_one, level):
                here: List[Dict] = []
                images: List[Dict] = []
                for f in entries:
                    if f["folder"]:
                        if f["id"] not in seen:
                            seen.add(f["id"])
                            nxt.append((f["id"], path + [f["name"]]))
                    elif f["name"].lower().endswith(".pdf"):
                        here.append({"id": f["id"], "name": f["name"], "path": path, "size": 0, "modified": "", "source": "drive", "thumb": f.get("thumb", "")})
                    elif f["name"].lower().endswith(IMAGE_EXT):
                        images.append({"name": f["name"], "thumb": f.get("thumb", "")})
                _attach_cover_images(here, images)
                files.extend(here)
            level = nxt
    return files


def _walk_local(root: Path) -> List[Dict]:
    files: List[Dict] = []
    base = root.resolve()
    for dirpath, dirnames, filenames in os.walk(base):
        rel = Path(dirpath).resolve().relative_to(base)
        if len(rel.parts) > MAX_DEPTH:
            dirnames[:] = []
            continue
        dirnames[:] = sorted((d for d in dirnames if not d.startswith(".")), key=_natural_key)
        for fn in sorted(filenames, key=_natural_key):
            if fn.startswith(".") or not fn.lower().endswith(".pdf"):
                continue
            full = Path(dirpath) / fn
            relpath = (rel / fn).as_posix()
            st = full.stat()
            files.append({"id": "L" + hashlib.sha1(relpath.encode("utf-8")).hexdigest()[:20], "name": fn, "path": list(rel.parts),
                          "size": st.st_size, "modified": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(st.st_mtime)),
                          "source": "local", "local_path": relpath})
    return files


def get_tree(force: bool = False) -> Dict:
    """The cached list of PDFs. Falls back to the last good copy if Drive is unreachable, and never raises."""
    empty = {"files": [], "fetched": 0, "error": "", "source": ""}
    if not is_configured():
        return empty
    if not force:
        fresh = _cget(TREE_KEY)
        if fresh:
            return fresh
        failed = _cget(FAIL_KEY)
        if failed:  # a recent failure: serve the old copy rather than hammering Google on every request
            return _cget(STALE_KEY) or dict(empty, error=str(failed))
    try:
        ld = local_dir()
        mode = auth_mode()
        files = _walk_local(ld) if ld else (_walk_public(folder_id()) if mode == "public" else _walk_drive(folder_id()))
        tree = {"files": files, "fetched": int(time.time()), "error": "", "source": "local" if ld else "drive", "mode": mode}
        _cset(TREE_KEY, tree, ttl())
        _cset(STALE_KEY, tree, 7 * 24 * 3600)
        _cdel(FAIL_KEY)
        return tree
    except Exception as exc:  # network down, bad credentials, folder not shared, ...
        logger.warning("Library folder could not be read: %s", exc)
        _cset(FAIL_KEY, str(exc)[:300], 60)
        return _cget(STALE_KEY) or dict(empty, error=str(exc)[:300])


# ---- tree -> library items ----------------------------------------------------------------------------------------------------------
def build_items(tree: Optional[Dict] = None) -> List[Dict]:
    tree = tree if tree is not None else get_tree()
    viewer = str(_cfg("LIBRARY_PDF_VIEWER", "proxy")).lower()
    rows = []
    for f in tree.get("files", []):
        rows.append((f.get("path") or [], f))
    rows.sort(key=lambda r: ([_natural_key(p) for p in r[0]], _natural_key(r[1]["name"])))
    items: List[Dict] = []
    seen_slugs = set()
    first_in_collection = set()
    for path, f in rows:
        category = pretty(path[0]) if path else "Library"
        sub = " › ".join(pretty(p) for p in path[1:])
        title = pretty(f["name"])
        # a book split into parts ("Part 1.pdf") reads better with its folder name in front
        if sub and re.fullmatch(r"(part|vol(ume)?|volume|book|khand|kand|skandh|adhyay)?\s*[-.]?\s*\d+", title, flags=re.I):
            title = "%s, %s" % (pretty(path[-1]), title)
        slug = "%s-%s" % (slugify(title)[:60] or "book", _token_of(f["id"]))
        if slug in seen_slugs:
            slug = "%s-%s" % (slug, hashlib.sha1(f["id"].encode()).hexdigest()[:4])
        seen_slugs.add(slug)
        deity = infer_deity(category, sub, title) or category
        excerpt = "%s from the %s collection%s." % (title, category, (" (" + sub + ")") if sub else "")
        pdf_url = reverse("library_file", args=[f["id"]])
        embed = False
        if viewer == "preview" and f.get("source") == "drive":
            pdf_url, embed = "https://drive.google.com/file/d/%s/preview" % f["id"], True
        feat = category not in first_in_collection
        first_in_collection.add(category)
        items.append({
            "slug": slug, "name": title, "category": category, "subcategory": sub, "deity": deity, "deity_tags": [deity],
            "excerpt": excerpt, "featured": feat, "popularity": 85 if feat else 70, "content_type": "pdf",
            "reader_modes": ["pdf"], "default_reader_mode": "pdf", "languages": {"hindi": "", "english": "", "sanskrit": ""},
            "pdf_url": pdf_url, "pdf_embed": embed, "structure": {}, "audio_url": "", "cover_image": reverse("library_cover", args=[f["id"]]) if f.get("thumb") else "", "duration": None, "singer": "",
            "cover_page": bool(f.get("thumb")),
            "source": f.get("source", "drive"), "file_id": f["id"], "size": f.get("size", 0), "size_label": _human_size(f.get("size")),
            "modified": f.get("modified", ""),
        })
    return items


def collections_summary(items: List[Dict]) -> List[Dict]:
    """One entry per category found in the folder, for the library's 'browse by topic' section and collection pages."""
    seen: Dict[str, Dict] = {}
    for it in items:
        c = it.get("category")
        if c and c not in seen:
            seen[c] = {"label": c, "slug": slugify(c), "count": 0}
        if c:
            seen[c]["count"] += 1
    return list(seen.values())


def file_meta(file_id: str) -> Optional[Dict]:
    """Only files that are really in the folder can be served, so the endpoint cannot be used to fetch arbitrary Drive files."""
    for f in get_tree().get("files", []):
        if f["id"] == file_id:
            return f
    tree = get_tree(force=True) if _cget(FAIL_KEY) is None else None  # a brand-new upload may not be in the cache yet
    if tree:
        for f in tree.get("files", []):
            if f["id"] == file_id:
                return f
    return None


# ---- disk cache: a book is downloaded once, in the background, then served from disk --------------------------------------------------
_dl_lock = threading.Lock()
_downloading = set()
MAX_PARALLEL_DOWNLOADS = 2


def cache_dir() -> Path:
    raw = str(_cfg("LIBRARY_CACHE_DIR")).strip()
    path = Path(raw).expanduser() if raw else Path(tempfile.gettempdir()) / "sms-library-cache"
    path.mkdir(parents=True, exist_ok=True)
    return path


def cache_limit() -> int:
    try:
        return max(50, int(_cfg("LIBRARY_CACHE_MAX_MB", 1500))) * 1024 * 1024
    except (TypeError, ValueError):
        return 1500 * 1024 * 1024


def _cache_path(file_id: str) -> Path:
    return cache_dir() / (re.sub(r"[^A-Za-z0-9_-]", "", file_id) + ".pdf")


def cached_file(file_id: str) -> Optional[Path]:
    try:
        path = _cache_path(file_id)
        if path.is_file() and path.stat().st_size > 0:
            os.utime(path, None)  # recently read books are the last to be evicted
            return path
    except OSError:
        pass
    return None


def _make_room(need: int) -> bool:
    files = sorted((f for f in cache_dir().glob("*.pdf")), key=lambda f: f.stat().st_mtime)
    total = sum(f.stat().st_size for f in files)
    limit = cache_limit()
    if need > limit // 2:
        return False
    while files and total + need > limit:
        oldest = files.pop(0)
        total -= oldest.stat().st_size
        try:
            oldest.unlink()
        except OSError:
            pass
    return total + need <= limit


def _source_request(file_id: str):
    if auth_mode() == "public":
        return "https://drive.usercontent.google.com/download", {}, {"id": file_id, "export": "download", "confirm": "t"}
    headers, params = _auth()
    return "%s/files/%s" % (DRIVE_API, file_id), dict(headers), dict(params, alt="media", supportsAllDrives="true")


def _download(file_id: str, size_hint: int) -> None:
    part = _cache_path(file_id).with_suffix(".part")
    try:
        url, h, p = _source_request(file_id)
        r = _http.get(url, headers=h, params=p, stream=True, timeout=(8, 120), allow_redirects=True)
        if r.status_code != 200:
            r.close()
            return
        size = int(r.headers.get("Content-Length") or size_hint or 0)
        if size and not _make_room(size):
            r.close()
            return
        with open(part, "wb") as fh:
            for chunk in r.iter_content(256 * 1024):
                if chunk:
                    fh.write(chunk)
        os.replace(part, _cache_path(file_id))
    except Exception as exc:
        logger.warning("Library book could not be cached (%s): %s", file_id, exc)
    finally:
        try:
            if part.exists():
                part.unlink()
        except OSError:
            pass
        with _dl_lock:
            _downloading.discard(file_id)


def warm(meta: Dict) -> None:
    """Start fetching a whole book in the background. Reading starts straight away from Google; once the copy is complete,
    every later request (for anyone) is served from disk."""
    fid = meta["id"]
    if _serverless():
        return
    with _dl_lock:
        if fid in _downloading or len(_downloading) >= MAX_PARALLEL_DOWNLOADS or cached_file(fid):
            return
        _downloading.add(fid)
    threading.Thread(target=_download, args=(fid, int(meta.get("size") or 0)), daemon=True, name="library-cache-" + fid[:6]).start()


# ---- serving the PDF ----------------------------------------------------------------------------------------------------------------
def _disposition(name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._ -]", "_", name) or "book.pdf"
    return 'inline; filename="%s"' % safe


def _parse_range(header: str, size: int) -> Optional[Tuple[int, int]]:
    m = re.fullmatch(r"bytes=(\d*)-(\d*)", (header or "").strip())
    if not m or (not m.group(1) and not m.group(2)):
        return None
    if m.group(1):
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else size - 1
    else:
        start, end = max(0, size - int(m.group(2))), size - 1
    end = min(end, size - 1)
    return (start, end) if 0 <= start <= end else None


def _serve_local(request, meta: Dict):
    ld = local_dir()
    if not ld:
        raise Http404("Library folder is not available.")
    full = (ld / meta["local_path"]).resolve()
    if ld.resolve() not in full.parents or not full.is_file():
        raise Http404("File not found.")
    return _serve_path(request, full, meta["name"])


def _serve_path(request, full: Path, name: str):
    size = full.stat().st_size
    rng = _parse_range(request.headers.get("Range", ""), size)
    start, end = rng if rng else (0, size - 1)

    def chunks():
        with open(full, "rb") as fh:
            fh.seek(start)
            left = end - start + 1
            while left > 0:
                data = fh.read(min(64 * 1024, left))
                if not data:
                    break
                left -= len(data)
                yield data

    resp = StreamingHttpResponse(chunks(), status=206 if rng else 200, content_type=mimetypes.guess_type(str(full))[0] or PDF_MIME)
    resp["Content-Length"] = str(end - start + 1)
    if rng:
        resp["Content-Range"] = "bytes %d-%d/%d" % (start, end, size)
    resp["Accept-Ranges"] = "bytes"
    resp["Content-Disposition"] = _disposition(name)
    resp["Cache-Control"] = "public, max-age=300"
    return resp


def stream_file(request, file_id: str):
    """Streams one PDF to the browser, forwarding Range requests so large books open and jump to a page quickly."""
    meta = file_meta(file_id)
    if not meta:
        raise Http404("Book not found.")
    if request.method == "HEAD":
        resp = HttpResponse(content_type=PDF_MIME)
        resp["Accept-Ranges"] = "bytes"
        if meta.get("size"):
            resp["Content-Length"] = str(meta["size"])
        return resp
    if meta.get("source") == "local":
        return _serve_local(request, meta)
    copy = cached_file(file_id)
    if copy:
        return _serve_path(request, copy, meta["name"])
    if request.GET.get("warm") == "1":  # only the reader asks for this, not the cover renderer
        warm(meta)
    if auth_mode() == "public":
        url, h, p = "https://drive.usercontent.google.com/download", {}, {"id": file_id, "export": "download", "confirm": "t"}
    else:
        try:
            headers, params = _auth()
        except Exception as exc:
            logger.error("Library file not served: %s", exc)
            raise Http404("Library is not connected to Google Drive.")
        url, h, p = "%s/files/%s" % (DRIVE_API, file_id), dict(headers), dict(params, alt="media", supportsAllDrives="true")
    if request.headers.get("Range"):
        h["Range"] = request.headers["Range"]
    upstream = _http.get(url, headers=h, params=p, stream=True, timeout=(8, 60), allow_redirects=True)
    if upstream.status_code not in (200, 206):
        upstream.close()
        if upstream.status_code == 416:
            return HttpResponse(status=416)
        raise Http404("Google Drive could not provide this book.")
    resp = StreamingHttpResponse(upstream.iter_content(64 * 1024), status=upstream.status_code, content_type=PDF_MIME)
    for name in ("Content-Length", "Content-Range", "ETag", "Last-Modified"):
        if upstream.headers.get(name):
            resp[name] = upstream.headers[name]
    resp["Accept-Ranges"] = "bytes"
    resp["Content-Disposition"] = _disposition(meta["name"])
    resp["Cache-Control"] = "public, max-age=3600"
    resp._resource_closers.append(upstream.close)
    return resp


def stream_cover(request, file_id: str):
    """The first page of a book as an image, used as its cover. Fetched from Google and cached by the browser for a day."""
    meta = file_meta(file_id)
    base = (meta or {}).get("thumb")
    if not base:
        raise Http404("No cover for this book.")
    try:
        width = max(160, min(1000, int(request.GET.get("w", 600))))
    except ValueError:
        width = 600
    try:
        r = _http.get("%s=s%d" % (base, width), timeout=(5, 15))
    except requests.RequestException:
        raise Http404("Cover unavailable.")
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/"):
        raise Http404("Cover unavailable.")
    resp = HttpResponse(r.content, content_type=r.headers["content-type"])
    resp["Cache-Control"] = "public, max-age=86400"
    return resp


def public_status() -> Dict:
    """Safe to show anyone: whether the library folder is connected, how, and the last problem (no secrets)."""
    tree = get_tree()
    return {"configured": is_configured(), "mode": tree.get("mode") or auth_mode(), "source": tree.get("source") or "none",
            "books": len(tree.get("files", [])), "error": tree.get("error", ""), "fetched": tree.get("fetched", 0), "serverless": _serverless()}


def status_report() -> Dict:
    """For the sync_library command: what is configured and what was found."""
    tree = get_tree(force=True)
    items = build_items(tree)
    return {"configured": is_configured(), "mode": tree.get("mode") or auth_mode(), "source": tree.get("source") or "none", "error": tree.get("error", ""), "books": len(items),
            "collections": collections_summary(items), "items": items}
