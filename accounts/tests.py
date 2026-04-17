import uuid

from django.contrib.auth.models import User
from django.test import TestCase

from accounts.models import GuestProfile
from accounts.services import merge_guest_into_user
from astrology.models import SavedPanchaangPreference
from personalization.models import Bookmark, ReadingProgress


class GuestMergeTests(TestCase):
    def test_merge_guest_into_user_moves_bookmarks_progress_and_panchaang(self):
        user = User.objects.create_user(username='merge-user', password='pass')
        guest = GuestProfile.objects.create(guest_uuid=uuid.uuid4(), preferred_language='hi', preferred_location_name='Varanasi')
        Bookmark.objects.create(guest_profile=guest, content_type='library_book', object_id='42')
        ReadingProgress.objects.create(guest_profile=guest, content_type='book', object_id='42', progress_percent=64)
        SavedPanchaangPreference.objects.create(guest_profile=guest, city_name='Varanasi', latitude=25.3176, longitude=82.9739)

        summary = merge_guest_into_user(guest, user)

        self.assertTrue(summary['merged'])
        self.assertEqual(Bookmark.objects.filter(user=user, object_id='42').count(), 1)
        self.assertEqual(ReadingProgress.objects.filter(user=user, object_id='42').count(), 1)
        self.assertEqual(SavedPanchaangPreference.objects.filter(user=user, city_name='Varanasi').count(), 1)
        guest.refresh_from_db()
        self.assertFalse(guest.is_active)
        self.assertEqual(guest.merged_into_user, user)
