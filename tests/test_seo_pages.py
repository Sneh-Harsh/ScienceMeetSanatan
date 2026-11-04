import json
import re
import xml.dom.minidom as minidom

from django.test import SimpleTestCase


class SeoPagesTests(SimpleTestCase):
    databases = {"default"}  # pages read sessions/content; these tests only issue GETs

    def get(self, path):
        return self.client.get(path, HTTP_HOST="localhost")

    def test_sitemap_index_and_sections_are_valid_xml(self):
        index = self.get("/sitemap.xml")
        self.assertEqual(index.status_code, 200)
        minidom.parseString(index.content)
        for kind in ("pages", "panchang", "content", "library", "pandit"):
            r = self.get(f"/sitemap-{kind}.xml")
            self.assertEqual(r.status_code, 200)
            minidom.parseString(r.content)
        self.assertEqual(self.get("/sitemap-nope.xml").status_code, 404)

    def test_robots_points_to_sitemap(self):
        body = self.get("/robots.txt").content.decode()
        self.assertIn("Sitemap: http://localhost/sitemap.xml", body)

    def test_public_pages_have_one_title_description_canonical(self):
        for path in ("/", "/panchang/", "/kundali/", "/horoscope/", "/baby-names/", "/pandits/",
                     "/panchang/patna/", "/hi/panchang/delhi/", "/festivals/", "/katha/satyanarayan/",
                     "/gita-shlok/2-47/", "/pandit-for-griha-pravesh-in-patna/", "/pandit-in-gurugram/"):
            html = self.get(path).content.decode()
            self.assertEqual(html.count("<title>"), 1, path)
            self.assertEqual(html.count('name="description"'), 1, path)
            self.assertEqual(html.count('rel="canonical"'), 1, path)
            for block in re.findall(r'ld\+json">(.*?)</script>', html, re.S):
                json.loads(block)

    def test_private_pages_are_noindex(self):
        self.assertIn("noindex", self.get("/login/").content.decode())

    def test_unknown_landing_pages_404(self):
        for path in ("/panchang/atlantis/", "/pandit-in-mars/", "/pandit-for-foo-in-patna/", "/gita-shlok/9-99/", "/festivals/nope-2026/"):
            self.assertEqual(self.get(path).status_code, 404, path)

    def test_aarti_lyrics_are_in_the_html(self):
        html = self.get("/library/ganesh-aarti/").content.decode()
        self.assertIn("वक्रतुण्ड", html)
        self.assertIn("Lyrics in Hindi", html)
