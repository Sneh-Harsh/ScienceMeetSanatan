from django.db import models


class CacheEntry(models.Model):
    """Shared key/value store backing core.cache.MongoDBCache."""

    key = models.CharField(max_length=250, unique=True)
    value = models.JSONField(null=True, blank=True)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        app_label = 'core'
