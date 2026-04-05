import json

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, login as auth_login
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db.models import Sum
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.http import require_GET, require_POST

from .models import LoginAttempt
from .baby_names_data import load_baby_names_json
from .library_data import PRESET_LIBRARY_CATEGORIES, build_library_payload, get_library_item, load_library_items
from .models import Category, QuizAttempt, UserStats


def login_page(request):
    mode = request.GET.get('mode', 'login')

    if request.method == 'POST':
        form_type = request.POST.get('form_type', 'login')

        if form_type == 'signup':
            full_name = request.POST.get('name', '').strip()
            username = request.POST.get('username', '').strip()
            email = request.POST.get('email', '').strip()
            password = request.POST.get('password', '')

            if not full_name or not username or not email or not password:
                messages.error(request, 'Please fill all signup fields.')
                mode = 'signup'
            elif User.objects.filter(username=username).exists():
                messages.error(request, 'Username already exists. Please choose another one.')
                mode = 'signup'
            elif User.objects.filter(email=email).exists():
                messages.error(request, 'Email already registered. Please use a different email.')
                mode = 'signup'
            else:
                first_name = full_name
                last_name = ''
                if ' ' in full_name:
                    first_name, last_name = full_name.split(' ', 1)

                User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                )
                messages.success(request, 'Signup successful. Please log in with your new account.')
                return redirect('/?mode=login')

        elif form_type == 'reset_password':
            username = request.POST.get('username', '').strip()
            email = request.POST.get('email', '').strip()
            new_password = request.POST.get('new_password', '')
            confirm_password = request.POST.get('confirm_password', '')

            if not username or not email or not new_password or not confirm_password:
                messages.error(request, 'Please fill all password reset fields.')
                mode = 'forgot'
            elif new_password != confirm_password:
                messages.error(request, 'New password and confirm password do not match.')
                mode = 'forgot'
            else:
                try:
                    user = User.objects.get(username=username, email__iexact=email)
                except User.DoesNotExist:
                    user = None

                if user is None:
                    messages.error(request, 'No account matched that username and email.')
                    mode = 'forgot'
                else:
                    user.set_password(new_password)
                    user.save(update_fields=['password'])
                    messages.success(request, 'Password updated successfully. Please log in with your new password.')
                    return redirect('/?mode=login')

        else:
            username = request.POST.get('username', '').strip()
            password = request.POST.get('password', '')
            user = authenticate(request, username=username, password=password)
            success = user is not None
            LoginAttempt.objects.create(username=username or 'unknown', provider=LoginAttempt.PROVIDER_PASSWORD, success=success)

            if success and user is not None:
                auth_login(request, user)

                if user.is_staff or user.is_superuser:
                    messages.success(request, 'Login successful. Redirected to Django admin.')
                    return redirect('/admin/')

                return redirect('/welcome/')

            messages.error(request, 'Invalid username or password.')

    return render(
        request,
        'index.html',
        {
            'mode': mode,
            'google_oauth_configured': settings.GOOGLE_OAUTH_CONFIGURED,
            'apple_oauth_configured': settings.APPLE_OAUTH_CONFIGURED,
        },
    )


def google_login_start(request):
    if not settings.SOCIAL_AUTH_ENABLED:
        messages.error(request, 'Google login is unavailable because social-auth package is not installed.')
        return redirect('/?mode=login')

    if not settings.GOOGLE_OAUTH_CONFIGURED:
        messages.error(
            request,
            'Google OAuth is not configured. Set SOCIAL_AUTH_GOOGLE_OAUTH2_KEY and SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET.',
        )
        return redirect('/?mode=login')

    return redirect(reverse('social:begin', args=['google-oauth2']))


