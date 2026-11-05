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
        for index, maha in enumerate(self.data["reading"]["dasha"]):
            subs = maha["antardashas"]
            self.assertEqual(subs[0]["start"][:16], maha["start"][:16])
            self.assertEqual(subs[-1]["end"][:16], maha["end"][:16])
            for before, after in zip(subs, subs[1:]):
                self.assertEqual(before["end"][:16], after["start"][:16])  # no gaps, no overlaps
            if index > 0:  # only the Mahadasha running at birth is a part-period
                self.assertEqual(len(subs), 9)
                self.assertEqual(subs[0]["planet"], maha["planet"])  # sub-periods start with the main lord

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
        blob = " ".join([phase["gist_maha"], phase["gist_antar"]] + phase.get("do", []) + [phase.get("caution", "")])
        self.assertIsNone(re.search(r"\bhouse \d", blob))

    def test_detected_doshas_come_from_the_engine(self):
        engine = {d["name"]: d["detected"] for d in self.data["dosha_analysis"]}
        for d in self.data["reading"]["doshas"]:
            self.assertEqual(d["detected"], engine[d["name"]])

    def test_remedies_carry_the_gemstone_caution(self):
        self.assertIn("astrologer", self.data["reading"]["remedies"]["disclaimer"])
        for card in self.data["reading"]["remedies"]["planets"]:
            self.assertTrue(card["gem"]["note"])


class AntardashaEffectTests(KundaliReadingTests):
    def test_every_antardasha_has_a_chart_specific_effect(self):
        for maha in self.data["reading"]["dasha"]:
            for sub in maha["antardashas"]:
                e = sub["effect"]
                self.assertIn(e["tone"], {"supportive", "mixed", "challenging"})
                self.assertGreaterEqual(len(e["text"]), 3)
                self.assertIn(sub["planet"], e["headline"])
                self.assertTrue(e["careful"])

    def test_current_phase_effect_matches_current_antardasha(self):
        phase = self.data["reading"]["phase"]
        self.assertEqual(phase["antar_effect"]["headline"].split(":")[0],
                         f"{phase['maha']['planet']} – {phase['antar']['planet']}")

    def test_effect_uses_this_charts_house_for_the_planet(self):
        planets = {p["planet"]: p["house"] for p in self.data["planets"]}
        for sub in self.data["reading"]["dasha"][0]["antardashas"]:
            self.assertEqual(sub["effect"]["house"], planets[sub["planet"]])


class HindiAndRedundancyTests(KundaliReadingTests):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        from django.test import Client

        cls.hi = Client().get(QUERY + "&lang=hi", HTTP_HOST="localhost").json()["reading"]

    def test_hindi_reading_is_devanagari_not_english(self):
        import re

        def english_words(text):
            return re.findall(r"[A-Za-z]{4,}", text)

        texts = [self.hi["personality"]["headline"]] + self.hi["personality"]["paragraphs"] + self.hi["phase"]["gist_maha"].split("|")
        for a in self.hi["areas"]:
            texts += [a["title"], a["summary"], a["tip"]] + a["helps"] + a["watch"]
        for m in self.hi["dasha"]:
            texts.append(m["meaning"])
            for sub in m["antardashas"]:
                texts += sub["effect"]["text"] + [sub["effect"]["summary"], sub["effect"]["careful"]] + sub["effect"]["good_for"]
        for card in self.hi["remedies"]["planets"]:
            texts += [card["why"], card["day"], card["worship"], card["donate"], card["habit"]]
        for d in self.hi["doshas"]:
            texts += [d["plain_name"], d["what"], d["comfort"], d["technical"]] + d["softeners"]
        for d in self.hi["remedies"]["daily"]:
            texts += [d["title"], d["why"], d["when"], d["kind"]]
        leaks = {w for t in texts for w in english_words(t)}
        self.assertEqual(leaks, set(), f"English words in the Hindi reading: {sorted(leaks)}")

    def test_hindi_and_english_describe_the_same_chart(self):
        en = self.data["reading"]
        self.assertEqual(len(en["dasha"]), len(self.hi["dasha"]))
        self.assertEqual([a["verdict"] for a in en["areas"]], [a["verdict"] for a in self.hi["areas"]])
        self.assertEqual([c["planet"] for c in en["remedies"]["planets"]], [c["planet"] for c in self.hi["remedies"]["planets"]])

    def test_no_two_antardasha_texts_repeat_inside_a_mahadasha(self):
        for maha in self.data["reading"]["dasha"]:
            blobs = [" ".join(s["effect"]["text"]) for s in maha["antardashas"]]
            self.assertEqual(len(blobs), len(set(blobs)))

    def test_same_sub_planet_reads_differently_in_different_mahadashas(self):
        seen = {}
        for maha in self.data["reading"]["dasha"]:
            for s in maha["antardashas"]:
                seen.setdefault(s["planet"], []).append(" ".join(s["effect"]["text"]))
        for planet, texts in seen.items():
            self.assertEqual(len(texts), len(set(texts)), planet)

    def test_each_period_states_its_age_range(self):
        for maha in self.data["reading"]["dasha"]:
            self.assertGreaterEqual(maha["ageEnd"], maha["ageStart"])
            self.assertTrue(any("age" in line for s in maha["antardashas"] for line in s["effect"]["text"]))

    def test_reading_only_endpoint_returns_just_the_reading(self):
        from django.test import Client

        j = Client().get(QUERY + "&lang=hi&reading_only=1", HTTP_HOST="localhost").json()
        self.assertEqual(set(j), {"reading", "lang"})
        self.assertEqual(j["lang"], "hi")
