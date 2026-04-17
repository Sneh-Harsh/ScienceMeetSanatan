from rest_framework import serializers

from .models import LibraryItem, ShelfItem, UserLibraryShelf


class LibraryItemCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = LibraryItem
        fields = ['id', 'item_type', 'title', 'slug', 'subtitle', 'description', 'language', 'category', 'subcategory', 'tags', 'deity_tags', 'astrology_tags', 'difficulty_level', 'duration_seconds', 'total_units', 'cover_image', 'is_featured']


class ShelfItemSerializer(serializers.ModelSerializer):
    library_item = LibraryItemCardSerializer(read_only=True)

    class Meta:
        model = ShelfItem
        fields = ['id', 'library_item', 'added_at']


class UserLibraryShelfSerializer(serializers.ModelSerializer):
    items = ShelfItemSerializer(many=True, read_only=True)

    class Meta:
        model = UserLibraryShelf
        exclude = ['user']
