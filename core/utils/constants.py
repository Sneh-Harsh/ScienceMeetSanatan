from django.db import models


class ProfileType(models.TextChoices):
    SELF = 'self', 'Self'
    SPOUSE = 'spouse', 'Spouse'
    CHILD = 'child', 'Child'
    PARENT = 'parent', 'Parent'
    OTHER = 'other', 'Other'


class ContentType(models.TextChoices):
    LIBRARY_BOOK = 'library_book', 'Library Book'
    LIBRARY_AUDIO = 'library_audio', 'Library Audio'
    MANTRA = 'mantra', 'Mantra'
    ARTICLE = 'article', 'Article'
    QUIZ = 'quiz', 'Quiz'
    BABY_NAME = 'baby_name', 'Baby Name'
    PANCHAANG_DAY = 'panchaang_day', 'Panchaang Day'
    KUNDALI_REPORT = 'kundali_report', 'Kundali Report'
    HOROSCOPE_REPORT = 'horoscope_report', 'Horoscope Report'
    OTHER = 'other', 'Other'


class InteractionType(models.TextChoices):
    VIEWED = 'viewed', 'Viewed'
    CLICKED = 'clicked', 'Clicked'
    LIKED = 'liked', 'Liked'
    BOOKMARKED = 'bookmarked', 'Bookmarked'
    STARTED = 'started', 'Started'
    RESUMED = 'resumed', 'Resumed'
    COMPLETED = 'completed', 'Completed'
    SHARED = 'shared', 'Shared'
    SEARCHED = 'searched', 'Searched'
    RATED = 'rated', 'Rated'
    DOWNLOADED = 'downloaded', 'Downloaded'


class ProgressContentType(models.TextChoices):
    BOOK = 'book', 'Book'
    AUDIO = 'audio', 'Audio'
    ARTICLE = 'article', 'Article'
    SCRIPTURE = 'scripture', 'Scripture'
    CHANT_COURSE = 'chant_course', 'Chant Course'


class RecommendationType(models.TextChoices):
    HOME_FEED = 'home_feed', 'Home Feed'
    LIBRARY = 'library', 'Library'
    MANTRA = 'mantra', 'Mantra'
    QUIZ = 'quiz', 'Quiz'
    BABY_NAMES = 'baby_names', 'Baby Names'
    ASTROLOGY = 'astrology', 'Astrology'


class HoroscopeType(models.TextChoices):
    DAILY = 'daily', 'Daily'
    WEEKLY = 'weekly', 'Weekly'
    MONTHLY = 'monthly', 'Monthly'


class HoroscopeSignType(models.TextChoices):
    SUN = 'sun', 'Sun'
    MOON = 'moon', 'Moon'
    LAGNA = 'lagna', 'Lagna'
    CHART_BASED = 'chart_based', 'Chart Based'
