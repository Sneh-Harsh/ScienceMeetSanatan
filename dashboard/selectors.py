from core.utils.actors import Actor
from personalization.selectors import get_home_dashboard_seed
from personalization.services import RecommendationService
from library.selectors import get_library_home
from astrology.selectors import get_today_panchaang
from quizzes.selectors import get_quiz_stats


def get_home_dashboard(actor: Actor):
    dashboard = []
    dashboard.append({
        'key': 'welcome',
        'title': 'Welcome back' if actor.user else 'Welcome',
        'subtitle': 'Your journey continues here.',
        'layout_type': 'hero',
        'priority': 10,
        'items': [],
        'cta': {'label': 'Save your journey', 'href': '/login/'} if not actor.user else {'label': 'View profile', 'href': '/profile/'},
        'analytics_payload': {'actor': actor.identity_key},
    })
    dashboard.append({
        'key': 'continue_reading',
        'title': 'Continue Reading / Listening',
        'subtitle': 'Resume where you left off',
        'layout_type': 'carousel',
        'priority': 20,
        'items': get_home_dashboard_seed(actor)['continue_reading'],
        'empty_state': {'message': 'Start reading or listening to build momentum.'},
        'analytics_payload': {'actor': actor.identity_key},
    })
    dashboard.append({
        'key': 'library_home',
        'title': 'Your Library',
        'subtitle': 'Bookmarks, progress, and trending items',
        'layout_type': 'stack',
        'priority': 30,
        'items': [get_library_home(actor)],
        'analytics_payload': {'actor': actor.identity_key},
    })
    dashboard.append({
        'key': 'panchaang_today',
        'title': 'Today’s Panchaang',
        'subtitle': 'A practical spiritual timing lens',
        'layout_type': 'card',
        'priority': 40,
        'items': [get_today_panchaang(actor)],
        'analytics_payload': {'actor': actor.identity_key},
    })
    dashboard.append({
        'key': 'recommended_for_you',
        'title': 'Recommended For You',
        'subtitle': 'Built from your recent activity',
        'layout_type': 'grid',
        'priority': 50,
        'items': RecommendationService.build_home_feed(actor)['items'],
        'analytics_payload': {'actor': actor.identity_key},
    })
    dashboard.append({
        'key': 'quiz_summary',
        'title': 'Quiz Performance',
        'subtitle': 'Your current learning rhythm',
        'layout_type': 'stats',
        'priority': 60,
        'items': [get_quiz_stats(actor)],
        'analytics_payload': {'actor': actor.identity_key},
    })
    return sorted(dashboard, key=lambda item: item['priority'])
