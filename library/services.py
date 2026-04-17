from django.db import transaction
from django.utils.text import slugify

from .models import LibraryItem, ShelfItem, UserLibraryShelf


@transaction.atomic

def create_shelf(user, name: str, visibility: str = 'private') -> UserLibraryShelf:
    base_slug = slugify(name) or 'shelf'
    slug = base_slug
    index = 2
    while UserLibraryShelf.objects.filter(user=user, slug=slug).exists():
        slug = f'{base_slug}-{index}'
        index += 1
    return UserLibraryShelf.objects.create(user=user, name=name, slug=slug, visibility=visibility)


@transaction.atomic

def add_item_to_shelf(shelf: UserLibraryShelf, item: LibraryItem) -> ShelfItem:
    shelf_item, _ = ShelfItem.objects.get_or_create(shelf=shelf, library_item=item)
    return shelf_item
