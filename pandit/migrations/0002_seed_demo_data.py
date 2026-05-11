from datetime import date, timedelta, time

from django.db import migrations
from django.utils.text import slugify


def seed_demo_data(apps, schema_editor):
    Service = apps.get_model("pandit", "Service")
    Pandit = apps.get_model("pandit", "Pandit")
    PanditService = apps.get_model("pandit", "PanditService")
    PanditAvailabilitySlot = apps.get_model("pandit", "PanditAvailabilitySlot")

    services_payload = [
        {
            "name": "Griha Pravesh Puja",
            "category": "griha_pravesh",
            "base_price": 5100,
            "duration_minutes": 180,
            "is_featured": True,
            "icon": "🏡",
            "description": "Premium entry ritual with vastu shanti, sankalp, and guided samagri preparation.",
        },
        {
            "name": "Marriage Ceremony",
            "category": "marriage",
            "base_price": 21000,
            "duration_minutes": 360,
            "is_featured": True,
            "icon": "💍",
            "description": "Elegant wedding ritual planning with Sanskrit + regional language guidance.",
        },
        {
            "name": "Satyanarayan Puja",
            "category": "satyanarayan",
            "base_price": 3100,
            "duration_minutes": 120,
            "is_featured": True,
            "icon": "📿",
            "description": "Katha, sankalp, and family participation flow with devotional clarity.",
        },
        {
            "name": "Rudrabhishek",
            "category": "rudrabhishek",
            "base_price": 4100,
            "duration_minutes": 150,
            "is_featured": True,
            "icon": "🔱",
            "description": "Focused Shiv puja for strength, purification, and spiritual reset.",
        },
        {
            "name": "Naamkaran Sanskar",
            "category": "naming_ceremony",
            "base_price": 2600,
            "duration_minutes": 90,
            "is_featured": True,
            "icon": "👶",
            "description": "Naming ceremony with nakshatra guidance and auspicious timing support.",
        },
    ]

    services = {}
    for payload in services_payload:
        service, _created = Service.objects.update_or_create(
            slug=slugify(payload["name"]),
            defaults=payload,
        )
        services[service.slug] = service

    pandits_payload = [
        {
            "name": "Pandit Aditya Sharma",
            "city": "Bengaluru",
            "area": "Indiranagar",
            "languages": ["Hindi", "English", "Kannada"],
            "experience": 14,
            "rating": 4.9,
            "total_bookings": 182,
            "specialization": "Griha Pravesh, Satyanarayan Puja, and vastu-aligned family rituals",
            "specialization_tags": ["griha pravesh", "satyanarayan", "vastu shanti"],
            "bio": "Known for calm explanations, premium ritual pacing, and city-home ceremonies that feel deeply traditional yet easy for modern families to follow.",
            "certifications": ["Karmakand Visharad", "Vedic Ritual Planning"],
            "verified": True,
            "astro_focus": ["vastu", "home harmony", "moon remedies"],
            "trust_note": "Trusted by 180+ households for elegant, on-time ceremonies.",
            "available_today": True,
            "priority_score": 9.4,
            "starting_price": 3100,
        },
        {
            "name": "Pandit Naman Trivedi",
            "city": "Mumbai",
            "area": "Powai",
            "languages": ["Hindi", "Marathi", "English"],
            "experience": 18,
            "rating": 4.8,
            "total_bookings": 264,
            "specialization": "Marriage ceremonies, engagement rituals, and premium family events",
            "specialization_tags": ["marriage", "vivah", "engagement"],
            "bio": "Handles high-trust milestone rituals with excellent crowd guidance, bilingual explanations, and a composed ceremonial presence.",
            "certifications": ["Shastri", "Vivah Sanskar Specialist"],
            "verified": True,
            "astro_focus": ["venus harmony", "relationship rituals"],
            "trust_note": "A favourite for premium wedding households and destination-style ceremonies.",
            "available_today": False,
            "priority_score": 9.1,
            "starting_price": 5100,
        },
        {
            "name": "Pandit Raghav Vyas",
            "city": "Delhi",
            "area": "Dwarka",
            "languages": ["Hindi", "Sanskrit", "English"],
            "experience": 11,
            "rating": 4.7,
            "total_bookings": 139,
            "specialization": "Rudrabhishek, remedial pujas, and naamkaran ceremonies",
            "specialization_tags": ["rudrabhishek", "remedial", "naamkaran"],
            "bio": "Well suited for spiritually focused households seeking remedial rituals, mantra emphasis, and calendar-accurate execution.",
            "certifications": ["Jyotish Acharya", "Rudra Karmakand"],
            "verified": True,
            "astro_focus": ["mars remedies", "shiva worship", "child blessings"],
            "trust_note": "Frequently chosen for high-devotion pujas and kundali-linked remedies.",
            "available_today": True,
            "priority_score": 8.8,
            "starting_price": 2600,
        },
    ]

    pandits = {}
    for payload in pandits_payload:
        pandit, _created = Pandit.objects.update_or_create(
            slug=slugify(payload["name"]),
            defaults=payload,
        )
        pandits[pandit.slug] = pandit

    service_map = {
        "pandit-aditya-sharma": [
            ("griha-pravesh-puja", 5100),
            ("satyanarayan-puja", 3100),
            ("rudrabhishek", 4500),
        ],
        "pandit-naman-trivedi": [
            ("marriage-ceremony", 21000),
            ("satyanarayan-puja", 4100),
        ],
        "pandit-raghav-vyas": [
            ("rudrabhishek", 4100),
            ("naamkaran-sanskar", 2600),
            ("satyanarayan-puja", 3300),
        ],
    }

    for pandit_slug, linked_services in service_map.items():
        pandit = pandits[pandit_slug]
        for service_slug, price in linked_services:
            PanditService.objects.update_or_create(
                pandit=pandit,
                service=services[service_slug],
                defaults={
                    "price": price,
                    "is_featured": True,
                    "is_active": True,
                    "delivery_mode": "at_home",
                    "notes": "Samagri guidance and confirmation support included.",
                },
            )

    base_date = date.today()
    for pandit_slug, service_pairs in service_map.items():
        pandit = pandits[pandit_slug]
        primary_service = services[service_pairs[0][0]]
        for index in range(4):
            slot_date = base_date + timedelta(days=index + 1)
            start_hour = 8 + index
            PanditAvailabilitySlot.objects.update_or_create(
                pandit=pandit,
                date=slot_date,
                start_time=time(start_hour, 0),
                end_time=time(start_hour + 2, 0),
                defaults={
                    "service": primary_service,
                    "is_available": True,
                    "capacity": 1,
                },
            )


def remove_demo_data(apps, schema_editor):
    PanditAvailabilitySlot = apps.get_model("pandit", "PanditAvailabilitySlot")
    PanditService = apps.get_model("pandit", "PanditService")
    Pandit = apps.get_model("pandit", "Pandit")
    Service = apps.get_model("pandit", "Service")

    PanditAvailabilitySlot.objects.all().delete()
    PanditService.objects.all().delete()
    Pandit.objects.filter(slug__in=["pandit-aditya-sharma", "pandit-naman-trivedi", "pandit-raghav-vyas"]).delete()
    Service.objects.filter(
        slug__in=[
            "griha-pravesh-puja",
            "marriage-ceremony",
            "satyanarayan-puja",
            "rudrabhishek",
            "naamkaran-sanskar",
        ]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("pandit", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_demo_data, remove_demo_data),
    ]
