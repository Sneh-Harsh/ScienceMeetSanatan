from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from astrology_consultation.models import TransactionType, Wallet, WalletTransaction


DEFAULT_WELCOME_BALANCE = Decimal('0.00')


def get_or_create_wallet(user):
    wallet, _created = Wallet.objects.get_or_create(user=user, defaults={'balance': DEFAULT_WELCOME_BALANCE})
    return wallet


@transaction.atomic
def credit_wallet(*, user, amount: Decimal, reason: str, session=None, transaction_type: str = TransactionType.CREDIT):
    if amount <= 0:
        raise ValueError('invalid_amount')
    wallet = get_or_create_wallet(user)
    # Single atomic update so concurrent credits cannot overwrite each other.
    Wallet.objects.filter(pk=wallet.pk).update(balance=F('balance') + amount, updated_at=timezone.now())
    WalletTransaction.objects.create(
        user=user,
        amount=amount,
        transaction_type=transaction_type,
        reason=reason,
        session=session,
    )
    wallet.refresh_from_db()
    return wallet


@transaction.atomic
def debit_wallet(*, user, amount: Decimal, reason: str, session=None):
    if amount <= 0:
        raise ValueError('invalid_amount')
    wallet = get_or_create_wallet(user)
    # The balance check and the decrement happen in one atomic update, so parallel
    # requests cannot spend the same money twice.
    updated = Wallet.objects.filter(pk=wallet.pk, balance__gte=amount).update(
        balance=F('balance') - amount, updated_at=timezone.now()
    )
    if not updated:
        raise ValueError('insufficient_balance')
    WalletTransaction.objects.create(
        user=user,
        amount=amount,
        transaction_type=TransactionType.DEBIT,
        reason=reason,
        session=session,
    )
    wallet.refresh_from_db()
    return wallet
