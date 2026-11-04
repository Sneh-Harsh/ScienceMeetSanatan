import logging
import os
from xml.sax.saxutils import escape

from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET


def healthz(_request):
    return JsonResponse({"status": "ok"})


# (path, changefreq, priority) - public pages only; login-gated areas stay out of the index
SITEMAP_PAGES = [
    ("/", "daily", "1.0"),
    ("/panchang/", "daily", "0.9"),
    ("/library/", "weekly", "0.9"),
    ("/horoscope/", "daily", "0.8"),
    ("/kundali/", "monthly", "0.7"),
    ("/baby-names/", "monthly", "0.7"),
    ("/quizzes/", "weekly", "0.6"),
    ("/pandits/", "weekly", "0.7"),
    ("/astrologers/", "weekly", "0.7"),
    ("/about/", "monthly", "0.5"),
]


def _site_root(request) -> str:
    configured = os.environ.get("SITE_URL", "").strip().rstrip("/")
    if configured:
        return configured
    proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip() or request.scheme
    return f"{proto}://{request.get_host()}"


@require_GET
def sitemap_xml(request):
    root = _site_root(request)
    entries = [(path, freq, prio) for path, freq, prio in SITEMAP_PAGES]
    try:
        from accounts.library_data import load_library_items, _collections_summary

        items = load_library_items()
        entries += [(f"/library/collections/{c['slug']}/", "weekly", "0.6") for c in _collections_summary(items)]
        entries += [(f"/library/{it['slug']}/", "monthly", "0.5") for it in items if it.get("slug")]
    except Exception:
        logging.getLogger(__name__).exception("Sitemap could not list library pages")

    seen, rows = set(), []
    for path, freq, prio in entries:
        if path in seen:
            continue
        seen.add(path)
        rows.append(
            f"  <url><loc>{escape(root + path)}</loc><changefreq>{freq}</changefreq><priority>{prio}</priority></url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n"
    )
    response = HttpResponse(xml, content_type="application/xml; charset=utf-8")
    response["Cache-Control"] = "public, max-age=3600"
    return response


@require_GET
def robots_txt(request):
    body = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin/\n"
        "Disallow: /api/\n"
        "Disallow: /oauth/\n"
        "Disallow: /login/\n"
        "Disallow: /logout/\n"
        "Disallow: /profile/\n"
        "Disallow: /wallet/\n"
        "Disallow: /library/file/\n"
        "Disallow: /library/cover/\n"
        f"\nSitemap: {_site_root(request)}/sitemap.xml\n"
    )
    return HttpResponse(body, content_type="text/plain; charset=utf-8")
