"""The personalised horoscope: every block must be chart-derived, in the Krishna voice, and non-repeating."""
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase

from kundali.astro_facts import FAVOURABLE, VEDHA, Chart, day_timings
from kundali.calculations import build_kundali
from kundali.dasha_levels import antardashas, levels_at
from kundali.horoscope_engine import build_horoscope

A = dict(date_str="1998-04-12", time_str="06:30", lat=28.6139, lon=77.209, tz_name="Asia/Kolkata", specific_year=2027)
B = dict(date_str="1986-11-03", time_str="21:15", lat=19.076, lon=72.8777, tz_name="Asia/Kolkata", specific_year=2027)
PREFIX = "Krishna says"


def sentences(text):
    text = re.sub(r"^Krishna says:\s*", "", text)
    return [s.strip().lower() for s in re.split(r"(?<=[.;])\s+", text) if len(s.strip()) > 45]


class KrishnaVoiceTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.a = build_horoscope(**A)
        cls.b = build_horoscope(**B)

    def scopes(self, data):
        return [(k, data[k]) for k in ("daily", "weekly", "monthly", "yearly", "specific_year")]

    def test_every_written_block_starts_with_krishna_says(self):
        for data in (self.a, self.b):
            self.assertTrue(data["natal"]["note"].startswith(PREFIX))
            for name, sc in self.scopes(data):
                texts = [sc["headline"], sc["summary"], sc["focus"], sc["spiritualNote"], sc["advice"], sc["adviceParts"]["timing"], sc["adviceParts"]["posture"], sc["lucky"]["why"]]
                texts += list(sc["details"].values())
                for t in texts:
                    self.assertTrue(t.startswith(PREFIX), f"{name}: {t[:60]}")
            w = data["wealth_alignment"]
            for t in [w["riskStyleRationale"], w["disclaimer"], *w["actionPoints"], w["astroBasis"]["dashaImpact"], w["astroBasis"]["transitImpact"]]:
                self.assertTrue(t.startswith(PREFIX), t[:60])
            for row in w["recommendedIndustries"] + w["cautionIndustries"]:
                self.assertTrue(row["rationale"].startswith(PREFIX))

    def test_no_sentence_repeats_inside_one_reading(self):
        for data in (self.a, self.b):
            for name, sc in self.scopes(data):
                seen = {}
                blocks = {**sc["details"], "spiritual": sc["spiritualNote"], "summary": sc["summary"], "headline": sc["headline"]}
                for label, text in blocks.items():
                    for sent in sentences(text):
                        self.assertNotIn(sent, seen, f"{name}: '{sent[:70]}' in {label} and {seen.get(sent)}")
                        seen[sent] = label

    def test_tabs_do_not_share_whole_paragraphs(self):
        for data in (self.a, self.b):
            paras = {}
            for name, sc in self.scopes(data):
                for label, text in sc["details"].items():
                    if text in paras and {name, paras[text]} != {"yearly", "specific_year"}:
                        self.fail(f"{label} identical in {name} and {paras[text]}")
                    paras[text] = name

    def test_two_people_get_different_readings(self):
        for key in ("career", "relationships", "finance"):
            self.assertNotEqual(self.a["daily"]["details"][key], self.b["daily"]["details"][key])
        self.assertNotEqual(self.a["natal"]["note"], self.b["natal"]["note"])

    def test_scores_and_structure(self):
        for name, sc in self.scopes(self.a):
            for v in list(sc["scores"].values()) + list(sc["extraScores"].values()):
                self.assertTrue(18 <= v <= 93)
            self.assertEqual(len(sc["timing"]), 4)
            self.assertIn("Chart", " ".join(str(t) for t in ["Chart clarity"]))
            self.assertTrue(52 <= sc["confidence"] <= 90)
        self.assertEqual(len(self.a["weekly"]["events"]), 7)
        self.assertTrue(all(sc["lucky"]["time"] for _, sc in self.scopes(self.a)))

    def test_text_reflects_the_charts_own_facts(self):
        chart = Chart(build_kundali(date_str=A["date_str"], time_str=A["time_str"], lat=A["lat"], lon=A["lon"], tz_name=A["tz_name"]))
        note = self.a["natal"]["note"]
        self.assertIn(chart.lord_of_house[1], note)
        self.assertIn(chart.moon_nak_name, note)
        # 6th lord in the 12th is a Viparita Raja Yoga and must be recognised, not scored as plain weakness
        self.assertIn("Mercury", chart.viparita())
        joined = " ".join(" ".join(sc["details"].values()) for _, sc in self.scopes(self.a))
        self.assertIn("tend to fade over time", joined)  # said in plain words
        why = " ".join(" ".join(v) for v in self.a["daily"]["why"].values())
        self.assertIn("Viparita Raja Yoga", why)  # named in the optional detail


