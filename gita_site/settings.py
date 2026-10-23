import os
import sys
from importlib.util import find_spec
from pathlib import Path
from urllib.parse import urlparse

from django.core.exceptions import ImproperlyConfigured

try:
    import environ
except ImportError:  # pragma: no cover - fallback for local environments before dependency install
    class _FallbackEnv:
        def __init__(self, **schema):
            self.schema = schema

        @staticmethod
        def read_env(path):
            env_path = Path(path)
            if not env_path.exists():
                return
            for raw_line in env_path.read_text().splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip("'").strip('"'))

        def __call__(self, name, default=None):
            return os.getenv(name, default)

        def bool(self, name, default=False):
            value = os.getenv(name)
            if value is None or value == "":
                return default
            return str(value).strip().lower() in {"1", "true", "yes", "on"}

        def int(self, name, default=0):
            value = os.getenv(name)
            return int(value) if value not in (None, "") else default

        def float(self, name, default=0.0):
            value = os.getenv(name)
            return float(value) if value not in (None, "") else default

        def db(self, name):
            value = os.getenv(name, "").strip()
            if not value:
                raise ImproperlyConfigured(f"{name} is not set.")
            parsed = urlparse(value)
            engine_map = {
                "postgres": "django.db.backends.postgresql",
                "postgresql": "django.db.backends.postgresql",
                "pgsql": "django.db.backends.postgresql",
                "sqlite": "django.db.backends.sqlite3",
            }
            engine = engine_map.get(parsed.scheme)
            if not engine:
                raise ImproperlyConfigured(f"Unsupported database scheme in {name}: {parsed.scheme}")
            if engine == "django.db.backends.sqlite3":
                return {"ENGINE": engine, "NAME": parsed.path or value.replace("sqlite:///", "")}
            return {
                "ENGINE": engine,
                "NAME": parsed.path.lstrip("/"),
                "USER": parsed.username or "",
                "PASSWORD": parsed.password or "",
                "HOST": parsed.hostname or "",
                "PORT": str(parsed.port or "5432"),
            }

    class _EnvironModule:
        Env = _FallbackEnv

    environ = _EnvironModule()

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    USE_SQLITE=(bool, None),
    SECURE_SSL_REDIRECT=(bool, False),
    SESSION_COOKIE_SECURE=(bool, False),
    CSRF_COOKIE_SECURE=(bool, False),
    SECURE_HSTS_SECONDS=(int, 0),
    SECURE_HSTS_INCLUDE_SUBDOMAINS=(bool, False),
    SECURE_HSTS_PRELOAD=(bool, False),
    CLOUDINARY_STORAGE_ENABLED=(bool, False),
)
environ.Env.read_env(BASE_DIR / ".env")


def csv_env(name: str, default: str = "") -> list[str]:
    value = env(name, default=default)
    return [item.strip() for item in str(value).split(",") if item.strip()]


DEBUG = env.bool("DEBUG", default=False)

default_secret = "dev-only-secret-key-change-this" if DEBUG else ""
SECRET_KEY = env("SECRET_KEY", default=default_secret).strip()
if not SECRET_KEY:
    raise ImproperlyConfigured("SECRET_KEY must be set when DEBUG is False.")
if not DEBUG and SECRET_KEY in {"change-me", "dev-only-secret-key-change-this"}:
    raise ImproperlyConfigured("SECRET_KEY must be a unique random value when DEBUG is False.")

ALLOWED_HOSTS = csv_env(
    "ALLOWED_HOSTS",
    "localhost,127.0.0.1,[::1],0.0.0.0,testserver",
)
CSRF_TRUSTED_ORIGINS = csv_env(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000,http://localhost:8080,http://127.0.0.1:8080",
)

# Vercel sets VERCEL=1 and exposes the deployment hostnames without a scheme.
ON_VERCEL = env.bool("VERCEL", default=False)
if ON_VERCEL:
    ALLOWED_HOSTS += [".vercel.app"]
    for _host in (os.getenv("VERCEL_URL"), os.getenv("VERCEL_PROJECT_PRODUCTION_URL")):
        if _host:
            ALLOWED_HOSTS.append(_host)
            CSRF_TRUSTED_ORIGINS.append(f"https://{_host}")

SOCIAL_AUTH_ENABLED = find_spec("social_django") is not None

