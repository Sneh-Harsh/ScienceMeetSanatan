from __future__ import annotations

from django.conf import settings
from django.templatetags.static import static


def _page_type_from_path(path: str) -> str:
    lowered = (path or "").lower()
    if "/library" in lowered:
        return "library"
    if "/quizzes" in lowered or "/quiz" in lowered:
        return "quiz"
    if "/kundali" in lowered:
        return "kundali"
    if "/horoscope" in lowered:
        return "horoscope"
    if "/panchang" in lowered:
        return "panchang"
    return "general"


def donation_context(request):
    upi_id = str(getattr(settings, "DONATION_UPI_ID", "9742024751@ybl") or "9742024751@ybl").strip()
    payee_name = str(getattr(settings, "DONATION_PAYEE_NAME", "Sneh Harsh") or "Sneh Harsh").strip()
    qr_url = str(getattr(settings, "DONATION_QR_URL", "") or "").strip()
    if not qr_url:
        try:
            qr_url = static("images/donation-qr.jpg")
        except ValueError:
            qr_url = ""

    return {
        "donation_upi_id": upi_id,
        "donation_payee_name": payee_name,
        "donation_qr_url": qr_url,
        "donation_is_configured": bool(upi_id and payee_name and qr_url),
        "donation_page_type": _page_type_from_path(getattr(request, "path", "")),
    }