def apple_login_start(request):
    if not settings.SOCIAL_AUTH_ENABLED:
        messages.error(request, 'Apple login is unavailable because social-auth package is not installed.')
        return redirect('/?mode=login')

    if not settings.APPLE_OAUTH_CONFIGURED:
        messages.error(
            request,
            'Apple OAuth is not configured. Set SOCIAL_AUTH_APPLE_ID_CLIENT, TEAM, KEY and valid SECRET/PEM key.',
        )
        return redirect('/?mode=login')

    return redirect(reverse('social:begin', args=['apple-id']))


@login_required
def welcome_page(request):
    return render(request, 'welcome.html')

@login_required
def baby_names_page(request):
    baby_names_error = ""
    baby_names_json = "{}"
    try:
        baby_names_json = load_baby_names_json()
    except Exception as exc:
        baby_names_error = str(exc)

    return render(
        request,
        'baby_names.html',
        {
            "baby_names_json": baby_names_json,
            "baby_names_error": baby_names_error,
        },
    )


@login_required
def quizzes_page(request):
    return render(request, "quizzes.html")


@login_required
def panchang_page(request):
    return render(request, "panchang.html")


@login_required
def kundali_page(request):
    return render(request, "kundali.html")


@login_required
def horoscope_page(request):
    return render(request, "horoscope.html")


@login_required
def profile_page(request):
    if request.method == "POST":
        form_type = request.POST.get("form_type", "").strip()

        if form_type == "profile":
            full_name = request.POST.get("name", "").strip()
            username = request.POST.get("username", "").strip()
            email = request.POST.get("email", "").strip()

            if not full_name or not username or not email:
                messages.error(request, "Please fill all profile fields.")
            elif User.objects.exclude(pk=request.user.pk).filter(username=username).exists():
                messages.error(request, "That username is already taken.")
            elif User.objects.exclude(pk=request.user.pk).filter(email__iexact=email).exists():
                messages.error(request, "That email is already used by another account.")
            else:
                first_name = full_name
                last_name = ""
                if " " in full_name:
                    first_name, last_name = full_name.split(" ", 1)

                request.user.username = username
                request.user.email = email
                request.user.first_name = first_name
                request.user.last_name = last_name
                request.user.save(update_fields=["username", "email", "first_name", "last_name"])
                messages.success(request, "Profile updated successfully.")
                return redirect("/profile/")

        elif form_type == "password":
            current_password = request.POST.get("current_password", "")
            new_password = request.POST.get("new_password", "")
            confirm_password = request.POST.get("confirm_password", "")

            if not current_password or not new_password or not confirm_password:
                messages.error(request, "Please fill all password fields.")
            elif new_password != confirm_password:
                messages.error(request, "New password and confirm password do not match.")
            elif not request.user.check_password(current_password):
                messages.error(request, "Current password is incorrect.")
            else:
                request.user.set_password(new_password)
                request.user.save(update_fields=["password"])
                update_session_auth_hash(request, request.user)
                messages.success(request, "Password changed successfully.")
                return redirect("/profile/")

    full_name = " ".join(filter(None, [request.user.first_name, request.user.last_name])).strip() or request.user.username
    return render(
        request,
        "profile.html",
        {
            "full_name": full_name,
        },
    )


@login_required
def library_page(request):
    library_error = ""
    payload = {"items": [], "featured": [], "categories": [], "total": 0}
    try:
        payload = build_library_payload()
    except Exception as exc:
        library_error = str(exc)

    return render(
        request,
        "library.html",
        {
            "library_payload": json.dumps(payload),
            "library_payload_obj": payload,
            "library_categories": PRESET_LIBRARY_CATEGORIES,
            "library_error": library_error,
        },
    )


@login_required
def library_detail_page(request, slug: str):
    item = get_library_item(slug)
    if item is None:
        return redirect("/library/")

    return render(
        request,
        "library_detail.html",
        {
            "item_slug": item["slug"],
            "item_name": item["name"],
        },
    )


