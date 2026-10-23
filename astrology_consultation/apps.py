from django.apps import AppConfig


class AstrologyConsultationConfig(AppConfig):
    default_auto_field = 'django_mongodb_backend.fields.ObjectIdAutoField'
    name = 'astrology_consultation'
    verbose_name = 'Astrology Consultation'
