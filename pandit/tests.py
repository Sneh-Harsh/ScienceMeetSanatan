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
        self.assertContains(response, "Book trusted pandits")

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
                "pandit_id": self.pandit.id,
                "service_id": self.service.id,
                "slot_id": self.slot.id,
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