@login_required
@require_GET
def api_library_items(request):
    refresh = request.GET.get("refresh") == "1"
    try:
        items = load_library_items(force_refresh=refresh)
    except Exception as exc:
        return JsonResponse({"items": [], "error": str(exc)}, status=502)

    query = str(request.GET.get("q") or "").strip().lower()
    category = str(request.GET.get("category") or "").strip().lower()
    language = str(request.GET.get("language") or "").strip().lower()

    filtered = items
    if category and category != "all":
        filtered = [item for item in filtered if item["category"].lower() == category]

    if language and language != "all":
        filtered = [
            item
            for item in filtered
            if item.get("languages", {}).get(language)
        ]

    if query:
        filtered = [
            item
            for item in filtered
            if query in item["name"].lower()
            or query in item.get("deity", "").lower()
            or query in item["category"].lower()
            or any(query in text.lower() for text in item.get("languages", {}).values() if text)
        ]

    return JsonResponse(
        {
            "items": filtered,
            "categories": list(PRESET_LIBRARY_CATEGORIES),
            "total": len(filtered),
            "debug_total_before_filters": len(items),
        }
    )


@login_required
@require_GET
def api_library_detail(request, slug: str):
    item = get_library_item(slug)
    if item is None:
        return JsonResponse({"error": "Library item not found."}, status=404)
    return JsonResponse(item)


def _category_display_name(category_slug: str) -> str:
    mapping = {
        "gita": "Bhagavad Gita",
        "ramayana": "Ramayana",
        "mahabharata": "Mahabharata",
        "vedic_science": "Vedic Science",
    }
    return mapping.get(category_slug, category_slug.replace("_", " ").title())


@login_required
@require_GET
def api_leaderboard(request):
    top = (
        UserStats.objects.select_related("user")
        .order_by("-total_score", "-highest_score", "user__username")[:20]
    )
    data = [{"username": row.user.username, "score": row.total_score} for row in top]
    return JsonResponse(data, safe=False)


@login_required
@require_GET
def api_leaderboard_category(request, category_slug: str):
    category_slug = (category_slug or "").strip().lower()
    try:
        category = Category.objects.get(slug=category_slug)
    except Category.DoesNotExist:
        return JsonResponse([], safe=False)

    rows = (
        QuizAttempt.objects.filter(category=category)
        .values("user__username")
        .annotate(score=Sum("score"))
        .order_by("-score", "user__username")[:20]
    )
    data = [{"username": r["user__username"], "score": int(r["score"] or 0)} for r in rows]
    return JsonResponse(data, safe=False)


@login_required
@require_POST
def api_submit_score(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)

    category_slug = str(payload.get("category") or "").strip().lower()
    if not category_slug:
        return JsonResponse({"error": "Missing category."}, status=400)

    try:
        score = int(payload.get("score"))
        total = int(payload.get("total"))
    except Exception:
        return JsonResponse({"error": "score and total must be integers."}, status=400)

    try:
        attempt_best_streak = int(payload.get("best_streak") or 0)
    except Exception:
        attempt_best_streak = 0

    if total <= 0 or score < 0 or score > total:
        return JsonResponse({"error": "Invalid score/total range."}, status=400)

    category, _ = Category.objects.get_or_create(
        slug=category_slug,
        defaults={"name": _category_display_name(category_slug)},
    )

    QuizAttempt.objects.create(
        user=request.user,
        category=category,
        score=score,
        total_questions=total,
        attempt_best_streak=max(attempt_best_streak, 0),
    )

    stats, _ = UserStats.objects.get_or_create(user=request.user)
    stats.total_score = int(stats.total_score) + score
    stats.highest_score = max(int(stats.highest_score), score)
    stats.best_streak = max(int(stats.best_streak), max(attempt_best_streak, 0))
    stats.save(update_fields=["total_score", "highest_score", "best_streak", "updated_at"])

    return JsonResponse(
        {
            "ok": True,
            "user_stats": {
                "username": request.user.username,
                "total_score": stats.total_score,
                "highest_score": stats.highest_score,
                "best_streak": stats.best_streak,
            },
        }
    )
