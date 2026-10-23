from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django_mongodb_backend.fields.ObjectIdAutoField'
    name = 'core'

    def ready(self):
        from .rest import register_object_id_serializer_fields

        register_object_id_serializer_fields()