INSTALLED_APPS = [
    "gita_site.mongo_apps.MongoAdminConfig",
    "gita_site.mongo_apps.MongoAuthConfig",
    "gita_site.mongo_apps.MongoContentTypesConfig",
    "django_mongodb_backend",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "core",
    "accounts",
    "personalization",
    "library",
    "astrology",
    "quizzes",
    "dashboard",
    "astrology_consultation",
    "pandit",
    "panchang",
    "kundali",
]

CLOUDINARY_STORAGE_ENABLED = env.bool("CLOUDINARY_STORAGE_ENABLED", default=False)
if CLOUDINARY_STORAGE_ENABLED:
    if not find_spec("cloudinary_storage"):
        raise ImproperlyConfigured(
            "CLOUDINARY_STORAGE_ENABLED is True but django-cloudinary-storage is not installed."
        )
    if not os.environ.get("CLOUDINARY_URL"):
        raise ImproperlyConfigured(
            "CLOUDINARY_STORAGE_ENABLED is True but CLOUDINARY_URL is not set "
            "(format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME)."
        )
    INSTALLED_APPS.extend(["cloudinary", "cloudinary_storage"])

if SOCIAL_AUTH_ENABLED:
    INSTALLED_APPS.append("gita_site.mongo_apps.MongoSocialDjangoConfig")

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "gita_site.urls"

context_processors = [
    "django.template.context_processors.request",
    "django.contrib.auth.context_processors.auth",
    "django.contrib.messages.context_processors.messages",
    "core.context_processors.donation_context",
]

if SOCIAL_AUTH_ENABLED:
    context_processors.extend(
        [
            "social_django.context_processors.backends",
            "social_django.context_processors.login_redirect",
        ]
    )

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "accounts" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": context_processors,
            "builtins": ["django.templatetags.static"],
        },
    },
]

WSGI_APPLICATION = "gita_site.wsgi.application"


MONGODB_URI = env("MONGODB_URI", default="").strip()
MONGODB_DB_NAME = env("MONGODB_DB_NAME", default="sms_website").strip()
if not MONGODB_URI:
    raise ImproperlyConfigured(
        "MONGODB_URI is not set. Add your MongoDB connection string to .env "
        "(see .env.example)."
    )

