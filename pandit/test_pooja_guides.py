"""Integrity tests for the Pooja Vidhi guide data (pandit/static/pandit/pooja/*.json).

These do not judge religious correctness (that needs a pandit's review); they enforce the rules the page
promises: nothing is marked reviewed unless it was, unfinished guides show no steps, every step is
sourced, mantras are complete, and images are only shown when a real Cloudinary asset is configured.
"""
import json
import re
from pathlib import Path

from django.test import SimpleTestCase

BASE = Path(__file__).resolve().parent / "static" / "pandit" / "pooja"
FORM_PUJAS = [
    "Griha Pravesh Puja", "Satyanarayan Puja", "Rudrabhishek", "Ganesh Puja", "Lakshmi Puja",
    "Navagraha Shanti", "Vastu Shanti", "Bhoomi Puja", "Havan and other rituals",
    "Naamkaran and Mundan Sanskar", "Marriage and Vivah ceremonies", "Other Puja",
]


class PoojaGuideDataTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.guides = json.loads((BASE / "guides.json").read_text(encoding="utf-8"))
        cls.images = json.loads((BASE / "images.json").read_text(encoding="utf-8"))
        cls.by_id = {g["id"]: g for g in cls.guides["guides"]}

    def test_every_form_puja_has_a_guide_entry_with_the_same_name(self):
        self.assertEqual([g["name"]["en"] for g in self.guides["guides"]], FORM_PUJAS)

    def test_ids_are_unique(self):
        ids = [g["id"] for g in self.guides["guides"]]
        self.assertEqual(len(ids), len(set(ids)))

    def test_nothing_is_marked_reviewed_without_a_review(self):
        for g in self.guides["guides"]:
            review = g["review"]
            if review["status"] == "reviewed-approved":
                self.assertTrue(review["reviewedBy"] and review["reviewedOn"], g["id"])
            else:
                self.assertIsNone(review["reviewedBy"], g["id"])
                self.assertIsNone(review["reviewedOn"], g["id"])
        # As of this data version no pandit has reviewed anything.
        self.assertFalse([g["id"] for g in self.guides["guides"] if g["review"]["status"] == "reviewed-approved"])

    def test_unfinished_guides_show_no_ritual_content(self):
        for g in self.guides["guides"]:
            if g["availability"] == "in-preparation":
                self.assertNotIn("steps", g, g["id"])
                self.assertNotIn("preparation", g, g["id"])
                self.assertEqual(g["review"]["status"], "in-preparation")

    def test_documented_guides_are_complete_and_sourced(self):
        documented = [g for g in self.guides["guides"] if g["availability"] == "documented"]
        self.assertGreaterEqual(len(documented), 11)
        for g in documented:
            self.assertEqual(g["review"]["status"], "draft-pandit-review-needed")
            for source in g["sources"]:
                self.assertIn(source, g["sourceMap"], g["id"])
            ids = [s["id"] for s in g["steps"]]
            self.assertEqual(len(ids), len(set(ids)), g["id"])
            samagri = {s["id"] for s in g["preparation"]["samagri"]}
            # every guide starts with cleaning and setting up, before any mantra
            self.assertEqual(g["steps"][0]["group"], "setup", g["id"])
            for step in g["steps"]:
                where = f"{g['id']}:{step['id']}"
                self.assertIn(step["group"], self.guides["groups"], where)
                for lang in ("en", "hi"):
                    self.assertTrue(step["title"][lang], where)
                    self.assertTrue(step["do"][lang], where)
                for cite in step.get("sources", []):
                    self.assertIn(cite["source"], g["sourceMap"], where)
                for mat in step["materials"]:
                    self.assertIn(mat, samagri, where)
                if step["mantras"] or step.get("aarti"):
                    self.assertTrue(step.get("sources"), where + " recites text but cites no source")
                if step.get("pending"):
                    # a partly-pending step may only show texts that were verified against a source
                    self.assertTrue(all(m.get("verified") for m in step["mantras"]), where + ": pending steps must not invent a mantra")
                for m in step["mantras"]:
                    # four forms: Sanskrit, transliteration, Hindi and English meaning
                    self.assertTrue(m["devanagari"] and m["transliteration"], where)
                    self.assertTrue(re.search(r"[ऀ-ॿ]", m["devanagari"]), where)
                    self.assertTrue(m.get("verified"), where + ": mantra not verified against its saved source")
                    for lang in ("en", "hi"):
                        self.assertTrue(m["meaning"][lang], where)
                a = step.get("aarti")
                if a:
                    self.assertTrue(a["lyrics"] and a["transliteration"] and a.get("verified"), where)
                    for lang in ("en", "hi"):
                        self.assertTrue(a["meaning"][lang], where)
            self.assertTrue([s for s in g["steps"] if s.get("aarti")], g["id"] + " has no aarti")

    def test_havan_is_not_forced_into_guides_that_do_not_document_it(self):
        for g in self.guides["guides"]:
            if g["availability"] == "documented" and g.get("havanNote"):
                self.assertFalse([s["id"] for s in g["steps"] if "havan" in s["id"]], g["id"])

    def test_havan_guide_has_fire_safety_first(self):
        steps = self.by_id["havan"]["steps"]
        self.assertIn("safety-first", [s["id"] for s in steps])
        self.assertLess([s["id"] for s in steps].index("safety-first"), [s["id"] for s in steps].index("lamp-and-agni-sthapana"))

    def test_lamp_and_camphor_steps_carry_a_safety_note(self):
        for gid in ("ganesh-puja", "lakshmi-puja"):
            by_step = {s["id"]: s for s in self.by_id[gid]["steps"]}
            for sid in ("lamp", "dhupam", "dipam", "aarti"):
                self.assertIn("safety", by_step[sid], f"{gid}:{sid}")

    def test_deity_specific_content_is_not_shared(self):
        ganesh = [s["id"] for s in self.by_id["ganesh-puja"]["steps"]]
        lakshmi = [s["id"] for s in self.by_id["lakshmi-puja"]["steps"]]
        self.assertIn("stotra", ganesh)
        self.assertNotIn("stotra", lakshmi)
        def avahana(gid):
            step = next(s for s in self.by_id[gid]["steps"] if s["id"] == "avahana")
            return step["mantras"][0]["devanagari"]
        self.assertIn("गणेश", avahana("ganesh-puja"))
        self.assertIn("लक्ष्मी", avahana("lakshmi-puja"))


class PoojaImageConfigTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.guides = json.loads((BASE / "guides.json").read_text(encoding="utf-8"))
        cls.images = json.loads((BASE / "images.json").read_text(encoding="utf-8"))

    def test_every_guide_has_an_image_entry(self):
        for g in self.guides["guides"]:
            self.assertIn(g["id"], self.images["images"], g["id"])

    def test_placeholders_never_pretend_to_be_photographs(self):
        for gid, cfg in self.images["images"].items():
            if cfg["status"] == "placeholder":
                self.assertIsNone(cfg["publicId"], gid)
            else:
                self.assertEqual(cfg["status"], "supplied", gid)
                self.assertTrue(cfg["publicId"], gid)
                self.assertTrue(cfg["alt"], gid)
                self.assertIn(cfg["resourceType"], ("image", "video"), gid)

    def test_no_secrets_in_the_image_config(self):
        text = json.dumps(self.images).lower()
        for needle in ("api_secret", "api_key", "cloudinary://", "secret\":", "password"):
            self.assertNotIn(needle, text)
        self.assertEqual(self.images["cloudName"], "dmnm8z8dc")
