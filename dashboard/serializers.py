from rest_framework import serializers


class DashboardModuleSerializer(serializers.Serializer):
    key = serializers.CharField()
    title = serializers.CharField()
    subtitle = serializers.CharField(required=False, allow_blank=True)
    layout_type = serializers.CharField()
    priority = serializers.IntegerField()
    items = serializers.ListField(child=serializers.DictField(), default=list)
    cta = serializers.DictField(required=False)
    empty_state = serializers.DictField(required=False)
    analytics_payload = serializers.DictField(required=False)
