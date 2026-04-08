import csv
import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

from django.conf import settings


def _candidate_paths(filename: str) -> List[Path]:
    base_dir = Path(getattr(settings, "BASE_DIR", Path.cwd()))
    return [
        base_dir / filename,
        base_dir / "assets" / filename,
        base_dir / "accounts" / filename,
        base_dir / "accounts" / "static" / filename,
        base_dir / "accounts" / "static" / "baby_names_assets" / filename,
    ]


def _pick_existing(*filenames: str) -> Optional[Path]:
    for filename in filenames:
        for path in _candidate_paths(filename):
            if path.exists() and path.is_file():
                return path
    return None


def _normalize_header(value) -> str:
    return str(value or "").strip().lower().replace(" ", "")


def _to_letter(value) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip().upper()
    if not text:
        return None
    return text[0]


def _read_csv_grouped(path: Path, expect_deity_column: bool) -> Dict[str, Dict[str, List[dict]]]:
    """
    Returns: {deity_name: {alphabet: [{name, meaning}, ...]}}
    """
    grouped: Dict[str, Dict[str, List[dict]]] = {}

    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            return grouped

        header_map = {_normalize_header(h): h for h in reader.fieldnames}
        deity_key = header_map.get("deity") or header_map.get("deityname")
        alphabet_key = header_map.get("alphabet") or header_map.get("alpha")
        name_key = header_map.get("name")
        meaning_key = header_map.get("meaning")

        if not alphabet_key or not name_key or not meaning_key:
            raise ValueError(
                f"{path.name} must contain columns: alphabet, Name, meaning (case-insensitive).",
            )

        if expect_deity_column and not deity_key:
            raise ValueError(
                f"{path.name} is a CSV, so it cannot contain multiple sheets. "
                f"Add a 'deity' column, or provide an Excel .xlsx with separate sheets.",
            )

        for row in reader:
            deity_name = str(row.get(deity_key) or "").strip() if deity_key else "Unknown"
            if not deity_name:
                deity_name = "Unknown"

            letter = _to_letter(row.get(alphabet_key))
            name = str(row.get(name_key) or "").strip()
            meaning = str(row.get(meaning_key) or "").strip()

            if not letter or not name:
                continue

            deity_bucket = grouped.setdefault(deity_name, {})
            letter_bucket = deity_bucket.setdefault(letter, [])
            letter_bucket.append({"name": name, "meaning": meaning})

    return grouped


def _read_xlsx_grouped(path: Path) -> Dict[str, Dict[str, List[dict]]]:
    """
    Each sheet name is treated as the deity name.
    Columns required in each sheet: alphabet, Name, meaning (case-insensitive).

    Returns: {deity_name: {alphabet: [{name, meaning}, ...]}}
    """
    try:
        import openpyxl  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise ImportError(
            "Reading .xlsx requires 'openpyxl'. Add it to requirements and install it.",
        ) from exc

    wb = openpyxl.load_workbook(path, data_only=True)
    grouped: Dict[str, Dict[str, List[dict]]] = {}

    for sheet in wb.worksheets:
        deity_name = str(sheet.title or "").strip() or "Unknown"
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            continue

        headers = rows[0]
        header_map = {_normalize_header(h): idx for idx, h in enumerate(headers)}
        idx_alpha = header_map.get("alphabet")
        if idx_alpha is None:
            idx_alpha = header_map.get("alpha")
        idx_name = header_map.get("name")
        idx_meaning = header_map.get("meaning")

        if idx_alpha is None or idx_name is None or idx_meaning is None:
            raise ValueError(
                f"Sheet '{deity_name}' in {path.name} must have columns alphabet, Name, meaning.",
            )

        deity_bucket = grouped.setdefault(deity_name, {})
        for row in rows[1:]:
            letter = _to_letter(row[idx_alpha] if idx_alpha < len(row) else None)
            name = str(row[idx_name] if idx_name < len(row) else "" or "").strip()
            meaning = str(row[idx_meaning] if idx_meaning < len(row) else "" or "").strip()
            if not letter or not name:
                continue
            deity_bucket.setdefault(letter, []).append({"name": name, "meaning": meaning})

    return grouped


@lru_cache(maxsize=1)
def load_baby_names() -> dict:
    """
    Loads baby names from either:
    - Excel workbooks: baby_boys.xlsx / baby_girls.xlsx (preferred when you have sheets per deity)
    - Or CSV: baby_boys.csv / baby_girls.csv (requires a 'deity' column if you want multiple deities)
    """
    payload = {"boy": {}, "girl": {}}

    boys_path = _pick_existing("baby_boys.xlsx", "baby_boys.xlsm", "baby_boys.csv")
    girls_path = _pick_existing("baby_girls.xlsx", "baby_girls.xlsm", "baby_girls.csv")

    if boys_path:
        payload["boy"] = (
            _read_xlsx_grouped(boys_path)
            if boys_path.suffix.lower() in {".xlsx", ".xlsm"}
            else _read_csv_grouped(boys_path, expect_deity_column=True)
        )

    if girls_path:
        payload["girl"] = (
            _read_xlsx_grouped(girls_path)
            if girls_path.suffix.lower() in {".xlsx", ".xlsm"}
            else _read_csv_grouped(girls_path, expect_deity_column=True)
        )

    return payload


def load_baby_names_json() -> str:
    return 