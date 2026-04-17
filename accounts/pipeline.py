from django.contrib.auth.models import User

from .models import LoginAttempt
from .services import ensure_user_account


def set_social_username_and_fields(backend, details, *args, **kwargs):
    email = (details.get('email') or '').strip().lower()

    if not email or '@' not in email:
        return

    local_part = email.split('@', 1)[0]
    base_username = (local_part[:6] or 'userxx').lower()

    username = base_username
    suffix = 1
    while User.objects.filter(username=username).exists():
        username = f'{base_username}{suffix}'
        suffix += 1

    details['username'] = username
    details['first_name'] = ''
    details['last_name'] = ''
    details['fullname'] = ''
    details['email'] = email


def record_social_login(backend, user=None, details=None, *args, **kwargs):
    if user is None:
        return

    ensure_user_account(user)

    provider = LoginAttempt.PROVIDER_GOOGLE
    backend_name = getattr(backend, 'name', '')
    if 'apple' in backend_name:
        provider = LoginAttempt.PROVIDER_APPLE

    email = ''
    if details:
        email = details.get('email', '') or ''

    LoginAttempt.objects.create(
        username=(user.username or email or 'social-user'),
        provider=provider,
        success=True,
    )
