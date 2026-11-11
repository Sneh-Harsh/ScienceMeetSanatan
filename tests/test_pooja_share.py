from django.test import SimpleTestCase


class PoojaVidhiShareLinkTests(SimpleTestCase):
    databases = {"default"}

    def test_guide_link_opens_with_its_own_preview(self):
        r = self.client.get("/pooja-vidhi/satyanarayan/")
        self.assertEqual(r.status_code, 200)
        html = r.content.decode()
        self.assertIn('data-open-guide="satyanarayan"', html)
        self.assertIn('<meta property="og:title" content="Satyanarayan Puja Vidhi', html)
        self.assertIn('rel="canonical" href="http://testserver/pooja-vidhi/satyanarayan/"', html)

    def test_unknown_guide_is_404(self):
        self.assertEqual(self.client.get("/pooja-vidhi/not-a-guide/").status_code, 404)

    def test_reader_has_share_menu(self):
        js = open("pandit/static/pandit/pooja.js", encoding="utf-8").read()
        for term in ("/pooja-vidhi/", "wa.me", "t.me/share", 'data-copy', 'pr-card__share', 'pr-sheet', "navigator.share"):
            self.assertIn(term, js)

    def test_in_sitemap(self):
        body = self.client.get("/sitemap-pandit.xml").content.decode()
        self.assertIn("/pooja-vidhi/satyanarayan/", body)
