from rest_framework import serializers

from .models import Booking, Pandit, PanditAvailabilitySlot, PanditService, Review, Service


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "category",
            "base_price",
            "duration_minutes",
            "is_featured",
            "icon",
        ]


class PanditServiceSerializer(serializers.ModelSerializer):
    service = ServiceSerializer(read_only=True)
    service_id = serializers.PrimaryKeyRelatedField(
        source="service",
        queryset=Service.objects.all(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = PanditService
        fields = [
            "id",
            "service",
            "service_id",
            "price",
            "is_featured",
            "is_active",
            "delivery_mode",
            "notes",
        ]


class PanditAvailabilitySlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = PanditAvailabilitySlot
        fields = [
            "id",
            "date",
            "start_time",
            "end_time",
            "is_available",
            "capacity",
            "service",
        ]


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "rating", "comment", "user_name", "created_at"]

    def get_user_name(self, obj):
        first_name = obj.user.first_name.strip() if obj.user.first_name else ""
        return first_name or obj.user.username


class PanditCardSerializer(serializers.ModelSerializer):
    languages_display = serializers.SerializerMethodField()
    badges = serializers.SerializerMethodField()

    class Meta:
        model = Pandit
        fields = [
            "id",
            "name",
            "slug",
            "photo",
            "city",
            "area",
            "experience",
            "rating",
            "specialization",
            "total_bookings",
            "languages",
            "languages_display",
            "starting_price",
            "verified",
            "available_today",
            "trust_note",
            "badges",
        ]

    def get_languages_display(self, obj):
        return ", ".join(obj.languages[:3]) if obj.languages else "Hindi"

    def get_badges(self, obj):
        badges = []
        if obj.verified:
            badges.append("Verified Pandit")
        if obj.available_today:
            badges.append("Available Today")
        if obj.rating >= 4.8:
            badges.append("Top Rated")
        return badges


class PanditDetailSerializer(PanditCardSerializer):
    pandit_services = PanditServiceSerializer(many=True, read_only=True)
    availability_slots = PanditAvailabilitySlotSerializer(many=True, read_only=True)
    reviews = ReviewSerializer(many=True, read_only=True)

    class Meta(PanditCardSerializer.Meta):
        fields = PanditCardSerializer.Meta.fields + [
            "bio",
            "certifications",
            "photos_videos",
            "specialization_tags",
            "astro_focus",
            "pandit_services",
            "availability_slots",
            "reviews",
        ]


class BookingCreateSerializer(serializers.Serializer):
    pandit_id = serializers.PrimaryKeyRelatedField(source="pandit", queryset=Pandit.objects.filter(is_active=True))
    service_id = serializers.PrimaryKeyRelatedField(source="service", queryset=Service.objects.all())
    slot_id = serializers.PrimaryKeyRelatedField(
        source="slot",
        queryset=PanditAvailabilitySlot.objects.filter(is_available=True),
        required=False,
        allow_null=True,
    )
    date = serializers.DateField()
    time = serializers.TimeField()
    address = serializers.CharField()
    city = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    contact_phone = serializers.CharField(required=False, allow_blank=True)
    preferred_language = serializers.CharField(required=False, allow_blank=True)


class BookingSerializer(serializers.ModelSerializer):
    pandit = PanditCardSerializer(read_only=True)
    service = ServiceSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "pandit",
            "service",
            "date",
            "time",
            "address",
            "city",
            "notes",
            "contact_phone",
            "preferred_language",
            "status",
            "payment_status",
            "price_amount",
            "payment_note",
            "confirmation_code",
            "created_at",
        ]


class BookingStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Booking._meta.get_field("status").choices)


class PanditProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pandit
        fields = [
            "name",
            "photo",
            "city",
            "area",
            "languages",
            "experience",
            "specialization",
            "specialization_tags",
            "bio",
            "certifications",
            "photos_videos",
            "astro_focus",
            "trust_note",
            "available_today",
            "starting_price",
        ]
