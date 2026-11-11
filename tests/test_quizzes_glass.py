"""The liquid-glass quizzes page: markup, assets and app-mode wiring."""
import re
from pathlib import Path

from django.test import SimpleTestCase, override_settings

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "accounts" / "static"
LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "quizzes-glass-tests"}}


@override_settings(CACHES=LOCMEM)
class QuizzesGlassPageTests(SimpleTestCase):
    databases = {"default"}

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

    def page(self):
        response = self.client.get("/quizzes/", HTTP_HOST="localhost")
        self.assertEqual(response.status_code, 200)
        return response.content.decode()

    def test_page_has_the_background_layers_and_the_dock(self):
        html = self.page()
        for marker in ('id="lgSky"', 'id="lgFx"', 'id="lgDock"', 'id="lgPlay"', "quizzes-glass.css", "quizzes-glass.js"):
            self.assertIn(marker, html)
        self.assertNotIn('id="ambient-canvas"', html)  # the old flat particle canvas is gone
        self.assertEqual(html.count("<h1"), 1)

    def test_every_dock_item_points_at_a_real_section(self):
        html = self.page()
        targets = re.findall(r'data-target="([A-Za-z]+)"', html.split('id="lgDock"')[1].split("</nav>")[0])
        self.assertEqual(targets, ["secHome", "secDaily", "leaderboardSection", "secWorlds"])
        for target in targets:
            self.assertIn(f'id="{target}"', html, target)

    def test_scripts_load_in_the_right_order(self):
        html = self.page()
        self.assertLess(html.index("quizzes.js"), html.index("quizzes-glass.js"))
        self.assertLess(html.index("popup_gate.js"), html.index("login_popup.js"))

    def test_stylesheet_has_the_glass_recipe_and_the_phone_app_mode(self):
        css = (STATIC / "quizzes-glass.css").read_text(encoding="utf-8")
        self.assertIn("backdrop-filter", css)
        self.assertIn("@media (max-width:760px)", css)
        self.assertIn("body.lg-screen-hub .lg-dock", css)                       # dock only on the hub
        self.assertIn("body.lg-screen-quiz .nav--quiz", css)                    # immersive quiz screen
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn("prefers-reduced-transparency", css)
        self.assertIn("#quiz-screen.active", css)                               # old black background removed

    def test_background_is_a_quiz_stage_not_generic_liquid(self):
        js = (STATIC / "quizzes-glass.js").read_text(encoding="utf-8").lower()
        for needle in ("spotlight", "beam(", "questionsprite", "orbsprite", "knowledge network", "countdown", "quiz events",
                       "webglcontextlost", "prefers-reduced-motion", "visibilitychange", "document.fonts"):
            self.assertIn(needle, js, needle)
        for gone in ("glass spheres: refract", "caustics"):
            self.assertNotIn(gone, js, gone)  # the generic liquid scene is gone

    def test_topic_cards_have_the_travelling_border_light(self):
        css = (STATIC / "quizzes-glass.css").read_text(encoding="utf-8")
        js = (STATIC / "quizzes-glass.js").read_text(encoding="utf-8")
        self.assertIn("@property --lg-angle", css)
        self.assertIn("conic-gradient(from var(--lg-angle)", css)
        self.assertIn(".browse-card.is-lit::before", css)           # only cards on screen animate
        self.assertIn(".browse-card.is-live", css)                  # live lanes glow brighter
        self.assertIn("color-mix(in srgb,var(--c1)", css)           # tinted by each topic's own colours
        self.assertRegex(css, r"@media \(prefers-reduced-motion:reduce\)\{[^}]*browse-card::before")
        for needle in ("lightCard", "--c1", "IntersectionObserver", "is-live", "--lg-delay"):
            self.assertIn(needle, js, needle)

    def test_every_topic_card_has_two_accent_colours_to_light_it(self):
        data = (STATIC / "quiz-categories-data.js").read_text(encoding="utf-8")
        accents = re.findall(r'accent: "linear-gradient\(135deg,(#[0-9a-fA-F]{6}),(#[0-9a-fA-F]{6})\)"', data)
        self.assertGreaterEqual(len(accents), 40)
        self.assertEqual(len(accents), data.count("accent:"))

    def test_quiz_logic_was_not_touched(self):
        js = (STATIC / "quizzes.js").read_text(encoding="utf-8")
        for needle in ("/api/quiz-session/", "/api/quiz-answer/", "/api/submit-score/", "IS_AUTHENTICATED"):
            self.assertIn(needle, js)
