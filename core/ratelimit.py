"""Small fixed-window rate limiter on top of the shared cache."""
from functools import wraps

from django.core.cache import cache
from django.http import JsonResponse
from rest_framework.response import Response


def client_ip(request) -> str:
    forwarded = (request.META.get('HTTP_X_FORWARDED_FOR') or '').split(',')[0].strip()
    return forwarded or request.META.get('REMOTE_ADDR') or 'unknown'


def hit(scope: str, ident: str, limit: int, window: int) -> bool:
    """Record one hit; return True while the caller is within the limit."""
    key = f'rl:{scope}:{ident}'
    if cache.add(key, 1, timeout=window):
        return True
    try:
        return cache.incr(key) <= limit
    except ValueError:
        cache.add(key, 1, timeout=window)
        return True


def rate_limited(scope: str, limit: int, window: int):
    """Decorator for plain Django and DRF function/method views."""

    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            request = args[0] if args and hasattr(args[0], 'META') else args[1]
            user = getattr(request, 'user', None)
            ident = f'u{user.pk}' if user is not None and user.is_authenticated else client_ip(request)
            if not hit(scope, ident, limit, window):
                payload = {'error': 'Too many requests. Please slow down and try again shortly.'}
                if hasattr(request, 'data'):
                    return Response(payload, status=429)
                return JsonResponse(payload, status=429)
            return view(*args, **kwargs)

        return wrapper

    return decorator
