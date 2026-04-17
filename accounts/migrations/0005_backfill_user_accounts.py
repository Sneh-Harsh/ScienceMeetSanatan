from django.db import migrations


def backfill_user_accounts(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    UserAccount = apps.get_model('accounts', 'UserAccount')

    for user in User.objects.all().iterator():
        full_name = " ".join(part for part in [user.first_name, user.last_name] if part).strip()
        UserAccount.objects.get_or_create(
            user=user,
            defaults={
                'full_name': full_name,
                'preferred_language': 'en',
                'onboarding_completed': False,
            },
        )


def noop_reverse(apps, schema_editor):
    return None


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0004_useraccount_personprofile_guestprofile_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_user_accounts, noop_reverse),
    ]