DATABASES = {
    "default": {
        "ENGINE": "django_mongodb_backend",
        "HOST": MONGODB_URI,
        "NAME": MONGODB_DB_NAME,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTHENTICATION_BACKENDS = ["django.contrib.auth.backends.ModelBackend"]

SOCIAL_AUTH_GOOGLE_OAUTH2_KEY = env("SOCIAL_AUTH_GOOGLE_OAUTH2_KEY", default="").strip()
SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET = env("SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET", default="").strip()
GOOGLE_OAUTH_CONFIGURED = bool(
    SOCIAL_AUTH_GOOGLE_OAUTH2_KEY and SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET
)

SOCIAL_AUTH_APPLE_ID_CLIENT = env("SOCIAL_AUTH_APPLE_ID_CLIENT", default="").strip()
SOCIAL_AUTH_APPLE_ID_TEAM = env("SOCIAL_AUTH_APPLE_ID_TEAM", default="").strip()
SOCIAL_AUTH_APPLE_ID_KEY = env("SOCIAL_AUTH_APPLE_ID_KEY", default="").strip()
SOCIAL_AUTH_APPLE_ID_SECRET = (
    env("SOCIAL_AUTH_APPLE_ID_SECRET", default="").replace("\\n", "\n").strip()
)
APPLE_OAUTH_CONFIGURED = bool(
    SOCIAL_AUTH_APPLE_ID_CLIENT
    and SOCIAL_AUTH_APPLE_ID_TEAM
    and SOCIAL_AUTH_APPLE_ID_KEY
    and SOCIAL_AUTH_APPLE_ID_SECRET
)

if SOCIAL_AUTH_ENABLED:
    AUTHENTICATION_BACKENDS = [
        "social_core.backends.google.GoogleOAuth2",
        "social_core.backends.apple.AppleIdAuth",
        "django.contrib.auth.backends.ModelBackend",
    ]

    SOCIAL_AUTH_PIPELINE = (
        "social_core.pipeline.social_auth.social_details",
        "accounts.pipeline.set_social_username_and_fields",
        "social_core.pipeline.social_auth.social_uid",
        "social_core.pipeline.social_auth.auth_allowed",
        "social_core.pipeline.social_auth.social_user",
        "social_core.pipeline.social_auth.associate_by_email",
        "social_core.pipeline.user.get_username",
        "social_core.pipeline.user.create_user",
        "social_core.pipeline.social_auth.associate_user",
        "social_core.pipeline.social_auth.load_extra_data",
        "social_core.pipeline.user.user_details",
        "accounts.pipeline.record_social_login",
    )

    SOCIAL_AUTH_REDIRECT_IS_HTTPS = not DEBUG
    SOCIAL_AUTH_URL_NAMESPACE = "social"
    SOCIAL_AUTH_LOGIN_ERROR_URL = "/login/?mode=login"
    SOCIAL_AUTH_LOGIN_REDIRECT_URL = "/welcome/"
    SOCIAL_AUTH_NEW_USER_REDIRECT_URL = "/welcome/"

LOGIN_URL = "/login/"
LOGIN_REDIRECT_URL = "/welcome/"
LOGOUT_REDIRECT_URL = "/"

LANGUAGE_CODE = env("LANGUAGE_CODE", default="en-us")
TIME_ZONE = env("TIME_ZONE", default="UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = env("STATIC_URL", default="/static/")
STATIC_ROOT = BASE_DIR / env("STATIC_ROOT", default="staticfiles")
STATICFILES_DIRS = [BASE_DIR / "accounts" / "static"]
# Vercel has no collectstatic step, so WhiteNoise serves straight from the static dir there.
_static_backend = env(
    "DJANGO_STATICFILES_STORAGE",
    default=(
        "whitenoise.storage.CompressedStaticFilesStorage"
        if DEBUG or ON_VERCEL or "test" in sys.argv
        else "whitenoise.storage.CompressedManifestStaticFilesStorage"
    ),
)
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": _static_backend},
}
WHITENOISE_MAX_AGE = env.int("WHITENOISE_MAX_AGE", default=31536000 if not DEBUG else 0)
WHITENOISE_AUTOREFRESH = DEBUG
WHITENOISE_USE_FINDERS = DEBUG or ON_VERCEL

MEDIA_URL = env("MEDIA_URL", default="/media/")
MEDIA_ROOT = BASE_DIR / env("MEDIA_ROOT", default="media")

if CLOUDINARY_STORAGE_ENABLED:
    STORAGES["default"] = {"BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage"}

EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default=EMAIL_HOST_USER or "noreply@sms-website.local")
PASSWORD_RESET_TIMEOUT = 3600

# Placeholder wallet top-up (no payment). Keep off in production.
WALLET_DEV_RECHARGE_ENABLED = env.bool("WALLET_DEV_RECHARGE_ENABLED", default=DEBUG)

DONATION_UPI_ID = env("DONATION_UPI_ID", default="9742024751@ybl").strip()
DONATION_PAYEE_NAME = env("DONATION_PAYEE_NAME", default="Sneh Harsh").strip()
DONATION_QR_URL = env("DONATION_QR_URL", default="").strip()

LIBRARY_DRIVE_FILE_ID = env("LIBRARY_DRIVE_FILE_ID", default="").strip()
LIBRARY_DRIVE_URL = env(
    "LIBRARY_DRIVE_URL",
    default="https://drive.google.com/drive/u/2/folders/1SaUZXKxTmmWZu-ziN4HSHK4RfUHrcyoK",
).strip()
LIBRARY_CACHE_SECONDS = env.int("LIBRARY_CACHE_SECONDS", default=900)
LIBRARY_FETCH_TIMEOUT = env.float("LIBRARY_FETCH_TIMEOUT", default=12)

OPENAI_API_KEY = env("OPENAI_API_KEY", default="").strip()

CACHES = {
    "default": {
        "BACKEND": "core.cache.MongoDBCache",
        "LOCATION": "sms_cache",
    }
}

DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"

MIGRATION_MODULES = {
    "admin": "gita_site.mongo_migrations.admin",
    "auth": "gita_site.mongo_migrations.auth",
    "contenttypes": "gita_site.mongo_migrations.contenttypes",
    "social_django": "gita_site.mongo_migrations.social_django",
}

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "core.rest.MongoJSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
}

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = env.bool("USE_X_FORWARDED_HOST", default=not DEBUG)
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=not DEBUG and "test" not in sys.argv)
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=not DEBUG)
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000 if not DEBUG else 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool(
    "SECURE_HSTS_INCLUDE_SUBDOMAINS", default=not DEBUG
)
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = env("X_FRAME_OPTIONS", default="DENY")

