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


def _urlset(root, rows):
    body = "\n".join(
        f"  <url><loc>{escape(root + path)}</loc>"
        + (f"<lastmod>{lastmod}</lastmod>" if lastmod else "")
        + f"<changefreq>{freq}</changefreq><priority>{prio}</priority></url>"
        for path, freq, prio, lastmod in rows
    )
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "\n</urlset>\n"
    response = HttpResponse(xml, content_type="application/xml; charset=utf-8")
    response["Cache-Control"] = "public, max-age=3600"
    return response


def _today():
    from datetime import date

    return date.today().isoformat()


def _sitemap_rows(kind: str):
    today = _today()
    if kind == "pages":
        return [(p, f, pr, today if f == "daily" else None) for p, f, pr in SITEMAP_PAGES]
    rows = []
    try:
        if kind == "library":
            from accounts.library_data import load_library_items, _collections_summary

            items = load_library_items()
            rows += [(f"/library/collections/{c['slug']}/", "weekly", "0.6", None) for c in _collections_summary(items)]
            rows += [(f"/library/{it['slug']}/", "monthly", "0.5", None) for it in items if it.get("slug")]
        elif kind == "pandit":
            from pandit import seo_pages

            rows += [(f"/pandit-in-{c}/", "weekly", "0.7", None) for c in seo_pages.CITIES]
            rows += [(f"/pandit-for-{slug}/", "weekly", "0.6", None) for slug in seo_pages.all_slugs()]
        elif kind == "panchang":
            from accounts import seo_data as sd

            rows += [(f"/panchang/{c}/", "daily", "0.8", today) for c in sd.PANCHANG_CITIES]
            rows += [(f"/hi/panchang/{c}/", "daily", "0.7", today) for c in sd.PANCHANG_CITIES]
        elif kind == "content":
            from accounts import seo_data as sd
            from accounts.seo_views import FESTIVAL_YEARS

            rows += [("/festivals/", "weekly", "0.8", None), ("/katha/", "monthly", "0.7", None), ("/gita-shlok/", "monthly", "0.7", None)]
            rows += [(f"/festivals/{f['slug']}/", "monthly", "0.6", None) for f in sd.festivals() if f["year"] in FESTIVAL_YEARS]
            rows += [(f"/katha/{k}/", "monthly", "0.6", None) for k in sd.katha()]
            rows += [(f"/gita-shlok/{g[0]}/", "monthly", "0.6", None) for g in sd.GITA]
    except Exception:
        logging.getLogger(__name__).exception("Sitemap section %s failed", kind)
    return rows


SITEMAP_KINDS = ("pages", "panchang", "content", "library", "pandit")


@require_GET
def sitemap_xml(request):
    root = _site_root(request)
    today = _today()
    body = "\n".join(
        f"  <sitemap><loc>{root}/sitemap-{k}.xml</loc><lastmod>{today}</lastmod></sitemap>" for k in SITEMAP_KINDS
    )
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "\n</sitemapindex>\n"
    response = HttpResponse(xml, content_type="application/xml; charset=utf-8")
    response["Cache-Control"] = "public, max-age=3600"
    return response


@require_GET
def sitemap_section(request, kind: str):
    if kind not in SITEMAP_KINDS:
        from django.http import Http404

        raise Http404("Unknown sitemap")
    return _urlset(_site_root(request), _sitemap_rows(kind))


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
