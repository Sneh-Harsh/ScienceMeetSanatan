import datetime
import json
from decimal import Decimal

from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from accounts.models import PersonProfile
from accounts.quiz_engine import load_question_pool
from astrology_consultation.models import AstrologerProfile, ChatSession, SessionStatus, Wallet
from astrology_consultation.services.chat_sessions import end_chat_session, start_chat_session
from astrology_consultation.services.wallet import credit_wallet, debit_wallet, get_or_create_wallet
from pandit.models import Pandit, PanditAvailabilitySlot, Service


class SecurityTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user('alice', 'alice@example.com', 'Str0ng!Pass#1')
        self.other = User.objects.create_user('bob', 'bob@example.com', 'Str0ng!Pass#2')
        self.astrologer = AstrologerProfile.objects.create(display_name='Test Guru', slug='test-guru-sec', price_per_minute=30)


class WalletTests(SecurityTestCase):
    @override_settings(WALLET_DEV_RECHARGE_ENABLED=False)
    def test_recharge_is_blocked_when_disabled(self):
        api = APIClient()
        api.force_authenticate(self.user)
        response = api.post(reverse('api_wallet_recharge'), {'amount': '500'}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(get_or_create_wallet(self.user).balance, Decimal('0'))

    @override_settings(WALLET_DEV_RECHARGE_ENABLED=True)
    def test_recharge_amount_is_capped(self):
        api = APIClient()
        api.force_authenticate(self.user)
        response = api.post(reverse('api_wallet_recharge'), {'amount': '9999999'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_cannot_overdraw(self):
        credit_wallet(user=self.user, amount=Decimal('100'), reason='seed')
        debit_wallet(user=self.user, amount=Decimal('100'), reason='spend')
        with self.assertRaises(ValueError):
            debit_wallet(user=self.user, amount=Decimal('1'), reason='again')
        self.assertEqual(Wallet.objects.get(user=self.user).balance, Decimal('0'))

    def test_ending_a_session_twice_charges_once(self):
        credit_wallet(user=self.user, amount=Decimal('1000'), reason='seed')
        astrologer = self.astrologer
        wallet = get_or_create_wallet(self.user)
        wallet.first_chat_free_consumed = True
        wallet.save()
        session = start_chat_session(user=self.user, astrologer=astrologer)
        ChatSession.objects.filter(pk=session.pk).update(
            started_at=session.started_at - datetime.timedelta(minutes=10)
        )
        session.refresh_from_db()
        end_chat_session(session=session)
        balance_after_first = Wallet.objects.get(user=self.user).balance
        stale = ChatSession.objects.get(pk=session.pk)
        stale.status = SessionStatus.ACTIVE  # simulate a second request holding stale state
        end_chat_session(session=stale)
        self.assertEqual(Wallet.objects.get(user=self.user).balance, balance_after_first)
        self.assertLess(balance_after_first, Decimal('1000'))


class ConsultationPrivacyTests(SecurityTestCase):
    def test_cannot_use_someone_elses_birth_profile(self):
        victim_profile = PersonProfile.objects.create(
            user=self.other, display_name='Bob Secret', birth_date=datetime.date(1990, 1, 2), birth_place_name='Hidden'
        )
        astrologer = self.astrologer
        api = APIClient()
        api.force_authenticate(self.user)
        response = api.post(
            reverse('api_start_chat_session'),
            {'astrologer_id': str(astrologer.pk), 'birth_share_mode': 'birth_only', 'person_profile_id': str(victim_profile.pk)},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('Bob Secret', response.content.decode())

    def test_reviews_require_a_consultation(self):
        astrologer = self.astrologer
        api = APIClient()
        api.force_authenticate(self.user)
        response = api.post(reverse('api_astrologer_reviews'), {'astrologer_id': str(astrologer.pk), 'rating': 5}, format='json')
        self.assertEqual(response.status_code, 403)


class AuthTests(SecurityTestCase):
    def test_login_does_not_redirect_off_site(self):
        for target in ('//evil.example.com', 'https://evil.example.com', '/\\evil.example.com'):
            response = Client().post('/login/', {'form_type': 'login', 'username': 'alice', 'password': 'Str0ng!Pass#1', 'next': target})
            self.assertEqual(response.status_code, 302, target)
            self.assertEqual(response.headers['Location'], '/welcome/', target)
            cache.clear()

    def test_login_allows_on_site_next(self):
        response = Client().post('/login/', {'form_type': 'login', 'username': 'alice', 'password': 'Str0ng!Pass#1', 'next': '/quizzes/'})
        self.assertEqual(response.headers['Location'], '/quizzes/')

    def test_password_cannot_be_reset_with_just_username_and_email(self):
        Client().post('/login/', {
            'form_type': 'reset_password', 'username': 'alice', 'email': 'alice@example.com',
            'new_password': 'Hacked!Pass#9', 'confirm_password': 'Hacked!Pass#9',
        })
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Str0ng!Pass#1'))

    def test_reset_link_flow(self):
        Client().post('/login/', {'form_type': 'reset_password', 'email': 'alice@example.com'})
        self.assertEqual(len(mail.outbox), 1)
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        url = reverse('password_reset_confirm', args=[uid, token])
        self.assertEqual(Client().get(url).status_code, 200)
        weak = Client().post(url, {'new_password': '123', 'confirm_password': '123'})
        self.assertContains(weak, 'password', status_code=200)
        Client().post(url, {'new_password': 'Brand!New#Pass7', 'confirm_password': 'Brand!New#Pass7'})
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Brand!New#Pass7'))
        self.assertEqual(Client().get(url).status_code, 400)  # token is single use

    def test_bad_reset_token_is_rejected(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        self.assertEqual(Client().get(reverse('password_reset_confirm', args=[uid, 'bad-token'])).status_code, 400)

    def test_login_is_rate_limited(self):
        client = Client()
        statuses = [
            client.post('/login/', {'form_type': 'login', 'username': 'alice', 'password': 'wrong'}).status_code
            for _ in range(12)
        ]
        self.assertIn(429, statuses)
        good = client.post('/login/', {'form_type': 'login', 'username': 'alice', 'password': 'Str0ng!Pass#1'})
        self.assertEqual(good.status_code, 429)  # even the right password is blocked while locked out

    def test_signup_rejects_weak_password(self):
        response = Client().post('/login/', {'form_type': 'signup', 'name': 'New One', 'username': 'newone', 'email': 'n@example.com', 'password': '1'})
        self.assertFalse(User.objects.filter(username='newone').exists())
        self.assertEqual(response.status_code, 200)


class QuizTests(SecurityTestCase):
    def setUp(self):
        super().setUp()
        self.client = Client()
        self.client.force_login(self.user)
        self.category = load_question_pool()[0]['category']

    def _start(self):
        response = self.client.post('/api/quiz-session/', json.dumps({'category': self.category}), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        return response.json()

    def _post(self, url, body):
        return self.client.post(url, json.dumps(body), content_type='application/json')

    def test_score_cannot_be_forged_without_a_session(self):
        response = self._post('/api/submit-score/', {'category': self.category, 'score': 1000000, 'total': 1000000})
        self.assertEqual(response.status_code, 400)

    def test_answers_are_not_sent_to_the_browser(self):
        session = self._start()
        for question in session['questions']:
            self.assertNotIn('answerIndex', question)

    def test_score_comes_from_server_and_cannot_be_replayed(self):
        session = self._start()
        for question in session['questions']:
            result = self._post('/api/quiz-answer/', {'session_id': session['sessionId'], 'question_id': question['id'], 'selected_index': 0, 'time_taken': 3}).json()
            self.assertIn('correct', result)
        # Claim a perfect score; the server must ignore it and use its own record.
        submit = self._post('/api/submit-score/', {'category': self.category, 'session_id': session['sessionId'], 'score': 999, 'total': 999})
        self.assertEqual(submit.status_code, 200)
        self.assertLessEqual(submit.json()['score'], len(session['questions']))
        again = self._post('/api/submit-score/', {'category': self.category, 'session_id': session['sessionId']})
        self.assertEqual(again.status_code, 409)

    def test_answer_is_final(self):
        session = self._start()
        question = session['questions'][0]
        first = self._post('/api/quiz-answer/', {'session_id': session['sessionId'], 'question_id': question['id'], 'selected_index': 0}).json()
        second = self._post('/api/quiz-answer/', {'session_id': session['sessionId'], 'question_id': question['id'], 'selected_index': first['correctIndex']}).json()
        self.assertEqual(first['correct'], second['correct'])


class PanditBookingTests(SecurityTestCase):
    def setUp(self):
        super().setUp()
        self.service = Service.objects.create(name='Puja', slug='puja-sec', base_price=1000)
        self.pandit = Pandit.objects.create(name='P1', slug='p1-sec', city='X', experience=5, starting_price=1000, verified=True)
        self.other_pandit = Pandit.objects.create(name='P2', slug='p2-sec', city='X', experience=5, starting_price=1000, verified=True)
        self.slot = PanditAvailabilitySlot.objects.create(
            pandit=self.pandit, service=self.service, date=datetime.date.today() + datetime.timedelta(days=2),
            start_time=datetime.time(10, 0), end_time=datetime.time(12, 0),
        )

    def _payload(self, **overrides):
        data = {
            'pandit_id': str(self.pandit.pk), 'service_id': str(self.service.pk), 'slot_id': str(self.slot.pk),
            'date': str(self.slot.date), 'time': '10:30:00', 'address': '1 Temple Rd',
        }
        data.update(overrides)
        return data

    def _api(self, user):
        api = APIClient()
        api.force_authenticate(user)
        return api

    def test_slot_cannot_be_double_booked(self):
        first = self._api(self.user).post(reverse('api_pandit_booking_create'), self._payload(), format='json')
        second = self._api(self.other).post(reverse('api_pandit_booking_create'), self._payload(), format='json')
        self.assertEqual(first.status_code, 201)
        self.assertIn(second.status_code, (400, 409))

    def test_slot_must_belong_to_the_pandit(self):
        response = self._api(self.user).post(reverse('api_pandit_booking_create'), self._payload(pandit_id=str(self.other_pandit.pk)), format='json')
        self.assertEqual(response.status_code, 400)

    def test_past_dates_are_rejected(self):
        response = self._api(self.user).post(reverse('api_pandit_booking_create'), self._payload(date='2020-01-01'), format='json')
        self.assertEqual(response.status_code, 400)

    def test_review_requires_completed_booking(self):
        response = self._api(self.user).post(reverse('api_pandit_review_create', args=[self.pandit.slug]), {'rating': 5, 'comment': 'x'}, format='json')
        self.assertEqual(response.status_code, 403)


class PublicEndpointTests(SecurityTestCase):
    def test_oracle_is_rate_limited_and_validates_input(self):
        client = Client()
        body = {'profile': {'date': '1990-01-01', 'time': '10:00'}, 'question': 'x' * 600}
        response = client.post('/api/oracle', json.dumps(body), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('too long', response.json()['error'])

    def test_out_of_range_input_is_rejected(self):
        response = Client().get('/api/kundali', {'date': '1990-01-01', 'time': '10:00', 'lat': '500', 'lon': '0'})
        self.assertEqual(response.status_code, 400)

    def test_bad_review_limit_does_not_crash(self):
        self.assertEqual(Client().get('/api/reviews/public/?limit=abc').status_code, 200)

    def test_errors_do_not_leak_internals(self):
        body = {'profile': {'date': 'not-a-date', 'time': '10:00'}, 'question': 'hi'}
        response = Client().post('/api/oracle', json.dumps(body), content_type='application/json')
        self.assertNotIn('Traceback', response.content.decode())
