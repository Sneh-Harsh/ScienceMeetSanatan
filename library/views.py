from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.services import resolve_actor
from core.utils.constants import ContentType, ProgressContentType, RecommendationType
from personalization.models import Bookmark, ReadingProgress
from personalization.serializers import BookmarkSerializer, ReadingProgressSerializer
from personalization.services import RecommendationService, toggle_bookmark, update_reading_progress

from .models import LibraryItem, UserLibraryShelf
from .serializers import LibraryItemCardSerializer, UserLibraryShelfSerializer
from .selectors import get_library_home, get_library_recommendations, get_shelves_for_user
from .services import add_item_to_shelf, create_shelf


class LibraryHomeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(get_library_home(resolve_actor(request)))


class LibraryBookmarksView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        actor = resolve_actor(request)
        filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
        return Response(BookmarkSerializer(Bookmark.objects.filter(**filters), many=True).data)


class LibraryProgressView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        actor = resolve_actor(request)
        filters = {'user': actor.user} if actor.user else {'guest_profile': actor.guest_profile}
        return Response(ReadingProgressSerializer(ReadingProgress.objects.filter(**filters), many=True).data)


class LibraryRecommendationsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        actor = resolve_actor(request)
        return Response({'items': get_library_recommendations(actor), 'reasons': RecommendationService.build_library_recommendations(actor)})


class LibraryItemBookmarkView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk: int):
        item = generics.get_object_or_404(LibraryItem, pk=pk)
        actor = resolve_actor(request)
        bookmark = toggle_bookmark(actor, content_type=ContentType.LIBRARY_BOOK if item.item_type == 'book' else ContentType.LIBRARY_AUDIO, object_id=str(item.id), source_context='library')
        return Response({'bookmarked': bool(bookmark)})

    delete = post


class LibraryItemProgressView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk: int):
        item = generics.get_object_or_404(LibraryItem, pk=pk)
        actor = resolve_actor(request)
        payload = request.data
        progress = update_reading_progress(
            actor,
            content_type=ProgressContentType.AUDIO if item.item_type == 'audio' else ProgressContentType.BOOK,
            object_id=str(item.id),
            progress_percent=float(payload.get('progress_percent', 0)),
            progress_seconds=payload.get('progress_seconds'),
            last_position_reference=payload.get('last_position_reference', ''),
        )
        return Response(ReadingProgressSerializer(progress).data)


class ShelfListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserLibraryShelfSerializer(get_shelves_for_user(request.user), many=True).data)

    def post(self, request):
        shelf = create_shelf(request.user, request.data.get('name', 'My Shelf'), request.data.get('visibility', 'private'))
        return Response(UserLibraryShelfSerializer(shelf).data)


class ShelfDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserLibraryShelfSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserLibraryShelf.objects.filter(user=self.request.user)


class ShelfItemCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        shelf = generics.get_object_or_404(UserLibraryShelf, pk=pk, user=request.user)
        item = generics.get_object_or_404(LibraryItem, pk=request.data.get('library_item_id'))
        shelf_item = add_item_to_shelf(shelf, item)
        return Response({'id': shelf_item.id, 'library_item_id': item.id})
