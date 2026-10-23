import random
import time
from datetime import datetime, timezone as dt_timezone

from django.core.cache.backends.base import DEFAULT_TIMEOUT, BaseCache
from django.db import IntegrityError, transaction
from django.db.models import F


class MongoDBCache(BaseCache):
    """
    Minimal cache backed by MongoDB so state is shared across processes and
    serverless instances. Values must be JSON serialisable.
    """

    CLEANUP_PROBABILITY = 0.02

    def __init__(self, location, params):
        super().__init__(params)

    @staticmethod
    def _model():
        from core.models.cache import CacheEntry

        return CacheEntry

    def _expiry(self, timeout):
        timeout = self.get_backend_timeout(timeout)
        if timeout is None:
            timeout = time.time() + 10 * 365 * 24 * 3600
        return datetime.fromtimestamp(timeout, tz=dt_timezone.utc)

    @staticmethod
    def _now():
        return datetime.now(tz=dt_timezone.utc)

    def _maybe_cleanup(self):
        if random.random() < self.CLEANUP_PROBABILITY:
            self._model().objects.filter(expires_at__lt=self._now()).delete()

    def _live(self, key):
        return self._model().objects.filter(key=key, expires_at__gt=self._now())

    def get(self, key, default=None, version=None):
        entry = self._live(self.make_and_validate_key(key, version)).first()
        return default if entry is None else entry.value

    def set(self, key, value, timeout=DEFAULT_TIMEOUT, version=None):
        key = self.make_and_validate_key(key, version)
        expires_at = self._expiry(timeout)
        model = self._model()
        updated = model.objects.filter(key=key).update(value=value, expires_at=expires_at)
        if not updated:
            try:
                with transaction.atomic():
                    model.objects.create(key=key, value=value, expires_at=expires_at)
            except IntegrityError:
                model.objects.filter(key=key).update(value=value, expires_at=expires_at)
        self._maybe_cleanup()

    def add(self, key, value, timeout=DEFAULT_TIMEOUT, version=None):
        key = self.make_and_validate_key(key, version)
        model = self._model()
        model.objects.filter(key=key, expires_at__lte=self._now()).delete()
        try:
            with transaction.atomic():
                model.objects.create(key=key, value=value, expires_at=self._expiry(timeout))
            return True
        except IntegrityError:
            return False

    def delete(self, key, version=None):
        deleted, _ = self._model().objects.filter(key=self.make_and_validate_key(key, version), expires_at__gt=self._now()).delete()
        return bool(deleted)

    def has_key(self, key, version=None):
        return self._live(self.make_and_validate_key(key, version)).exists()

    def incr(self, key, delta=1, version=None):
        key = self.make_and_validate_key(key, version)
        updated = self._live(key).update(value=F('value') + delta)
        if not updated:
            raise ValueError(f"Key '{key}' not found")
        return self._live(key).first().value

    def touch(self, key, timeout=DEFAULT_TIMEOUT, version=None):
        key = self.make_and_validate_key(key, version)
        return bool(self._live(key).update(expires_at=self._expiry(timeout)))

    def clear(self):
        self._model().objects.all().delete()
