from django.contrib import admin

from core.media import upload_form

from .models import LibraryItem, ShelfItem, UserLibraryShelf


@admin.register(LibraryItem)
class LibraryItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'item_type', 'language', 'category', 'is_published', 'is_featured')
    search_fields = ('title', 'slug', 'category', 'subcategory')
    list_filter = ('item_type', 'language', 'category', 'is_published', 'is_featured')
    form = upload_form(LibraryItem, {'cover_image': 'image'}, 'library')


@admin.register(UserLibraryShelf)
class UserLibraryShelfAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'visibility', 'updated_at')
    search_fields = ('name', 'user__username')


@admin.register(ShelfItem)
class ShelfItemAdmin(admin.ModelAdmin):
    list_display = ('shelf', 'library_item', 'added_at')
    search_fields = ('shelf__name', 'library_item__title')
