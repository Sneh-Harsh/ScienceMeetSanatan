from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.services import resolve_actor

from .models import Quiz, QuizAttempt
from .serializers import LeaderboardEntrySerializer, QuizAttemptSubmitSerializer, QuizQuestionSerializer, QuizResultSerializer, QuizSerializer
from .selectors import get_leaderboard, get_quiz_history, get_quiz_stats
from .services import build_quiz_recommendations, submit_quiz_attempt


class QuizListView(generics.ListAPIView):
    serializer_class = QuizSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Quiz.objects.filter(is_published=True).select_related('category')


class QuizDetailView(generics.RetrieveAPIView):
    serializer_class = QuizSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Quiz.objects.filter(is_published=True).select_related('category')
    lookup_field = 'slug'


class QuizStartView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk: int):
        quiz = generics.get_object_or_404(Quiz.objects.prefetch_related('questions__choices').filter(is_published=True), pk=pk)
        questions = quiz.questions.filter(is_active=True)[: quiz.total_questions or 5]
        return Response({'quiz': QuizSerializer(quiz).data, 'questions': QuizQuestionSerializer(questions, many=True).data})


class QuizSubmitView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk: int):
        quiz = generics.get_object_or_404(Quiz.objects.prefetch_related('questions__choices'), pk=pk, is_published=True)
        serializer = QuizAttemptSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attempt = submit_quiz_attempt(resolve_actor(request), quiz, serializer.validated_data['answers'], serializer.validated_data.get('duration_seconds', 0), serializer.validated_data.get('device_fingerprint', ''))
        result = QuizResultSerializer(attempt).data
        result['recommended_next_quizzes'] = build_quiz_recommendations(resolve_actor(request))
        return Response(result)


class QuizHistoryView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(QuizResultSerializer(get_quiz_history(resolve_actor(request)), many=True).data)


class QuizStatsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(get_quiz_stats(resolve_actor(request)))


class QuizLeaderboardView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        board_type = request.query_params.get('board_type', 'global_all_time')
        payload = get_leaderboard(board_type, quiz_id=request.query_params.get('quiz_id'), category_slug=request.query_params.get('category_slug'), period=request.query_params.get('period', 'all'))
        payload['top_entries'] = LeaderboardEntrySerializer(payload['entries'], many=True).data
        payload['current_user_entry'] = None
        return Response(payload)
