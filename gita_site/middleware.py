"""Extra security headers that Django's SecurityMiddleware does not set."""


class SecurityHeadersMiddleware:
    """Adds a conservative CSP (only directives that cannot break the site's inline scripts or CDNs) and a
    Permissions-Policy that switches off powerful browser features the site never uses."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        # Follow whatever framing policy the view chose (the PDF proxy is framed by the reader, same origin only).
        framing = "'self'" if response.headers.get("X-Frame-Options", "").upper() == "SAMEORIGIN" else "'none'"
        response.headers.setdefault(
            "Content-Security-Policy",
            f"frame-ancestors {framing}; base-uri 'self'; object-src 'none'",
        )
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), payment=(), usb=(), accelerometer=(), gyroscope=(), "
            "geolocation=(self), interest-cohort=()",
        )
        return response


class AdminLoginThrottleMiddleware:
    """Django's admin login form has no brute-force protection of its own: cap password attempts per IP."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "POST" and request.path.rstrip("/") == "/admin/login":
            from django.http import HttpResponse

            from core.ratelimit import client_ip, hit

            if not hit("admin_login", client_ip(request), 10, 900):
                return HttpResponse("Too many login attempts. Try again in a few minutes.", status=429, content_type="text/plain")
        return self.get_response(request)
