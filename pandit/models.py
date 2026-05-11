from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg
from django.utils.text import slugify


def _check_constraint(*, name: str, condition):
    try:
        return models.CheckConstraint(condition=condition, name=name)
    except TypeError:
        return models.CheckConstraint(check=condition, name=name)


class PanditServiceCategory(models.TextChoices):
    GRIHA_PRAVESH = "griha_pravesh", "Griha Pravesh"
    MARRIAGE = "marriage", "Marriage"
    SATYANARAYAN = "satyanarayan", "Satyanarayan Puja"
    RUDRABHISHEK = "rudrabhishek", "Rudrabhishek"
    NAMING = "naming_ceremony", "Naming Ceremony"
    HAVAN = "havan", "Havan"
    REMEDIAL = "remedial", "Astro Remedial Puja"
    OTHER = "other", "Other"


class BookingStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    CANCELLED = "cancelled", "Cancelled"
    COMPLETED = "completed", "Completed"
    RESCHEDULE_REQUESTED = "reschedule_requested", "Reschedule Requested"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    INITIATED = "initiated", "Initiated"
    PAID = "paid", "Paid"
    FAILED = "failed", "Failed"
    REFUNDED = "refunded", "Refunded"


class Service(models.Model):
    name = models.CharField(max_length=140, unique=True)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    description = models.TextField(blank=True)
    category = models.CharField(
        max_length=40,
        choices=PanditServiceCategory.choices,
        default=PanditServiceCategory.OTHER,
    )
    base_price = models.PositiveIntegerField(default=0)
    duration_minutes = models.PositiveIntegerField(default=90)
    is_featured = models.BooleanField(default=False)
    icon = models.CharField(max_length=32, blank=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Pandit(models.Model):
    user = models.OneToOneField(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="pandit_profile",
    )
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    photo = models.URLField(blank=True)
    city = models.CharField(max_length=120)
    area = models.CharField(max_length=120, blank=True)
    languages = models.JSONField(default=list, blank=True)
    experience = models.PositiveIntegerField(default=0)
    rating = models.FloatField(default=0, validators=[MinValueValidator(0), MaxValueValidator(5)])
    total_bookings = models.PositiveIntegerField(default=0)
    specialization = models.CharField(max_length=220)
    specialization_tags = models.JSONField(default=list, blank=True)
    bio = models.TextField(blank=True)
    certifications = models.JSONField(default=list, blank=True)
    photos_videos = models.JSONField(default=list, blank=True)
    verified = models.BooleanField(default=True)
    astro_focus = models.JSONField(default=list, blank=True)
    trust_note = models.CharField(max_length=180, blank=True)
    available_today = models.BooleanField(default=False)
    priority_score = models.FloatField(default=0)
    starting_price = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-verified", "-rating", "-priority_score", "name"]
        indexes = [
            models.Index(fields=["city", "is_active"]),
            models.Index(fields=["available_today", "is_active"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def refresh_rating(self):
        avg_rating = self.reviews.aggregate(value=Avg("rating")).get("value") or 0
        self.rating = round(float(avg_rating), 2)
        self.save(update_fields=["rating", "updated_at"])

    def __str__(self) -> str:
        return self.name


class PanditService(models.Model):
    pandit = models.ForeignKey(Pandit, on_delete=models.CASCADE, related_name="pandit_services")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="pandit_links")
    price = models.PositiveIntegerField()
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    delivery_mode = models.CharField(max_length=40, default="at_home")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["price", "service__name"]
        unique_together = [("pandit", "service")]

    def __str__(self) -> str:
        return f"{self.pandit.name} • {self.service.name}"


class PanditAvailabilitySlot(models.Model):
    pandit = models.ForeignKey(Pandit, on_delete=models.CASCADE, related_name="availability_slots")
    service = models.ForeignKey(
        Service,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="availability_slots",
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)
    capacity = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["date", "start_time"]
        unique_together = [("pandit", "date", "start_time", "end_time")]

    def __str__(self) -> str:
        return f"{self.pandit.name} • {self.date} {self.start_time}"


class Booking(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="pandit_bookings")
    pandit = models.ForeignKey(Pandit, on_delete=models.CASCADE, related_name="bookings")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="bookings")
    pandit_service = models.ForeignKey(
        PanditService,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="bookings",
    )
    slot = models.ForeignKey(
        PanditAvailabilitySlot,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="bookings",
    )
    date = models.DateField()
    time = models.TimeField()
    address = models.TextField()
    city = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    contact_phone = models.CharField(max_length=40, blank=True)
    preferred_language = models.CharField(max_length=40, blank=True)
    status = models.CharField(
        max_length=24,
        choices=BookingStatus.choices,
        default=BookingStatus.PENDING,
    )
    payment_status = models.CharField(
        max_length=24,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    price_amount = models.PositiveIntegerField(default=0)
    payment_note = models.CharField(max_length=160, blank=True)
    confirmation_code = models.CharField(max_length=24, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-time", "-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["pandit", "status"]),
            models.Index(fields=["date", "time"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} • {self.pandit.name} • {self.service.name}"


class Review(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="pandit_reviews")
    pandit = models.ForeignKey(Pandit, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("user", "pandit")]

    def __str__(self) -> str:
        return f"{self.user.username} • {self.pandit.name} • {self.rating}"
