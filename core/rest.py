from bson import ObjectId
from rest_framework import serializers
from rest_framework.renderers import JSONRenderer
from rest_framework.utils.encoders import JSONEncoder


class MongoJSONEncoder(JSONEncoder):
    """DRF encoder that also serialises MongoDB ObjectId values as strings."""

    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)


class MongoJSONRenderer(JSONRenderer):
    encoder_class = MongoJSONEncoder


def register_object_id_serializer_fields():
    """Make ModelSerializer render ObjectId primary keys as strings, not integers."""
    from django_mongodb_backend.fields import ObjectIdAutoField, ObjectIdField

    mapping = serializers.ModelSerializer.serializer_field_mapping
    mapping[ObjectIdAutoField] = serializers.CharField
    mapping[ObjectIdField] = serializers.CharField
