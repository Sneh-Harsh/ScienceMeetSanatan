import os
from importlib.util import find_spec
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'dev-only-secret-key-change-this'
DEBUG = True
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,[::1],0.0.0.0").split(",") if h.strip()]

SOCIAL_AUTH_ENABLED = find_spec('social_django') is not None

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'accounts',
    'panchang',
    'kundali',
]

if SOCIAL_AUTH_ENABLED:
    INSTALLED_APPS.append('social_django')

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'gita_site.urls'

context_processors = [
    'django.template.context_processors.request',
    'django.contrib.auth.context_processors.auth',
    'django.contrib.messages.context_processors.messages',
]

if SOCIAL_AUTH_ENABLED:
    context_processors.extend(
        [
            'social_django.context_processors.backends',
            'social_django.context_processors.login_redirect',
        ]
    )

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'accounts' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': context_processors,
            'builtins': ['django.templatetags.static'],
        },
    },
]

WSGI_APPLICATION = 'gita_site.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTHENTICATION_BACKENDS = ['django.contrib.auth.backends.ModelBackend']

SOCIAL_AUTH_GOOGLE_OAUTH2_KEY = os.getenv('SOCIAL_AUTH_GOOGLE_OAUTH2_KEY', '').strip()
SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET = os.getenv('SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET', '').strip()
GOOGLE_OAUTH_CONFIGURED = bool(SOCIAL_AUTH_GOOGLE_OAUTH2_KEY and SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET)

SOCIAL_AUTH_APPLE_ID_CLIENT = os.getenv('SOCIAL_AUTH_APPLE_ID_CLIENT', '').strip()
SOCIAL_AUTH_APPLE_ID_TEAM = os.getenv('SOCIAL_AUTH_APPLE_ID_TEAM', '').strip()
SOCIAL_AUTH_APPLE_ID_KEY = os.getenv('SOCIAL_AUTH_APPLE_ID_KEY', '').strip()
SOCIAL_AUTH_APPLE_ID_SECRET = os.getenv('SOCIAL_AUTH_APPLE_ID_SECRET', '').replace('\\n', '\n').strip()
APPLE_OAUTH_CONFIGURED = bool(
    SOCIAL_AUTH_APPLE_ID_CLIENT
    and SOCIAL_AUTH_APPLE_ID_TEAM
    and SOCIAL_AUTH_APPLE_ID_KEY
    and SOCIAL_AUTH_APPLE_ID_SECRET
)

if SOCIAL_AUTH_ENABLED:
    AUTHENTICATION_BACKENDS = [
        'social_core.backends.google.GoogleOAuth2',
        'social_core.backends.apple.AppleIdAuth',
        'django.contrib.auth.backends.ModelBackend',
    ]

    SOCIAL_AUTH_PIPELINE = (
        'social_core.pipeline.social_auth.social_details',
        'accounts.pipeline.set_social_username_and_fields',
        'social_core.pipeline.social_auth.social_uid',
        'social_core.pipeline.social_auth.auth_allowed',
        'social_core.pipeline.social_auth.social_user',
        'social_core.pipeline.user.get_username',
        'social_core.pipeline.user.create_user',
        'social_core.pipeline.social_auth.associate_user',
        'social_core.pipeline.social_auth.load_extra_data',
        'social_core.pipeline.user.user_details',
        'accounts.pipeline.record_social_login',
    )

    SOCIAL_AUTH_REDIRECT_IS_HTTPS = False
    SOCIAL_AUTH_URL_NAMESPACE = 'social'

LOGIN_URL = '/'
LOGIN_REDIRECT_URL = '/welcome/'
LOGOUT_REDIRECT_URL = '/'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'accounts' / 'static']

LIBRARY_DRIVE_FILE_ID = os.getenv('LIBRARY_DRIVE_FILE_ID', '').strip()
LIBRARY_DRIVE_URL = os.getenv(
    'LIBRARY_DRIVE_URL',
    'https://drive.google.com/drive/u/2/folders/1SaUZXKxTmmWZu-ziN4HSHK4RfUHrcyoK',
).strip()
LIBRARY_CACHE_SECONDS = int(os.getenv('LIBRARY_CACHE_SECONDS', '900'))
LIBRARY_FETCH_TIMEOUT = float(os.getenv('LIBRARY_FETCH_TIMEOUT', '12'))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
