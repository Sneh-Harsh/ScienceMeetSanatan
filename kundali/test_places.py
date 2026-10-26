import json
from unittest import mock

from django.core.cache import cache
from django.test import Client, TestCase

INDIA = {"results": [{"name": "Varanasi", "admin1": "Uttar Pradesh", "country": "India", "latitude": 25.3167, "longitude": 83.0104, "timezone": "Asia/Kolkata"}]}
WORLD = {"results": [
    {"name": "Varanasi", "admin1": "Uttar Pradesh", "country": "India", "latitude": 25.3167, "longitude": 83.0104, "timezone": "Asia/Kolkata"},
    {"name": "Varan", "admin1": "Bitlis", "country": "Turkey", "latitude": 38.5833, "longitude": 41.75, "timezone": "Europe/Istanbul"},
]}


class _Response:
    def __init__(self, payload):
        self._body = json.dumps(payload).encode()

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _fake_urlopen(request, timeout=0):
    return _Response(INDIA if "countryCode=IN" in request.full_url else WORLD)


class PlaceSearchTests(TestCase):
    def setUp(self):
        cache.clear()

    @mock.patch("kundali.views.urllib.request.urlopen", side_effect=_fake_urlopen)
    def test_returns_coordinates_and_timezone_with_indian_places_first(self, urlopen):
        data = Client().get("/api/places/search", {"q": "Varanasi"}).json()
        self.assertEqual(data["results"][0], {"label": "Varanasi, Uttar Pradesh, India", "name": "Varanasi", "lat": 25.3167, "lon": 83.0104, "tz": "Asia/Kolkata"})
        self.assertEqual(len(data["results"]), 2)  # duplicate coordinates are merged
        self.assertEqual(data["results"][1]["tz"], "Europe/Istanbul")

    @mock.patch("kundali.views.urllib.request.urlopen", side_effect=_fake_urlopen)
    def test_results_are_cached(self, urlopen):
        Client().get("/api/places/search", {"q": "Varanasi"})
        calls = urlopen.call_count
        Client().get("/api/places/search", {"q": "varanasi"})
        self.assertEqual(urlopen.call_count, calls)

    @mock.patch("kundali.views.urllib.request.urlopen")
    def test_short_or_empty_queries_do_not_call_the_service(self, urlopen):
        self.assertEqual(Client().get("/api/places/search", {"q": "v"}).json(), {"results": []})
        self.assertEqual(Client().get("/api/places/search").json(), {"results": []})
        urlopen.assert_not_called()

    def test_overlong_query_is_rejected(self):
        self.assertEqual(Client().get("/api/places/search", {"q": "x" * 81}).status_code, 400)

    @mock.patch("kundali.views.urllib.request.urlopen", side_effect=OSError("down"))
    def test_upstream_failure_is_a_clean_error(self, urlopen):
        response = Client().get("/api/places/search", {"q": "Delhi"})
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("down", response.content.decode())

    @mock.patch("kundali.views.urllib.request.urlopen", side_effect=_fake_urlopen)
    def test_is_rate_limited(self, urlopen):
        # Start the counter just under the limit instead of firing 120 requests at the database.
        cache.set("rl:places_search:127.0.0.1", 119, timeout=600)
        statuses = [Client().get("/api/places/search", {"q": f"city{i}"}).status_code for i in range(3)]
        self.assertEqual(statuses, [200, 429, 429])

    def test_page_has_place_search_and_no_visible_latitude_longitude_inputs(self):
        html = Client().get("/kundali/").content.decode()
        self.assertIn('id="placeInput"', html)
        self.assertIn('id="placeList"', html)
        self.assertNotIn("<span>Latitude</span>", html)
        self.assertNotIn("<span>Longitude</span>", html)
        self.assertIn('id="latInput" type="hidden"', html)


NOMINATIM = {"address": {"suburb": "Lanka", "city": "Varanasi", "state": "Uttar Pradesh", "country": "India"}}


class ReversePlaceTests(TestCase):
    def setUp(self):
        cache.clear()

    @mock.patch("kundali.views.urllib.request.urlopen", side_effect=lambda r, timeout=0: _Response(NOMINATIM))
    def test_returns_a_place_name_and_caches_it(self, urlopen):
        first = Client().get("/api/places/reverse", {"lat": "25.3176", "lon": "82.9739"}).json()
        self.assertEqual(first, {"label": "Varanasi, Uttar Pradesh, India"})
        calls = urlopen.call_count
        Client().get("/api/places/reverse", {"lat": "25.3179", "lon": "82.9741"})  # same ~1 km cell
        self.assertEqual(urlopen.call_count, calls)

    def test_rejects_bad_coordinates(self):
        for params in ({}, {"lat": "x", "lon": "1"}, {"lat": "95", "lon": "1"}, {"lat": "1", "lon": "200"}):
            self.assertEqual(Client().get("/api/places/reverse", params).status_code, 400, params)

    @mock.patch("kundali.views.urllib.request.urlopen", side_effect=OSError("down"))
    def test_lookup_failure_is_a_clean_error(self, urlopen):
        response = Client().get("/api/places/reverse", {"lat": "25.3", "lon": "82.9"})
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("down", response.content.decode())

    @mock.patch("kundali.views.urllib.request.urlopen", side_effect=lambda r, timeout=0: _Response({"address": {}}))
    def test_unknown_location_returns_404(self, urlopen):
        self.assertEqual(Client().get("/api/places/reverse", {"lat": "0", "lon": "-30"}).status_code, 404)
