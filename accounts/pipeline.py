import secrets

from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from social_core.pipeline.social_auth import associate_by_email as _associate_by_email

from .models import LoginAttempt
from .services import ensure_user_account


def set_social_username_and_fields(backend, details, *args, **kwargs):
    email = (details.get('email') or '').strip().lower()

    if not email or '@' not in email:
        return

    # Usernames are public (leaderboard, reviews): never derive them from the email address.
    base_username = 'seeker' + secrets.token_hex(2)

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


from social_core.exceptions import AuthCanceled, AuthForbidden
from social_django.middleware import SocialAuthExceptionMiddleware


class FriendlySocialAuthMiddleware(SocialAuthExceptionMiddleware):
    """Send failed Google/Apple sign-ins back to the login page with a clear message instead of an error page."""

    def get_message(self, request, exception):
        if isinstance(exception, AuthCanceled):
            return 'Google sign-in was cancelled or denied. If you did not cancel, the Google app may still be in testing mode and your account has not been added as a test user.'
        if isinstance(exception, AuthForbidden):
            return 'This Google account is not allowed to sign in.'
        return 'Google sign-in failed. Please try again or use your username and password.'

    def raise_exception(self, request, exception):
        return False


def associate_by_email_safely(backend, details, user=None, *args, **kwargs):
    """Link a Google/Apple login to an existing account with the same email, without enabling pre-hijacking.

    Password sign-up does not verify the email, so an attacker could register victim@example.com with a password they
    know and wait for the real owner to sign in with Google. When the provider vouches for the email and it matches an
    existing account, that account's password is therefore switched off (the owner can set a new one through "forgot
    password") and its other sessions are ended."""
    result = _associate_by_email(backend, details, user, *args, **kwargs)
    linked = (result or {}).get('user')
    if linked is not None and user is None and linked.has_usable_password():
        linked.set_unusable_password()
        linked.save(update_fields=['password'])
        for session in Session.objects.all().iterator():
            try:
                if str(session.get_decoded().get('_auth_user_id')) == str(linked.pk):
                    session.delete()
            except Exception:
                continue
    return result
