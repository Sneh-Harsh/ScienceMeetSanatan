from django.contrib.auth.models import User
from django.db import models


class LibraryItem(models.Model):
    item_type = models.CharField(max_length=20)
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    subtitle = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    language = models.CharField(max_length=20, default='en')
    category = models.CharField(max_length=100)
    subcategory = models.CharField(max_length=100, blank=True)
    tags = models.JSONField(default=list, blank=True)
    deity_tags = models.JSONField(default=list, blank=True)
    astrology_tags = models.JSONField(default=list, blank=True)
    difficulty_level = models.CharField(max_length=30, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    total_units = models.PositiveIntegerField(null=True, blank=True)
    cover_image = models.URLField(blank=True)
    is_published = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['title']


class UserLibraryShelf(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='library_shelves')
    name = models.CharField(max_length=120)
    slug = models.SlugField()
    visibility = models.CharField(max_length=20, default='private')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('user', 'slug')]
        ordering = ['name']


class ShelfItem(models.Model):
    shelf = models.ForeignKey(UserLibraryShelf, on_delete=models.CASCADE, related_name='items')
    library_item = models.ForeignKey(LibraryItem, on_delete=models.CASCADE, related_name='shelf_links')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('shelf', 'library_item')]
        ordering = ['-added_at']
