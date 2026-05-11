from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from astrology_consultation.models import TransactionType, Wallet, WalletTransaction


DEFAULT_WELCOME_BALANCE = Decimal('0.00')


def get_or_create_wallet(user):
    wallet, _created = Wallet.objects.get_or_create(user=user, defaults={'balance': DEFAULT_WELCOME_BALANCE})
    return wallet


@transaction.atomic
def credit_wallet(*, user, amount: Decimal, reason: str, session=None, transaction_type: str = TransactionType.CREDIT):
    wallet = get_or_create_wallet(user)
    wallet.balance = wallet.balance + amount
    wallet.save(update_fields=['balance', 'updated_at'])
    WalletTransaction.objects.create(
        user=user,
        amount=amount,
        transaction_type=transaction_type,
        reason=reason,
        session=session,
    )
    return wallet


@transaction.atomic
def debit_wallet(*, user, amount: Decimal, reason: str, session=None):
    wallet = get_or_create_wallet(user)
    if wallet.balance < amount:
        raise ValueError('insufficient_balance')
    wallet.balance = wallet.balance - amount
    wallet.save(update_fields=['balance', 'updated_at'])
    WalletTransaction.objects.create(
        user=user,
        amount=amount,
        transaction_type=TransactionType.DEBIT,
        reason=reason,
        session=session,
    )
    return wallet
