from django.test import SimpleTestCase

from accounts.baby_names_data import load_baby_names


class BabyNamesTests(SimpleTestCase):
    databases = {"default"}

    def test_every_deity_has_names_for_both_genders(self):
        data = load_baby_names()
        for gender in ("girl", "boy"):
            self.assertEqual(len(data[gender]), 9, gender)
            for deity, letters in data[gender].items():
                self.assertGreaterEqual(sum(len(v) for v in letters.values()), 10, f"{gender} {deity}")

    def test_no_placeholder_or_duplicate_rows(self):
        data = load_baby_names()
        for gender, deities in data.items():
            for deity, letters in deities.items():
                seen = set()
                for letter, items in letters.items():
                    for item in items:
                        self.assertTrue(item["name"].upper().startswith(letter))
                        self.assertNotIn(item["name"].lower(), {"asdf", "adkn", "ahgsdytfw"})
                        self.assertFalse(item["meaning"].isalpha() and len(item["meaning"]) >= 12, item)
                        self.assertNotIn(item["name"].lower(), seen, (gender, deity, item["name"]))
                        seen.add(item["name"].lower())

    def test_page_has_search_saved_and_cards(self):
        html = self.client.get("/baby-names/").content.decode()
        for term in ('id="bnSearch"', 'id="bnSavedBtn"', 'id="deityGrid"', 'data-gender="boy"', "babyNamesData"):
            self.assertIn(term, html)

    def test_background_and_surprise_wired(self):
        html = self.client.get("/baby-names/").content.decode()
        self.assertIn("baby_names_bg.js", html)
        self.assertIn('id="bnSurprise"', html)
        js = open("accounts/static/baby_names_bg.js", encoding="utf-8").read()
        for term in ("prefers-reduced-motion", "visibilitychange", "pickLetter", "data-gender"):
            self.assertIn(term, js)
