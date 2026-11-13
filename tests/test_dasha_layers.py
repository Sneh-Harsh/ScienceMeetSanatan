import json
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from django.test import SimpleTestCase

from kundali.calculations import VIMSHOTTARI_YEARS
from kundali.dasha_levels import antardashas, children

QUERY = "/api/kundali?date=1995-08-15&time=10:30&lat=25.5941&lon=85.1376&tz=Asia/Kolkata"
JS = Path(__file__).resolve().parent.parent / "accounts" / "static" / "kundali-dasha-layers.js"


def _dt(value):
    return datetime.fromisoformat(value)


class DashaLayerTests(SimpleTestCase):
    databases = {"default"}

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        from django.test import Client

        cls.data = Client().get(QUERY, HTTP_HOST="localhost").json()

    def _levels(self, node, depth):
        """Walk every layer down to ``depth`` and check each one tiles its parent exactly."""
        kids = children(node)
        self.assertLessEqual(len(kids), 9)
        if len(kids) == 9:  # a period clipped at birth keeps only the parts after birth
            self.assertEqual(kids[0]["planet"], node["planet"])  # a layer always starts with its own planet
        self.assertEqual(_dt(kids[0]["start"]), _dt(node["start"]))
        self.assertEqual(_dt(kids[-1]["end"]), _dt(node["end"]))
        for a, b in zip(kids, kids[1:]):
            self.assertEqual(a["end"], b["start"])
        if depth > 1:
            for kid in kids[:2] + kids[-1:]:
                self._levels(kid, depth - 1)

    def test_every_layer_fills_its_parent_down_to_prana(self):
        for maha in self.data["dasha"][1:4]:
            for antar in antardashas(maha):
                self.assertEqual(len(children(antar)), 9)
        for maha in self.data["dasha"][:3]:
            for antar in antardashas(maha):
                self._levels(antar, 3)  # pratyantar -> sookshma -> prana

    def test_layer_lengths_follow_the_120_year_ratio(self):
        maha = self.data["dasha"][1]  # a full Mahadasha
        antar = antardashas(maha)[0]
        for level in range(3):
            kids = children(antar)
            for kid in kids:
                want = antar["nominal_days"] * VIMSHOTTARI_YEARS[kid["planet"]] / 120
                self.assertAlmostEqual(kid["nominal_days"], want, places=6)
            antar = kids[3]

    def test_payload_carries_nominal_start_for_every_antardasha(self):
        for maha in self.data["reading"]["dasha"]:
            for sub in maha["antardashas"]:
                self.assertIn("nominal_start", sub)
                self.assertGreater(sub["nominal_days"], 0)

    def test_page_javascript_matches_python(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        maha = self.data["reading"]["dasha"][0]  # the part-period running at birth: the hardest case
        antar = maha["antardashas"][0]
        script = (
            "global.window={KI:null,setInterval(){}};global.document={addEventListener(){},querySelector(){return null}};"
            "require(%r);const L=window.KundaliLayers;const a=%s;"
            "const ms=s=>new Date(s).getTime();"
            "let n={planet:a.planet,start:ms(a.start),end:ms(a.end),nominalStart:ms(a.nominal_start),nominalDays:a.nominal_days};"
            "const out=[];for(let i=0;i<3;i++){const k=L._split(n);out.push(k.map(x=>[x.planet,x.start,x.end]));n=k[Math.min(2,k.length-1)];}"
            "console.log(JSON.stringify(out));" % (str(JS), json.dumps(antar))
        )
        got = json.loads(subprocess.run([node, "-e", script], capture_output=True, text=True, check=True).stdout)
        node_py = {"planet": antar["planet"], "start": antar["start"], "end": antar["end"],
                   "nominal_start": _dt(antar["nominal_start"]), "nominal_days": antar["nominal_days"]}
        for level in got:
            py = children(node_py)
            self.assertEqual([r[0] for r in level], [r["planet"] for r in py])
            for row, ref in zip(level, py):
                self.assertAlmostEqual(row[1], _dt(ref["start"]).timestamp() * 1000, delta=1500)
                self.assertAlmostEqual(row[2], _dt(ref["end"]).timestamp() * 1000, delta=1500)
            node_py = py[min(2, len(py) - 1)]
            node_py = {"planet": node_py["planet"], "start": node_py["start"], "end": node_py["end"],
                       "nominal_start": node_py["nominal_start"], "nominal_days": node_py["nominal_days"]}
