from django.contrib import admin

from .models import Booking, Pandit, PanditAvailabilitySlot, PanditService, Review, Service


class PanditServiceInline(admin.TabularInline):
    model = PanditService
    extra = 0


class PanditAvailabilityInline(admin.TabularInline):
    model = PanditAvailabilitySlot
    extra = 0


@admin.register(Pandit)
class PanditAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "experience", "rating", "total_bookings", "verified", "available_today", "is_active")
    search_fields = ("name", "city", "specialization")
    list_filter = ("city", "verified", "available_today", "is_active")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [PanditServiceInline, PanditAvailabilityInline]


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "base_price", "duration_minutes", "is_featured")
    search_fields = ("name", "category")
    list_filter = ("category", "is_featured")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(PanditService)
class PanditServiceAdmin(admin.ModelAdmin):
    list_display = ("pandit", "service", "price", "is_featured", "is_active")
    list_filter = ("is_featured", "is_active", "delivery_mode")
    search_fields = ("pandit__name", "service__name")


@admin.register(PanditAvailabilitySlot)
class PanditAvailabilitySlotAdmin(admin.ModelAdmin):
    list_display = ("pandit", "service", "date", "start_time", "end_time", "capacity", "is_available")
    list_filter = ("date", "is_available")
    search_fields = ("pandit__name",)


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("confirmation_code", "user", "pandit", "service", "date", "time", "status", "payment_status", "price_amount")
    list_filter = ("status", "payment_status", "date")
    search_fields = ("confirmation_code", "user__username", "pandit__name", "service__name", "address")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("pandit", "user", "rating", "created_at")
    list_filter = ("rating", "created_at")
    search_fields = ("pandit__name", "user__username", "comment")
