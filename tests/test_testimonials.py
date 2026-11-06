"""Public testimonials: submit -> moderate -> show on the homepage."""
from django.core.cache import cache
from django.test import TestCase

from personalization.models import ReviewFeedback, ReviewModerationStatus

HOST = "localhost"


def review(**over):
    data = {
        "name_display": "Asha", "email": "asha@example.com", "feature_type": "overall", "page_url": "/",
        "rating_overall": 5, "title": "Lovely", "review_text": "The Panchang and Kundali are clear and easy to use.",
        "is_public": True,
    }
    data.update(over)
    return data


class TestimonialFlowTests(TestCase):
    def setUp(self):
        cache.clear()

    def post(self, **over):
        return self.client.post("/api/reviews/", review(**over), content_type="application/json", HTTP_HOST=HOST)

    def public(self):
        return self.client.get("/api/reviews/public/", HTTP_HOST=HOST).json()

    def test_a_new_review_is_saved_but_not_shown_until_moderated(self):
        response = self.post()
        self.assertEqual(response.status_code, 201)
        saved = ReviewFeedback.objects.get()
        self.assertEqual(saved.moderation_status, ReviewModerationStatus.PENDING)
        self.assertTrue(saved.is_public)  # the visitor agreed to share it...
        self.assertFalse(saved.is_featured)
        self.assertEqual(self.public(), [])  # ...but nothing appears before a moderator approves it

    def test_visitors_cannot_approve_or_feature_their_own_review(self):
        self.post(moderation_status="approved", is_featured=True)
        saved = ReviewFeedback.objects.get()
        self.assertEqual(saved.moderation_status, ReviewModerationStatus.PENDING)
        self.assertFalse(saved.is_featured)

    def test_approved_public_review_appears_and_matches_the_stats(self):
        self.post(name_display="Asha", rating_overall=5)
        self.post(name_display="Ravi", rating_overall=3, review_text="Good content, a few pages are slow to load.")
        ReviewFeedback.objects.all().update(moderation_status=ReviewModerationStatus.APPROVED)  # what the admin "Approve" action does
        stats = self.client.get("/api/reviews/stats/", HTTP_HOST=HOST).json()
        shown = self.public()
        self.assertEqual(stats["total_reviews"], 2)
        self.assertEqual(len(shown), stats["total_reviews"])  # the count and the cards must agree
        self.assertEqual(stats["average_rating"], 4.0)

    def test_private_pending_and_rejected_reviews_never_appear(self):
        self.post(name_display="Private", is_public=False)
        self.post(name_display="Rejected")
        self.post(name_display="Pending")
        ReviewFeedback.objects.filter(name_display="Private").update(moderation_status=ReviewModerationStatus.APPROVED)
        ReviewFeedback.objects.filter(name_display="Rejected").update(moderation_status=ReviewModerationStatus.REJECTED)
        self.assertEqual(self.public(), [])

    def test_public_data_never_includes_private_fields(self):
        self.post()
        ReviewFeedback.objects.all().update(moderation_status=ReviewModerationStatus.APPROVED)
        card = self.public()[0]
        for private in ("email", "improvement_suggestion", "user", "guest_profile", "page_url", "moderation_status"):
            self.assertNotIn(private, card)
        self.assertEqual(card["name_display"], "Asha")

    def test_featured_reviews_come_first(self):
        self.post(name_display="Older", review_text="Older review about the library section.")
        self.post(name_display="Newer", review_text="Newer review about the horoscope page.")
        ReviewFeedback.objects.all().update(moderation_status=ReviewModerationStatus.APPROVED)
        ReviewFeedback.objects.filter(name_display="Older").update(is_featured=True)
        self.assertEqual([c["name_display"] for c in self.public()][0], "Older")

    def test_homepage_contains_the_testimonial_section(self):
        html = self.client.get("/", HTTP_HOST=HOST).content.decode()
        for marker in ("smsTestimonials", "smsTestimonialsTrack", "js/review.js"):
            self.assertIn(marker, html)
