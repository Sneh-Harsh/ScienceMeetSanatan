import uuid

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import GuestProfile

from .models import ReviewFeedback, ReviewModerationStatus


class ReviewFeedbackApiTests(APITestCase):
    def test_guest_can_submit_review_feedback(self):
        response = self.client.post(
            reverse('review_create'),
            {
                'feature_type': 'library',
                'rating_overall': 5,
                'review_text': 'The reading experience feels calm and premium.',
                'improvement_suggestion': 'Add more bookmarks.',
                'is_public': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        review = ReviewFeedback.objects.get()
        self.assertIsNone(review.user)
        self.assertIsNotNone(review.guest_profile)
        self.assertEqual(review.sentiment, 'loved')
        self.assertEqual(review.feature_type, 'library')

    def test_public_review_endpoints_only_return_approved_reviews(self):
        user = User.objects.create_user(username='reviewer', password='pass')
        guest = GuestProfile.objects.create(guest_uuid=uuid.uuid4())
        ReviewFeedback.objects.create(
            user=user,
            name_display='Arjun',
            feature_type='kundali',
            rating_overall=5,
            review_text='Accurate and deeply useful.',
            is_public=True,
            is_featured=True,
            moderation_status=ReviewModerationStatus.APPROVED,
        )
        ReviewFeedback.objects.create(
            guest_profile=guest,
            name_display='Guest Seeker',
            feature_type='library',
            rating_overall=3,
            review_text='Good start but needs polish.',
            is_public=True,
            is_featured=False,
            moderation_status=ReviewModerationStatus.APPROVED,
        )
        ReviewFeedback.objects.create(
            guest_profile=guest,
            name_display='Pending Review',
            feature_type='quizzes',
            rating_overall=4,
            review_text='Should never appear publicly.',
            is_public=True,
            is_featured=True,
            moderation_status=ReviewModerationStatus.PENDING,
        )

        public_response = self.client.get(reverse('public_reviews'))
        stats_response = self.client.get(reverse('review_stats'))

        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(public_response.data), 1)
        self.assertEqual(public_response.data[0]['name_display'], 'Arjun')

        self.assertEqual(stats_response.status_code, status.HTTP_200_OK)
        self.assertEqual(stats_response.data['total_reviews'], 2)
        self.assertEqual(stats_response.data['rating_breakdown']['5'], 1)
        self.assertEqual(stats_response.data['rating_breakdown']['3'], 1)
