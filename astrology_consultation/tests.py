from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import PersonProfile
from astrology_consultation.models import AstrologerProfile, FavoriteAstrologer, SessionStatus
from astrology_consultation.services.chat_sessions import end_chat_session, start_chat_session
from astrology_consultation.services.wallet import credit_wallet, get_or_create_wallet


class AstrologyConsultationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="seeker", password="pass12345")
        self.person_profile = PersonProfile.objects.create(
            user=self.user,
            display_name="Seeker",
            birth_date=date(1995, 5, 20),
            birth_place_name="Delhi",
            is_primary=True,
        )
        self.astrologer = AstrologerProfile.objects.create(
            display_name="Test Acharya Vedant Rao",
            slug="test-acharya-vedant-rao",
            city="Bengaluru",
            expertise=["career", "vedic_astrology", "finance"],
            languages=["Hindi", "English"],
            experience_years=11,
            rating=4.9,
            total_consultations=120,
            price_per_minute=40,
            is_verified=True,
            is_online=True,
            available_today=True,
        )

    def test_marketplace_page_loads(self):
        response = self.client.get(reverse("astrologers_marketplace"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Chat with")

    def test_first_session_uses_free_minutes(self):
        session = start_chat_session(
            user=self.user,
            astrologer=self.astrologer,
            topic="Career clarity",
            share_mode="birth_only",
            person_profile=self.person_profile,
        )
        session.started_at = timezone.now() - timedelta(minutes=2)
        session.save(update_fields=["started_at"])

        ended = end_chat_session(session=session)
        wallet = get_or_create_wallet(self.user)

        self.assertEqual(ended.status, SessionStatus.ENDED)
        self.assertEqual(ended.total_charge, Decimal("0.00"))
        self.assertTrue(wallet.first_chat_free_consumed)

    def test_authenticated_user_can_start_session_via_api(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            reverse("api_start_chat_session"),
            {
                "astrologer_id": self.astrologer.id,
                "topic": "Marriage timing",
                "birth_share_mode": "none",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], SessionStatus.ACTIVE)

    def test_paid_session_deducts_wallet_balance(self):
        wallet = credit_wallet(user=self.user, amount=Decimal("200.00"), reason="Test topup")
        wallet.first_chat_free_consumed = True
        wallet.save(update_fields=["first_chat_free_consumed", "updated_at"])

        session = start_chat_session(user=self.user, astrologer=self.astrologer, topic="Finance")
        session.started_at = timezone.now() - timedelta(minutes=4)
        session.save(update_fields=["started_at"])
        ended = end_chat_session(session=session)

        self.assertEqual(ended.total_charge, Decimal("160.00"))
        self.assertEqual(get_or_create_wallet(self.user).balance, Decimal("40.00"))

    def test_favorite_toggle_endpoint(self):
        self.client.force_authenticate(user=self.user)

        first = self.client.post(reverse("api_astrologer_favorite", args=[self.astrologer.slug]), format="json")
        second = self.client.post(reverse("api_astrologer_favorite", args=[self.astrologer.slug]), format="json")

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertTrue(first.data["favorited"])
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertFalse(second.data["favorited"])
        self.assertEqual(FavoriteAstrologer.objects.filter(user=self.user, astrologer=self.astrologer).count(), 0)
