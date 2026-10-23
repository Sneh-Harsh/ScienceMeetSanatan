"""Cloudinary uploads for user and admin supplied photos and videos.

The models keep storing plain URLs; this module turns an uploaded file into a
Cloudinary URL so the existing serializers and templates keep working.
"""
import os

from django import forms
from django.core.exceptions import ValidationError

IMAGE_MAX_BYTES = 5 * 1024 * 1024
VIDEO_MAX_BYTES = 50 * 1024 * 1024
IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
VIDEO_TYPES = {'video/mp4', 'video/quicktime', 'video/webm'}


class MediaUploadError(ValidationError):
    pass


def is_configured() -> bool:
    return bool(os.environ.get('CLOUDINARY_URL'))


def _sniff(upload) -> str:
    """Identify the file from its first bytes; the browser-supplied type is not trusted."""
    position = upload.tell() if hasattr(upload, 'tell') else 0
    head = upload.read(32)
    upload.seek(position)
    if head.startswith(b'\xff\xd8\xff') or head.startswith(b'\x89PNG\r\n\x1a\n') or head[:6] in (b'GIF87a', b'GIF89a'):
        return 'image'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'image'
    if head[4:8] == b'ftyp' or head[:4] == b'\x1a\x45\xdf\xa3':  # MP4/MOV or WebM/Matroska
        return 'video'
    return ''


def media_kind(upload) -> str:
    content_type = (getattr(upload, 'content_type', '') or '').lower()
    if content_type in IMAGE_TYPES:
        declared = 'image'
    elif content_type in VIDEO_TYPES:
        declared = 'video'
    else:
        raise MediaUploadError('Unsupported file type. Use JPG, PNG, WebP, GIF, MP4, MOV or WebM.')
    if _sniff(upload) != declared:
        raise MediaUploadError('That file does not look like a valid ' + declared + '.')
    return declared


def upload_media(upload, folder: str, allowed=('image',)) -> dict:
    """Upload a Django UploadedFile and return {'type', 'url', 'public_id'}."""
    if not is_configured():
        raise MediaUploadError('Media uploads are not configured (CLOUDINARY_URL is missing).')
    kind = media_kind(upload)
    if kind not in allowed:
        raise MediaUploadError(f'Only {" or ".join(allowed)} files are accepted here.')
    limit = IMAGE_MAX_BYTES if kind == 'image' else VIDEO_MAX_BYTES
    if upload.size > limit:
        raise MediaUploadError(f'File is too large (max {limit // (1024 * 1024)} MB for {kind}s).')

    import cloudinary.uploader

    try:
        result = cloudinary.uploader.upload(
            upload,
            folder=f'sms/{folder}',
            resource_type=kind,
            overwrite=False,
            unique_filename=True,
        )
    except Exception as exc:  # cloudinary raises its own error types
        raise MediaUploadError('Upload failed. Please try again.') from exc
    return {'type': kind, 'url': result['secure_url'], 'public_id': result['public_id']}


def delete_media(public_id: str, kind: str = 'image') -> None:
    if not public_id or not is_configured():
        return
    import cloudinary.uploader

    try:
        cloudinary.uploader.destroy(public_id, resource_type=kind)
    except Exception:
        pass


def upload_form(model, url_fields: dict, folder: str, fields='__all__'):
    """ModelForm that adds "<field>_upload" file inputs beside the URL fields.

    url_fields maps a model URL field name to the media kind it accepts.
    Uploading a file overwrites that URL with the Cloudinary one.
    """
    attrs = {}
    for name, kind in url_fields.items():
        accept = 'image/*' if kind == 'image' else 'image/*,video/*'
        attrs[f'{name}_upload'] = forms.FileField(
            required=False,
            label=f'Upload {name.replace("_", " ")}',
            help_text='Uploads to Cloudinary and replaces the URL above.',
            widget=forms.ClearableFileInput(attrs={'accept': accept}),
        )

    def clean(self):
        data = super(form, self).clean()
        for field, kind in url_fields.items():
            upload = data.get(f'{field}_upload')
            if not upload:
                continue
            try:
                data[field] = upload_media(upload, folder, allowed=(kind,))['url']
            except MediaUploadError as exc:
                self.add_error(f'{field}_upload', exc)
        return data

    meta = type('Meta', (), {'model': model, 'fields': fields})
    attrs.update({'Meta': meta, 'clean': clean})
    form = type(f'{model.__name__}UploadForm', (forms.ModelForm,), attrs)
    return form
