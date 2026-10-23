from django.apps import AppConfig


class PersonalizationConfig(AppConfig):
    default_auto_field = 'django_mongodb_backend.fields.ObjectIdAutoField'
    name = 'personalization'
