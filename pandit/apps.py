from django.apps import AppConfig


class PanditConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "pandit"
    verbose_name = "Pandit Booking"
