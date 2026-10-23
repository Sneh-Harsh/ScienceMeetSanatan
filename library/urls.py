from django.urls import path

from .views import LibraryBookmarksView, LibraryHomeView, LibraryItemBookmarkView, LibraryItemProgressView, LibraryProgressView, LibraryRecommendationsView, ShelfDetailView, ShelfItemCreateView, ShelfListCreateView

urlpatterns = [
    path('library/home/', LibraryHomeView.as_view(), name='library_home_v2'),
    path('library/bookmarks/', LibraryBookmarksView.as_view(), name='library_bookmarks'),
    path('library/progress/', LibraryProgressView.as_view(), name='library_progress'),
    path('library/recommendations/', LibraryRecommendationsView.as_view(), name='library_recommendations'),
    path('library/items/<object_id:pk>/bookmark/', LibraryItemBookmarkView.as_view(), name='library_item_bookmark'),
    path('library/items/<object_id:pk>/progress/', LibraryItemProgressView.as_view(), name='library_item_progress'),
    path('library/shelves/', ShelfListCreateView.as_view(), name='library_shelves'),
    path('library/shelves/<object_id:pk>/', ShelfDetailView.as_view(), name='library_shelf_detail'),
    path('library/shelves/<object_id:pk>/items/', ShelfItemCreateView.as_view(), name='library_shelf_items'),
]
