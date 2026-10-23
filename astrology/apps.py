from django.apps import AppConfig


class AstrologyConfig(AppConfig):
    default_auto_field = 'django_mongodb_backend.fields.ObjectIdAutoField'
    name = 'astrology'
