from unittest import mock

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from accounts.models import UserAccount
from core.media import MediaUploadError, upload_media

FAKE = {'secure_url': 'https://res.cloudinary.com/x/image/upload/a.jpg', 'public_id': 'sms/avatars/a'}


@mock.patch.dict('os.environ', {'CLOUDINARY_URL': 'cloudinary://k:s@c'})
class MediaUploadTests(TestCase):
    def test_rejects_wrong_type(self):
        bad = SimpleUploadedFile('a.exe', b'x', content_type='application/octet-stream')
        with self.assertRaises(MediaUploadError):
            upload_media(bad, 'avatars')

    def test_rejects_video_where_only_image_allowed(self):
        vid = SimpleUploadedFile('a.mp4', b'x', content_type='video/mp4')
        with self.assertRaises(MediaUploadError):
            upload_media(vid, 'avatars')

    def test_rejects_oversize_image(self):
        big = SimpleUploadedFile('a.jpg', b'x' * (5 * 1024 * 1024 + 1), content_type='image/jpeg')
        with self.assertRaises(MediaUploadError):
            upload_media(big, 'avatars')

    @mock.patch('cloudinary.uploader.upload', return_value=FAKE)
    def test_avatar_endpoint_saves_url(self, upload):
        user = User.objects.create_user('u', 'u@example.com', 'pw-12345-x')
        self.client.force_login(user)
        img = SimpleUploadedFile('a.jpg', b'x', content_type='image/jpeg')
        response = self.client.post('/api/account/avatar/', {'file': img})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(UserAccount.objects.get(user=user).avatar, FAKE['secure_url'])
        self.assertEqual(upload.call_args.kwargs['folder'], 'sms/avatars')

    def test_avatar_endpoint_requires_login(self):
        img = SimpleUploadedFile('a.jpg', b'x', content_type='image/jpeg')
        self.assertIn(self.client.post('/api/account/avatar/', {'file': img}).status_code, (401, 403))
