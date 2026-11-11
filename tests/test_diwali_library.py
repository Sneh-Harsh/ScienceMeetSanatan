"""The Diwali aarti, mantras and bhajans in the library."""
import re

from django.test import SimpleTestCase, override_settings

from accounts import library_data

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "diwali-library-tests"}}
DIWALI = {
    "laxmi-aarti": "Aartis",
    "jai-jagdish-hare": "Aartis",
    "diwali-puja-mantras": "Mantras",
    "mahalakshmi-ashtakam": "Sacred Hymns",
    "shri-suktam": "Sacred Hymns",
    "shri-ram-chandra-kripalu-bhajman": "Bhajans",
}


@override_settings(CACHES=LOCMEM, LIBRARY_LOCAL_DIR="", LIBRARY_DRIVE_FOLDER_ID="")
class DiwaliLibraryTests(SimpleTestCase):
    databases = {"default"}

    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.items = {i["slug"]: i for i in library_data.load_library_items(force_refresh=True)}

    def test_all_diwali_items_are_in_the_library_in_the_right_category(self):
        for slug, category in DIWALI.items():
            self.assertIn(slug, self.items, slug)
            self.assertEqual(self.items[slug]["category"], category, slug)

    def test_laxmi_aarti_has_the_full_text_and_a_meaning(self):
        item = self.items["laxmi-aarti"]
        hindi = item["languages"]["hindi"]
        self.assertTrue(hindi.startswith("ॐ जय लक्ष्मी माता"))
        self.assertGreaterEqual(hindi.count("ॐ जय लक्ष्मी माता"), 8)       # the refrain after every verse
        self.assertIn("उर आनन्द समाता, पाप उतर जाता", hindi)                # last verse is present
        self.assertIn("Mahalakshmi", item["languages"]["english"])
        self.assertTrue(item["featured"])
        self.assertIn("Lakshmi", item["deity_tags"])

    def test_every_item_has_text_and_a_meaning(self):
        for slug in DIWALI:
            langs = self.items[slug]["languages"]
            self.assertGreater(len(langs["hindi"]), 80, slug)
            self.assertGreater(len(langs["english"]), 80, slug)
            self.assertTrue(self.items[slug]["excerpt"], slug)

    def test_puja_mantras_come_in_the_traditional_order_and_are_complete(self):
        sanskrit = self.items["diwali-puja-mantras"]["languages"]["sanskrit"]
        order = ["वक्रतुण्ड महाकाय", "शुभं करोति कल्याणम्", "या सा पद्मासनस्था", "या देवी सर्वभूतेषु लक्ष्मीरूपेण",
                 "ॐ श्रीं ह्रीं श्रीं कमले कमलालये", "ॐ महालक्ष्म्यै च विद्महे", "ॐ यक्षाय कुबेराय"]
        positions = [sanskrit.find(m) for m in order]
        self.assertTrue(all(p >= 0 for p in positions), positions)
        self.assertEqual(positions, sorted(positions))

    def test_ashtakam_has_eight_verses_and_the_phala_shruti(self):
        text = self.items["mahalakshmi-ashtakam"]["languages"]["sanskrit"]
        for n in "१२३४५६७८९":
            self.assertIn(f"॥{n}॥", text)
        self.assertEqual(len(re.findall(r"महालक्ष्मि नमोऽस्तु ते", text)), 8)

    def test_pages_and_api_serve_the_new_items(self):
        for slug in ("laxmi-aarti", "diwali-puja-mantras"):
            self.assertEqual(self.client.get(f"/aartis/{slug}/", HTTP_HOST="localhost").status_code, 200, slug)
            self.assertEqual(self.client.get(f"/library/{slug}/", HTTP_HOST="localhost").status_code, 200, slug)
        listing = self.client.get("/api/library/", HTTP_HOST="localhost").json()
        rows = listing.get("items") or listing.get("results") or listing
        self.assertIn("laxmi-aarti", {r["slug"] for r in rows})
