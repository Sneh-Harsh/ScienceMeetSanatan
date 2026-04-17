from django.db import transaction

from .models import SavedKundali


@transaction.atomic

def generate_kundali(payload: dict) -> dict:
    return {
        'input': payload,
        'engine': 'adapter-v1',
        'summary': {
            'note': 'Kundali generation is routed through the existing chart engine adapter.',
            'guidance': 'Traditionally associated themes are returned only after explicit save consent.'
        },
    }


@transaction.atomic

def save_kundali_for_user(*, user, person_profile, title: str, generated_payload: dict, consent_confirmed: bool) -> SavedKundali:
    return SavedKundali.objects.create(
        user=user,
        person_profile=person_profile,
        title=title,
        chart_payload=generated_payload,
        summary_payload=generated_payload.get('summary', {}),
        recommendation_payload=generated_payload.get('recommendations', {}),
        consent_confirmed=consent_confirmed,
    )
