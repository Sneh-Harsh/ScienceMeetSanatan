from typing import Dict, List

from .models import SavedKundali, SavedPanchaangPreference


def get_today_panchaang(actor) -> Dict:
    pref = SavedPanchaangPreference.objects.filter(user=actor.user).first() if actor.user else SavedPanchaangPreference.objects.filter(guest_profile=actor.guest_profile).first()
    return {
        'city_name': getattr(pref, 'city_name', 'Your location'),
        'preferred_sections': getattr(pref, 'preferred_sections', ['tithi', 'nakshatra', 'sunrise']),
        'guidance': 'Today may be helpful for reflection, discipline, and steady action.'
    }


def get_saved_kundalis(user) -> List[SavedKundali]:
    return list(SavedKundali.objects.filter(user=user).select_related('person_profile'))