class PlainLanguageTests(SimpleTestCase):
    JARGON = re.compile(r"\b\d+(st|nd|rd|th)[- ]house|\bhouse \d|Gochar|Vedha|dusthana|from your (birth )?Moon|aspect", re.I)

    def test_visible_text_has_no_house_and_planet_placement_jargon(self):
        data = build_horoscope(**A)
        for name in ("daily", "weekly", "monthly", "yearly", "specific_year"):
            sc = data[name]
            texts = [sc["headline"], sc["summary"], sc["focus"], sc["spiritualNote"], sc["adviceParts"]["headline"], sc["adviceParts"]["timing"],
                     sc["adviceParts"]["posture"], sc["lucky"]["why"], *sc["details"].values(), *sc["opportunities"], *sc["cautions"],
                     *[e["text"] for e in sc["events"]], *[t for lines in sc["whyPlain"].values() for t in lines]]
            for t in texts:
                self.assertIsNone(self.JARGON.search(t), f"{name}: {t}")
        w = data["wealth_alignment"]
        for t in [w["riskStyleRationale"], *w["actionPoints"], *[r["rationale"] for r in w["recommendedIndustries"] + w["cautionIndustries"]],
                  w["astroBasis"]["dashaImpact"], w["astroBasis"]["transitImpact"], *w["wealthFacts"], *w["astroBasis"]["cautionSignals"]]:
            self.assertIsNone(self.JARGON.search(t), t)
        self.assertIsNone(self.JARGON.search(data["natal"]["note"]), data["natal"]["note"])

    def test_technical_reasons_stay_in_the_optional_why_list(self):
        data = build_horoscope(**A)
        joined = " ".join(" ".join(v) for v in data["daily"]["why"].values())
        self.assertRegex(joined, r"\d+(st|nd|rd|th) house")


class JyotishRuleTests(SimpleTestCase):
    def test_gochar_tables_are_the_classical_ones(self):
        self.assertEqual(FAVOURABLE["Saturn"], {3, 6, 11})
        self.assertEqual(FAVOURABLE["Jupiter"], {2, 5, 7, 9, 11})
        self.assertEqual(FAVOURABLE["Moon"], {1, 3, 6, 7, 10, 11})
        for planet, table in VEDHA.items():
            self.assertTrue(set(table) <= FAVOURABLE[planet], planet)  # vedha only applies to favourable houses

    def test_antardasha_uses_the_full_nominal_mahadasha(self):
        k = build_kundali(date_str="2010-06-15", time_str="10:00", lat=19.07, lon=72.87, tz_name="Asia/Kolkata")
        first = k["dasha"][0]
        self.assertEqual(first["planet"], "Saturn")
        subs = antardashas(first)
        self.assertEqual(subs[0]["start"][:10], "2010-06-15")
        self.assertEqual(subs[-1]["end"][:16], first["end"][:16])
        self.assertNotEqual(subs[0]["planet"], "Saturn")  # the Saturn-Saturn part had already passed at birth
        full = antardashas(k["dasha"][1])
        self.assertEqual(len(full), 9)
        # Mercury-Mercury is 17y * 17y / 120 = 2.408y long
        self.assertAlmostEqual((datetime.fromisoformat(full[0]["end"]) - datetime.fromisoformat(full[0]["start"])).days / 365.25, 17 * 17 / 120, delta=0.02)

    def test_levels_at_nests_correctly(self):
        k = build_kundali(date_str="1998-04-12", time_str="06:30", lat=28.6139, lon=77.209, tz_name="Asia/Kolkata")
        now = datetime(2026, 11, 5, 15, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
        lv = levels_at(k, now)
        for outer, inner in (("maha", "antar"), ("antar", "praty")):
            self.assertLessEqual(datetime.fromisoformat(lv[outer]["start"]), datetime.fromisoformat(lv[inner]["start"]))
            self.assertGreaterEqual(datetime.fromisoformat(lv[outer]["end"]), datetime.fromisoformat(lv[inner]["end"]))

    def test_day_timings_match_a_known_panchang(self):
        # Thursday 5 Nov 2026, Delhi: sunrise about 6:35, Rahu Kaal about 1:30 to 3 pm, Abhijit near noon
        t = day_timings(datetime(2026, 11, 5, 15, 0, tzinfo=ZoneInfo("Asia/Kolkata")), 28.6139, 77.209)
        self.assertEqual((t["sunrise"].hour, t["sunrise"].minute // 10), (6, 3))
        self.assertIn(t["rahu_kaal"][0].hour, (13,))
        self.assertIn(t["abhijit"][0].hour, (11,))
        self.assertEqual(t["weekday_lord"], "Jupiter")
        self.assertEqual(t["horas"][0]["planet"], "Jupiter")
        self.assertEqual(len(t["horas"]), 12)


class OracleFallbackTests(SimpleTestCase):
    def test_oracle_answers_without_a_model_in_krishna_voice(self):
        os.environ.pop("OPENAI_API_KEY", None)
        from kundali.oracle_service import ask_oracle, build_astro_context

        ctx = build_astro_context(**A)
        marriage = ask_oracle(question="When will I get married?", astro_context=ctx)
        for field in ("directAnswer", "chartBasis", "opportunities", "cautions", "bestTiming", "remedy"):
            self.assertTrue(marriage[field].startswith(PREFIX), field)
        self.assertIn("marriage & partnerships", marriage["bestTiming"])  # dasha / Jupiter windows for the 7th house
        career = ask_oracle(question="Why is my career stuck this week?", astro_context=ctx)
        self.assertNotEqual(marriage["directAnswer"], career["directAnswer"])
        self.assertIn("work and reputation", career["directAnswer"].lower())
