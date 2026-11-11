"""Popups must wait for the shared gate: no timers or scroll triggers of their own."""
import glob
import re
from pathlib import Path

from django.test import SimpleTestCase

ROOT = Path(__file__).resolve().parent.parent
JS = ROOT / "accounts" / "static" / "js"
POPUP_TAGS = ("login_popup.js", "digital_daanpatra.js", "js/review.js")


class PopupGateWiringTests(SimpleTestCase):
    def test_every_page_with_popups_loads_the_gate_first(self):
        pages = [Path(p) for p in glob.glob(str(ROOT / "**" / "templates" / "**" / "*.html"), recursive=True)]
        checked = 0
        for page in pages:
            html = page.read_text(encoding="utf-8")
            positions = [html.find(tag) for tag in POPUP_TAGS if tag in html]
            if not positions:
                continue
            checked += 1
            self.assertIn("popup_gate.js", html, page.name)
            self.assertLess(html.find("popup_gate.js"), min(positions), f"{page.name}: gate must load before the popups")
        self.assertGreaterEqual(checked, 10)

    def test_popups_have_no_timer_or_scroll_triggers_of_their_own(self):
        login = (JS / "login_popup.js").read_text(encoding="utf-8")
        daan = (JS / "digital_daanpatra.js").read_text(encoding="utf-8")
        review = (JS / "review.js").read_text(encoding="utf-8")
        for source in (login, daan, review):
            self.assertIn("SMSPopupGate", source)
        self.assertNotIn("timer_20s", login)
        self.assertNotIn("scroll_40", login)
        self.assertNotIn("time_delay", daan)
        self.assertNotIn("scroll_depth", daan)
        self.assertNotIn('maybeAutoPrompt("time_spent")', review)
        self.assertNotIn('maybeAutoPrompt("scroll_depth")', review)
        # no stray "open the popup after N ms" timers left behind
        self.assertIsNone(re.search(r"setTimeout\(\s*\(\)\s*=>\s*(requestAutoOpen|maybeAutoPrompt)", daan + review))

    def test_gate_rules_are_the_agreed_ones(self):
        gate = (JS / "popup_gate.js").read_text(encoding="utf-8")
        self.assertIn("FIVE_MIN = 5 * 60 * 1000", gate)   # five minutes of real use
        self.assertIn("QUIET_MS = 8 * 1000", gate)         # not while the visitor is interacting
        self.assertIn("GAP_MS = 4 * 60 * 1000", gate)      # one popup at a time
        for guard in ("typingInField", "dialogOpen", "pending > 0", "document.hidden"):
            self.assertIn(guard, gate)
