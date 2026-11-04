from django.test import SimpleTestCase, TestCase


class InputValidationTests(SimpleTestCase):
    databases = {"default"}

    def get(self, path):
        return self.client.get(path, HTTP_HOST="localhost")

    def test_panchang_rejects_bad_input_without_leaking_errors(self):
        for q in ("date=zzz", "lat=nan", "lat=95", "lon=-999", "tz=Not/AZone"):
            r = self.get(f"/api/panchang?{q}")
            self.assertEqual(r.status_code, 400, q)
            self.assertNotIn("invalid literal", r.content.decode())

    def test_year_endpoints_reject_bad_geo(self):
        for path in ("/api/kharmas/", "/api/marriage-dates/", "/api/core-festivals-dates/"):
            self.assertEqual(self.get(f"{path}?lat=inf").status_code, 400, path)

    def test_security_headers_present(self):
        r = self.get("/healthz/")
        self.assertIn("frame-ancestors 'none'", r.headers["Content-Security-Policy"])
        self.assertIn("camera=()", r.headers["Permissions-Policy"])

    def test_library_status_hides_upstream_error_from_public(self):
        data = self.get("/api/library/status/").json()
        self.assertNotIn("error", data)
        self.assertIn("ok", data)


class SignupUsernameTests(TestCase):
    def test_markup_in_username_is_rejected(self):
        r = self.client.post(
            "/login/",
            {"form_type": "signup", "full_name": "A B", "username": "<img src=x onerror=alert(1)>",
             "email": "a@example.com", "password": "S0me-long-pass-123", "confirm_password": "S0me-long-pass-123"},
            HTTP_HOST="localhost",
        )
        from django.contrib.auth.models import User

        self.assertFalse(User.objects.filter(email="a@example.com").exists())
        self.assertIn(r.status_code, (200, 302))
