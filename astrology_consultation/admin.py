from django.contrib import admin

from astrology_consultation.models import (
    AstrologerAvailability,
    AstrologerProfile,
    AstrologerReview,
    ChatMessage,
    ChatSession,
    FavoriteAstrologer,
    Wallet,
    WalletTransaction,
)


@admin.register(AstrologerProfile)
class AstrologerProfileAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'city', 'price_per_minute', 'rating', 'is_online', 'is_verified', 'total_consultations')
    list_filter = ('is_online', 'is_verified', 'available_today', 'city')
    search_fields = ('display_name', 'city', 'bio')
    prepopulated_fields = {'slug': ('display_name',)}


@admin.register(AstrologerAvailability)
class AstrologerAvailabilityAdmin(admin.ModelAdmin):
    list_display = ('astrologer', 'day_of_week', 'start_time', 'end_time', 'is_available')
    list_filter = ('day_of_week', 'is_available')


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ('public_id', 'user', 'astrologer', 'status', 'rate_per_minute', 'total_charge', 'created_at')
    list_filter = ('status', 'birth_profile_shared')
    search_fields = ('public_id', 'user__username', 'astrologer__display_name')
    readonly_fields = ('public_id', 'created_at', 'updated_at')


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('session', 'sender', 'message_type', 'created_at', 'read_at')
    list_filter = ('sender', 'message_type')
    search_fields = ('message', 'session__public_id')


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('user', 'balance', 'currency', 'first_chat_free_consumed', 'updated_at')
    search_fields = ('user__username', 'user__email')


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'amount', 'transaction_type', 'reason', 'created_at')
    list_filter = ('transaction_type',)
    search_fields = ('user__username', 'reason')


@admin.register(AstrologerReview)
class AstrologerReviewAdmin(admin.ModelAdmin):
    list_display = ('astrologer', 'user', 'rating', 'created_at')
    list_filter = ('rating',)
    search_fields = ('astrologer__display_name', 'user__username', 'comment')


@admin.register(FavoriteAstrologer)
class FavoriteAstrologerAdmin(admin.ModelAdmin):
    list_display = ('user', 'astrologer', 'created_at')
    search_fields = ('user__username', 'astrologer__display_name')
