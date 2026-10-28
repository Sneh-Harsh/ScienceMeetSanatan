from datetime import date, time

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import Booking, Pandit, PanditAvailabilitySlot, PanditService, Service


class PanditMarketplaceTests(TestCase):
    def setUp(self):
        self.service = Service.objects.create(
            name="Griha Pravesh Puja Test",
            slug="griha-pravesh-puja-test",
            category="griha_pravesh",
            base_price=5100,
        )
        self.pandit = Pandit.objects.create(
            name="Pandit Test",
            slug="pandit-test",
            city="Bengaluru",
            languages=["Hindi", "English"],
            experience=10,
            rating=4.9,
            total_bookings=24,
            specialization="Griha Pravesh specialist",
            starting_price=5100,
            verified=True,
            available_today=True,
        )
        PanditService.objects.create(pandit=self.pandit, service=self.service, price=5100)
        self.slot = PanditAvailabilitySlot.objects.create(
            pandit=self.pandit,
            service=self.service,
            date=date.today(),
            start_time=time(10, 0),
            end_time=time(12, 0),
        )
        self.client = APIClient()

    def test_marketplace_page_loads(self):
        response = self.client.get(reverse("pandit_marketplace"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Book a Pandit, with Confidence.")

    def test_booking_page_is_the_whatsapp_enquiry_flow(self):
        html = self.client.get(reverse("pandit_marketplace")).content.decode()
        self.assertIn("Book a Pandit, with Confidence.", html)
        self.assertIn("wa.me/919353206153", html)
        for puja in [
            "Griha Pravesh Puja", "Satyanarayan Puja", "Rudrabhishek", "Ganesh Puja", "Lakshmi Puja",
            "Navagraha Shanti", "Vastu Shanti", "Bhoomi Puja", "Havan and other rituals",
            "Naamkaran and Mundan Sanskar", "Marriage and Vivah ceremonies", "Bhai Dooj", "Chitragupta Puja", "Chhath Puja", "Other Puja",
        ]:
            self.assertIn(puja, html)
        for field in ('id="psbName"', 'id="psbPuja"', 'id="psbDate"', 'id="psbArea"', 'name="venue"', 'name="language"', 'name="samagri"', 'id="psbNotes"'):
            self.assertIn(field, html)

    def test_hero_uses_silk_background_not_line_art(self):
        html = self.client.get(reverse("pandit_marketplace")).content.decode()
        self.assertIn('id="psbSilk"', html)
        self.assertIn("pandit/vendor/silk.js", html)
        self.assertNotIn("psb-bg__strand", html)
        self.assertNotIn("psb-emblem", html)

    def test_booking_page_styles_are_page_specific(self):
        html = self.client.get(reverse("pandit_marketplace")).content.decode()
        self.assertIn("pandit/booking.css", html)
        self.assertNotIn("pandit/pandit.css", html)  # the shared marketplace stylesheet is not used here
        # no invented ratings, prices, reviews or statistics inside the page content
        page = html[html.index('<main class="psb"'):html.index("</main>")]
        for fake in ("\u20b9", "Verified", "reviews)", "Trusted profiles", "Fast confirmations", "\u2605"):
            self.assertNotIn(fake, page)

    def test_other_pandit_pages_keep_their_own_assets(self):
        from pathlib import Path

        templates = Path(__file__).resolve().parent / "templates" / "pandit"
        for name in ("profile.html", "dashboard.html"):
            self.assertIn("pandit/pandit.css", (templates / name).read_text())
        self.assertTrue((Path(__file__).resolve().parent / "static" / "pandit" / "pandit.css").exists())

    def test_pandit_list_api_filters_by_city(self):
        response = self.client.get(reverse("api_pandit_list"), {"city": "Bengaluru"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 1)
        self.assertTrue(any(item["slug"] == "pandit-test" for item in response.data["results"]))

    def test_authenticated_user_can_create_booking(self):
        user = User.objects.create_user(username="seeker", password="pass12345")
        self.client.force_authenticate(user=user)

        response = self.client.post(
            reverse("api_pandit_booking_create"),
            {
                "pandit_id": str(self.pandit.id),
                "service_id": str(self.service.id),
                "slot_id": str(self.slot.id),
                "date": str(self.slot.date),
                "time": "10:00:00",
                "address": "221B Temple Road",
                "city": "Bengaluru",
                "preferred_language": "Hindi",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Booking.objects.filter(user=user, pandit=self.pandit).count(), 1)
