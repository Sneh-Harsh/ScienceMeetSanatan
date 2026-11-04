import re
from datetime import datetime

from django.test import SimpleTestCase

QUERY = "/api/kundali?date=1995-08-15&time=10:30&lat=25.5941&lon=85.1376&tz=Asia/Kolkata"


class KundaliReadingTests(SimpleTestCase):
    databases = {"default"}

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        from django.test import Client

        cls.data = Client().get(QUERY, HTTP_HOST="localhost").json()

    def test_chart_is_unchanged_and_reading_is_added(self):
        d = self.data
        self.assertEqual(d["lagna"], "Tula")
        self.assertEqual(d["nakshatra"], "Revati")
        self.assertIn("reading", d)
        for key in ("snapshot", "personality", "areas", "phase", "doshas", "remedies", "dasha"):
            self.assertIn(key, d["reading"])

    def test_antardashas_fill_each_mahadasha_exactly(self):
        for maha in self.data["reading"]["dasha"]:
            subs = maha["antardashas"]
            self.assertEqual(len(subs), 9)
            self.assertEqual(subs[0]["planet"], maha["planet"])  # the sub-periods start with the main lord
            self.assertEqual(subs[0]["start"][:16], maha["start"][:16])
            self.assertEqual(subs[-1]["end"][:16], maha["end"][:16])

    def test_only_one_current_period_and_it_matches_the_engine(self):
        r = self.data["reading"]
        current = [m for m in r["dasha"] if m["isCurrent"]]
        self.assertEqual(len(current), 1)
        self.assertEqual(current[0]["planet"], self.data["dasha_experience"]["current_mahadasha"]["planet"])
        sub = [s for s in current[0]["antardashas"] if s["isCurrent"]]
        self.assertEqual(sub[0]["planet"], self.data["dasha_experience"]["current_antardasha"]["planet"])

    def test_reading_uses_the_charts_own_placements(self):
        r = self.data["reading"]
        text = " ".join(r["personality"]["paragraphs"])
        self.assertIn("Libra", text)    # rising sign
        self.assertIn("Pisces", text)   # Moon sign
        self.assertIn("Revati", text)
        planets = [c["planet"] for c in r["remedies"]["planets"]]
        self.assertIn(self.data["dasha_experience"]["current_mahadasha"]["planet"], planets)

    def test_plain_language_has_no_house_numbers_in_phase_text(self):
        phase = self.data["reading"]["phase"]
        blob = " ".join(phase["paragraphs"] + phase.get("do", []) + [phase.get("caution", "")])
        self.assertIsNone(re.search(r"\bhouse \d", blob))

    def test_detected_doshas_come_from_the_engine(self):
        engine = {d["name"]: d["detected"] for d in self.data["dosha_analysis"]}
        for d in self.data["reading"]["doshas"]:
            self.assertEqual(d["detected"], engine[d["name"]])

    def test_remedies_carry_the_gemstone_caution(self):
        self.assertIn("astrologer", self.data["reading"]["remedies"]["disclaimer"])
        for card in self.data["reading"]["remedies"]["planets"]:
            self.assertTrue(card["gem"]["note"])
