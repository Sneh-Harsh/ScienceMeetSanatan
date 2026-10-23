from django.apps import AppConfig
from django.contrib.admin.apps import AdminConfig
from django.contrib.auth.apps import AuthConfig
from django.contrib.contenttypes.apps import ContentTypesConfig

MONGO_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"


class MongoAdminConfig(AdminConfig):
    default_auto_field = MONGO_AUTO_FIELD


class MongoAuthConfig(AuthConfig):
    default_auto_field = MONGO_AUTO_FIELD


class MongoContentTypesConfig(ContentTypesConfig):
    default_auto_field = MONGO_AUTO_FIELD


try:
    from social_django.apps import PythonSocialAuthConfig
except ImportError:  # pragma: no cover - social auth is optional
    PythonSocialAuthConfig = AppConfig


class MongoSocialDjangoConfig(PythonSocialAuthConfig):
    default_auto_field = MONGO_AUTO_FIELD
