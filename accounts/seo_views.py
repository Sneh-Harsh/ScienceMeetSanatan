"""Server-rendered, crawlable landing pages: city Panchang (English + Hindi), festivals, vrat katha, Gita shlokas."""
from __future__ import annotations

from django.http import Http404
from django.shortcuts import render
from django.views.decorators.http import require_GET

from . import seo_data as sd

FESTIVAL_YEARS = (2026, 2027)


def _cities():
    return [(k, v[0], v[1]) for k, v in sd.PANCHANG_CITIES.items()]


@require_GET
def panchang_city(request, city: str, lang: str = "en"):
    if city not in sd.PANCHANG_CITIES:
        raise Http404("Unknown city")
    data = sd.city_panchang(city)
    upcoming = [f for f in sd.festivals() if f["year"] in FESTIVAL_YEARS and f["date"] >= data["day"].isoformat()][:8]
    return render(request, "seo/panchang_city.html", {
        "p": data, "lang": lang, "city_key": city, "cities": _cities(), "upcoming": upcoming,
        "tithi_hi": sd.hi(sd.TITHI_HI, data["tithi"]), "nak_hi": sd.hi(sd.NAKSHATRA_HI, data["nakshatra"]),
        "paksha_hi": sd.hi(sd.PAKSHA_HI, data["paksha"]), "month_hi": sd.hi(sd.MONTH_HI, data["month"]),
    })


@require_GET
def panchang_city_hi(request, city: str):
    return panchang_city(request, city, lang="hi")


@require_GET
def festival_index(request):
    rows = [f for f in sd.festivals() if f["year"] in FESTIVAL_YEARS]
    return render(request, "seo/festival_index.html", {"festivals": rows, "years": FESTIVAL_YEARS})


@require_GET
def festival_detail(request, slug: str):
    f = sd.festival(slug)
    if not f or f["year"] not in FESTIVAL_YEARS:
        raise Http404("Unknown festival")
    related = [x for x in sd.festivals() if x["year"] == f["year"] and x["slug"] != slug and x["date"] > f["date"]][:6]
    puja = sd.puja_for_festival(f["name"])
    return render(request, "seo/festival_detail.html", {"f": f, "related": related, "puja": puja})


@require_GET
def festival_ics(request, slug: str):
    """Add-to-calendar file for one festival (all-day event)."""
    from datetime import date, timedelta

    from django.http import HttpResponse

    f = sd.festival(slug)
    if not f or f["year"] not in FESTIVAL_YEARS:
        raise Http404("Unknown festival")
    start = date.fromisoformat(f["date"])
    end = date.fromisoformat(f["endDate"]) if f.get("endDate") else start
    desc = f"{f['paksha']} {f['tithi']}, {f['month']} month. Dates are for Patna; confirm the muhurat with your pandit."
    body = "\r\n".join([
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SanatanSeva//Festivals//EN", "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT", f"UID:{slug}@sanatanseva", f"DTSTAMP:{date.today():%Y%m%d}T000000Z",
        f"DTSTART;VALUE=DATE:{start:%Y%m%d}", f"DTEND;VALUE=DATE:{end + timedelta(days=1):%Y%m%d}",
        f"SUMMARY:{f['name']} {f['year']}", f"DESCRIPTION:{desc}",
        "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", f"DESCRIPTION:{f['name']} is tomorrow", "END:VALARM",
        "END:VEVENT", "END:VCALENDAR", "",
    ])
    response = HttpResponse(body, content_type="text/calendar; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{slug}.ics"'
    return response


@require_GET
def katha_index(request):
    return render(request, "seo/katha_index.html", {"kathas": list(sd.katha().values())})


@require_GET
def katha_detail(request, katha_id: str):
    k = sd.katha().get(katha_id)
    if not k:
        raise Http404("Unknown katha")
    return render(request, "seo/katha_detail.html", {"k": k, "others": [x for x in sd.katha().values() if x["id"] != katha_id]})


@require_GET
def gita_index(request):
    return render(request, "seo/gita_index.html", {"shlokas": sd.GITA})


@require_GET
def gita_detail(request, ref: str):
    row = next((g for g in sd.GITA if g[0] == ref), None)
    if not row:
        raise Http404("Unknown shloka")
    return render(request, "seo/gita_detail.html", {"s": row, "others": [g for g in sd.GITA if g[0] != ref][:6]})
