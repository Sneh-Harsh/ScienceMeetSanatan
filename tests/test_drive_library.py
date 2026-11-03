import tempfile
from pathlib import Path

from django.test import RequestFactory, SimpleTestCase, override_settings

from accounts import drive_library

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "drive-library-tests"}}


def make_pdf(path: Path, body: bytes = b"%PDF-1.4\n%test\n"):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)


@override_settings(CACHES=LOCMEM)
class DriveLibraryTests(SimpleTestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        make_pdf(self.root / "Gita" / "bhagavad_gita_as_it_is.pdf")
        make_pdf(self.root / "Gita" / "02 - gita-press-hindi.pdf")
        make_pdf(self.root / "Purans" / "shiv-puran.pdf")
        make_pdf(self.root / "Purans" / "Vishnu Puran" / "Part 1.pdf")
        make_pdf(self.root / "Purans" / "Vishnu Puran" / "Part 2.pdf")
        (self.root / "Gita" / "notes.txt").write_text("not a book")
        self.override = override_settings(LIBRARY_LOCAL_DIR=str(self.root), LIBRARY_DRIVE_FOLDER_ID="")
        self.override.enable()

    def tearDown(self):
        self.override.disable()
        self.tmp.cleanup()

    def items(self):
        return drive_library.build_items(drive_library.get_tree(force=True))

    def test_folders_become_collections_and_pdfs_become_books(self):
        items = self.items()
        self.assertEqual(len(items), 5)  # the .txt file is ignored
        self.assertEqual({i["category"] for i in items}, {"Gita", "Purans"})
        names = {i["name"] for i in items}
        self.assertIn("Bhagavad Gita As It Is", names)
        self.assertIn("Gita Press Hindi", names)  # "02 - " sort prefix removed
        self.assertIn("Shiv Puran", names)

    def test_nested_folders_group_books_and_part_files_get_the_folder_name(self):
        parts = [i for i in self.items() if i["subcategory"] == "Vishnu Puran"]
        self.assertEqual(sorted(i["name"] for i in parts), ["Vishnu Puran, Part 1", "Vishnu Puran, Part 2"])
        self.assertTrue(all(i["category"] == "Purans" for i in parts))

    def test_new_folders_and_books_appear_without_code_changes(self):
        before = {i["slug"] for i in self.items()}
        make_pdf(self.root / "Ramayan" / "Valmiki Ramayan.pdf")
        make_pdf(self.root / "Gita" / "new-gita-commentary.pdf")
        after = self.items()
        self.assertEqual(len(after), len(before) + 2)
        self.assertIn("Ramayan", {i["category"] for i in after})
        self.assertEqual([c["label"] for c in drive_library.collections_summary(after)], ["Gita", "Purans", "Ramayan"])

    def test_deity_is_inferred_and_slugs_are_unique_and_stable(self):
        items = self.items()
        by = {i["name"]: i for i in items}
        self.assertEqual(by["Shiv Puran"]["deity"], "Lord Shiva")
        self.assertEqual(by["Bhagavad Gita As It Is"]["deity"], "Shri Krishna")
        self.assertEqual(len({i["slug"] for i in items}), len(items))
        self.assertEqual([i["slug"] for i in items], [i["slug"] for i in self.items()])

    def test_serving_supports_ranges_and_only_known_files(self):
        make_pdf(self.root / "Gita" / "range.pdf", b"%PDF-" + b"0123456789" * 10)
        item = [i for i in self.items() if i["name"] == "Range"][0]
        rf = RequestFactory()
        full = drive_library.stream_file(rf.get("/x"), item["file_id"])
        self.assertEqual(full.status_code, 200)
        part = drive_library.stream_file(rf.get("/x", HTTP_RANGE="bytes=5-14"), item["file_id"])
        self.assertEqual(part.status_code, 206)
        self.assertEqual(b"".join(part.streaming_content), (b"%PDF-" + b"0123456789" * 10)[5:15])
        self.assertEqual(part["Content-Range"], "bytes 5-14/105")
        from django.http import Http404

        with self.assertRaises(Http404):
            drive_library.stream_file(rf.get("/x"), "not-in-the-folder")

    def test_pasted_share_link_is_accepted_as_folder_id(self):
        with override_settings(LIBRARY_DRIVE_FOLDER_ID="https://drive.google.com/drive/folders/1bP5pp20OQDk3HrWHuqDi1qibVtSkQFDA?usp=drive_link"):
            self.assertEqual(drive_library.folder_id(), "1bP5pp20OQDk3HrWHuqDi1qibVtSkQFDA")


class CoverImageTests(SimpleTestCase):
    def test_same_named_image_becomes_the_cover(self):
        pdfs = [{"name": "Agni-Puran.pdf", "thumb": ""}, {"name": "Shiv Puran.pdf", "thumb": "https://x/first-page"}]
        images = [{"name": "agni-puran.JPG", "thumb": "https://x/agni-picture"}]
        drive_library._attach_cover_images(pdfs, images)
        self.assertEqual(pdfs[0]["thumb"], "https://x/agni-picture")  # the picture next to the PDF
        self.assertEqual(pdfs[1]["thumb"], "https://x/first-page")  # untouched: Drive's own first-page thumbnail

    def test_cover_jpg_applies_only_when_the_folder_has_one_book(self):
        one = [{"name": "Gita.pdf", "thumb": ""}]
        drive_library._attach_cover_images(one, [{"name": "cover.png", "thumb": "https://x/cover"}])
        self.assertEqual(one[0]["thumb"], "https://x/cover")
        two = [{"name": "A.pdf", "thumb": ""}, {"name": "B.pdf", "thumb": ""}]
        drive_library._attach_cover_images(two, [{"name": "cover.png", "thumb": "https://x/cover"}])
        self.assertEqual([p["thumb"] for p in two], ["", ""])

    def test_items_expose_the_cover_only_when_there_is_a_thumbnail(self):
        tree = {"files": [{"id": "abc123xyz", "name": "A.pdf", "path": ["Gita"], "size": 0, "source": "drive", "thumb": "https://x/t"},
                          {"id": "def456uvw", "name": "B.pdf", "path": ["Gita"], "size": 0, "source": "drive", "thumb": ""}]}
        with override_settings(LIBRARY_LOCAL_DIR="", LIBRARY_DRIVE_FOLDER_ID="x"):
            items = {i["name"]: i for i in drive_library.build_items(tree)}
        self.assertTrue(items["A"]["cover_page"])
        self.assertIn("/library/cover/abc123xyz/", items["A"]["cover_image"])
        self.assertFalse(items["B"]["cover_page"])
        self.assertEqual(items["B"]["cover_image"], "")
