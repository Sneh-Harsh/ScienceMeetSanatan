from dataclasses import dataclass
from typing import Optional

from django.contrib.auth.models import AnonymousUser, User

from accounts.models import GuestProfile


@dataclass(frozen=True)
class Actor:
    user: Optional[User] = None
    guest_profile: Optional[GuestProfile] = None

    @property
    def is_authenticated(self) -> bool:
        return bool(self.user and not isinstance(self.user, AnonymousUser))

    @property
    def identity_key(self) -> str:
        if self.user:
            return f'user:{self.user.pk}'
        if self.guest_profile:
            return f'guest:{self.guest_profile.guest_uuid}'
        return 'guest:unknown'
