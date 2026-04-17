from core.utils.actors import Actor
from .selectors import get_home_dashboard


def build_dashboard_modules(actor: Actor):
    return get_home_dashboard(actor)
