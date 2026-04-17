from django.contrib.auth.models import User
from django.test import TestCase

from core.utils.actors import Actor
from quizzes.models import Quiz, QuizCategory, QuizChoice, QuizLeaderboardEntry, QuizQuestion
from quizzes.services import submit_quiz_attempt


class LeaderboardRankingTests(TestCase):
    def setUp(self):
        self.category = QuizCategory.objects.create(name='Logic', slug='logic')
        self.quiz = Quiz.objects.create(category=self.category, title='Logic Run', slug='logic-run', total_questions=2, is_published=True)
        q1 = QuizQuestion.objects.create(quiz=self.quiz, prompt='Q1')
        q2 = QuizQuestion.objects.create(quiz=self.quiz, prompt='Q2')
        self.c1 = QuizChoice.objects.create(question=q1, text='A', is_correct=True, order=1)
        QuizChoice.objects.create(question=q1, text='B', is_correct=False, order=2)
        self.c2 = QuizChoice.objects.create(question=q2, text='A', is_correct=True, order=1)
        QuizChoice.objects.create(question=q2, text='B', is_correct=False, order=2)

    def test_better_percentage_and_faster_time_win(self):
        user1 = User.objects.create_user(username='u1', password='pass')
        user2 = User.objects.create_user(username='u2', password='pass')
        submit_quiz_attempt(Actor(user=user1), self.quiz, [{'question_id': self.quiz.questions.first().id, 'choice_id': self.c1.id}, {'question_id': self.quiz.questions.last().id, 'choice_id': self.c2.id}], duration_seconds=30)
        submit_quiz_attempt(Actor(user=user2), self.quiz, [{'question_id': self.quiz.questions.first().id, 'choice_id': self.c1.id}, {'question_id': self.quiz.questions.last().id, 'choice_id': None}], duration_seconds=10)

        global_rows = list(QuizLeaderboardEntry.objects.filter(board_type='global_all_time').order_by('-percentage', '-score', 'duration_seconds'))
        self.assertEqual(global_rows[0].user, user1)
        self.assertEqual(global_rows[1].user, user2)
