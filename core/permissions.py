from rest_framework.permissions import BasePermission


class IsAuthenticatedOrGuestAllowed(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated) or bool(getattr(request, 'guest_profile', None))


class IsAuthenticatedAndOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        return bool(request.user and request.user.is_authenticated and getattr(obj, 'user_id', None) == request.user.id)
