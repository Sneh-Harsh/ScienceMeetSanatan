from django.urls import path

from .views import QuizDetailView, QuizHistoryView, QuizLeaderboardView, QuizListView, QuizStartView, QuizStatsView, QuizSubmitView

urlpatterns = [
    path('quizzes/', QuizListView.as_view(), name='quizzes_list_v2'),
    path('quizzes/leaderboard/', QuizLeaderboardView.as_view(), name='quizzes_leaderboard_v2'),
    path('quizzes/history/', QuizHistoryView.as_view(), name='quizzes_history_v2'),
    path('quizzes/stats/', QuizStatsView.as_view(), name='quizzes_stats_v2'),
    path('quizzes/<slug:slug>/', QuizDetailView.as_view(), name='quizzes_detail_v2'),
    path('quizzes/<int:pk>/start/', QuizStartView.as_view(), name='quizzes_start_v2'),
    path('quizzes/<int:pk>/submit/', QuizSubmitView.as_view(), name='quizzes_submit_v2'),
]
