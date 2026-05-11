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
    DEBUG=(bool, True),
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


DEBUG = env.bool("DEBUG", default=True)

default_secret = "dev-only-secret-key-change-this" if DEBUG else ""
SECRET_KEY = env("SECRET_KEY", default=default_secret).strip()
if not SECRET_KEY:
    raise ImproperlyConfigured("SECRET_KEY must be set when DEBUG is False.")

ALLOWED_HOSTS = csv_env(
    "ALLOWED_HOSTS",
    "localhost,127.0.0.1,[::1],0.0.0.0,testserver",
)
CSRF_TRUSTED_ORIGINS = csv_env(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000,http://localhost:8080,http://127.0.0.1:8080",
)

SOCIAL_AUTH_ENABLED = find_spec("social_django") is not None

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
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
    INSTALLED_APPS.extend(["cloudinary", "cloudinary_storage"])

if SOCIAL_AUTH_ENABLED:
    INSTALLED_APPS.append("social_django")

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


def build_database_config() -> dict:
    database_url = env("DATABASE_URL", default="").strip()
    if database_url:
        config = env.db("DATABASE_URL")
    else:
        use_sqlite_default = DEBUG
        use_sqlite_env = env("USE_SQLITE", default="")
        use_sqlite = (
            use_sqlite_default
            if use_sqlite_env == ""
            else env.bool("USE_SQLITE", default=use_sqlite_default)
        )

        connection_name = env("INSTANCE_CONNECTION_NAME", default="").strip()
        db_host = env("DB_HOST", default="").strip()
        if not db_host and connection_name:
            db_host = f"/cloudsql/{connection_name}"

        if use_sqlite:
            sqlite_name = env("SQLITE_PATH", default=str(BASE_DIR / "db.sqlite3"))
            config = {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": sqlite_name,
            }
        else:
            required = {
                "DB_NAME": env("DB_NAME", default="").strip(),
                "DB_USER": env("DB_USER", default="").strip(),
                "DB_PASSWORD": env("DB_PASSWORD", default="").strip(),
                "DB_HOST": db_host,
                "DB_PORT": env("DB_PORT", default="5432").strip(),
            }
            missing = [key for key, value in required.items() if not value]
            if missing:
                raise ImproperlyConfigured(
                    "PostgreSQL configuration is incomplete. Missing: " + ", ".join(missing)
                )

            config = {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": required["DB_NAME"],
                "USER": required["DB_USER"],
                "PASSWORD": required["DB_PASSWORD"],
                "HOST": required["DB_HOST"],
                "PORT": required["DB_PORT"],
            }
            sslmode = env("DB_SSLMODE", default="").strip()
            if sslmode:
                config["OPTIONS"] = {"sslmode": sslmode}

    config["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=600 if not DEBUG else 0)
    config["CONN_HEALTH_CHECKS"] = env.bool("DB_CONN_HEALTH_CHECKS", default=not DEBUG)
    return config


DATABASES = {"default": build_database_config()}

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
        "social_core.pipeline.user.get_username",
        "social_core.pipeline.user.create_user",
        "social_core.pipeline.social_auth.associate_user",
        "social_core.pipeline.social_auth.load_extra_data",
        "social_core.pipeline.user.user_details",
        "accounts.pipeline.record_social_login",
    )

    SOCIAL_AUTH_REDIRECT_IS_HTTPS = not DEBUG
    SOCIAL_AUTH_URL_NAMESPACE = "social"

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
STATICFILES_STORAGE = env(
    "DJANGO_STATICFILES_STORAGE",
    default=(
        "whitenoise.storage.CompressedStaticFilesStorage"
        if DEBUG
        else "whitenoise.storage.CompressedManifestStaticFilesStorage"
    ),
)
WHITENOISE_MAX_AGE = env.int("WHITENOISE_MAX_AGE", default=31536000 if not DEBUG else 0)
WHITENOISE_AUTOREFRESH = DEBUG
WHITENOISE_USE_FINDERS = DEBUG

MEDIA_URL = env("MEDIA_URL", default="/media/")
MEDIA_ROOT = BASE_DIR / env("MEDIA_ROOT", default="media")

if CLOUDINARY_STORAGE_ENABLED:
    DEFAULT_FILE_STORAGE = "cloudinary_storage.storage.MediaCloudinaryStorage"

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

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
}

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = env.bool("USE_X_FORWARDED_HOST", default=not DEBUG)
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=not DEBUG)
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=not DEBUG)
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000 if not DEBUG else 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool(
    "SECURE_HSTS_INCLUDE_SUBDOMAINS", default=not DEBUG
)
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = env("X_FRAME_OPTIONS", default="DENY")

if "test" in sys.argv:
    STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"
