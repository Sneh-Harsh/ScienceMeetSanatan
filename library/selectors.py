from typing import Dict, List

from core.utils.actors import Actor
from personalization.models import Bookmark, ReadingProgress

from .models import LibraryItem, UserLibraryShelf


def get_library_home(actor: Actor) -> Dict:
    featured = LibraryItem.objects.filter(is_published=True, is_featured=True)[:8]
    progress_filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
    bookmarks_filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
    return {
        'continue_reading': list(ReadingProgress.objects.filter(**progress_filters).values('content_type', 'object_id', 'progress_percent')[:6]),
        'bookmarks': list(Bookmark.objects.filter(**bookmarks_filters).values('content_type', 'object_id')[:12]),
        'trending': list(featured.values('id', 'title', 'slug', 'item_type', 'category')),
    }


def get_library_recommendations(actor: Actor) -> List[Dict]:
    items = LibraryItem.objects.filter(is_published=True).order_by('-is_featured', 'title')[:10]
    return list(items.values('id', 'title', 'slug', 'item_type', 'category', 'cover_image'))


def get_shelves_for_user(user) -> List[UserLibraryShelf]:
    return list(UserLibraryShelf.objects.filter(user=user).prefetch_related('items__library_item'))
