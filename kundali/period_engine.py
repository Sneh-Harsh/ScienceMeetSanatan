from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional


@dataclass(frozen=True)
class PeriodRange:
    period_type: str
    start: datetime
    end: datetime
    label: str


def get_period_range(period_type: str, reference_date: datetime, selected_year: Optional[int] = None) -> PeriodRange:
    period_type = str(period_type or "daily").lower()
    if period_type == "daily":
        start = reference_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start.replace(hour=23, minute=59)
        return PeriodRange("daily", start, end, start.strftime("%d %b %Y"))

    if period_type == "weekly":
        start = (reference_date - timedelta(days=reference_date.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        end = (start + timedelta(days=6)).replace(hour=23, minute=59)
        return PeriodRange("weekly", start, end, f"{start.strftime('%d %b')} – {end.strftime('%d %b %Y')}")

    if period_type == "monthly":
        start = reference_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day = monthrange(start.year, start.month)[1]
        end = start.replace(day=last_day, hour=23, minute=59)
        return PeriodRange("monthly", start, end, start.strftime("%B %Y"))

    year = int(selected_year or reference_date.year)
    if period_type == "specific_year":
        start = reference_date.replace(year=year, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = start.replace(month=12, day=31, hour=23, minute=59)
        return PeriodRange("specific_year", start, end, str(year))

    start = reference_date.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    end = start.replace(month=12, day=31, hour=23, minute=59)
    return PeriodRange("yearly", start, end, str(start.year))


def _interpolate(start: datetime, end: datetime, fraction: float) -> datetime:
    total_seconds = (end - start).total_seconds()
    return start + timedelta(seconds=total_seconds * fraction)


def get_period_sample_points(period_range: PeriodRange) -> List[datetime]:
    if period_range.period_type == "daily":
        return [
            period_range.start.replace(hour=6, minute=0),
            period_range.start.replace(hour=12, minute=0),
            period_range.start.replace(hour=18, minute=0),
            period_range.start.replace(hour=21, minute=0),
        ]
    if period_range.period_type == "weekly":
        return [period_range.start + timedelta(days=offset, hours=12) for offset in range(7)]
    if period_range.period_type == "monthly":
        return [_interpolate(period_range.start, period_range.end, fraction) for fraction in (0.08, 0.28, 0.5, 0.72, 0.92)]
    return [_interpolate(period_range.start, period_range.end, fraction) for fraction in (0.08, 0.25, 0.42, 0.58, 0.75, 0.92)]


def split_year_windows(period_range: PeriodRange) -> List[PeriodRange]:
    if period_range.period_type not in {"yearly", "specific_year"}:
        return [period_range]
    year = period_range.start.year
    windows = []
    for quarter, month in enumerate((1, 4, 7, 10), start=1):
        start = period_range.start.replace(year=year, month=month, day=1, hour=0, minute=0)
        if month == 10:
            end = period_range.end.replace(year=year, month=12, day=31, hour=23, minute=59)
        else:
            next_start = period_range.start.replace(year=year, month=month + 3, day=1, hour=0, minute=0)
            end = next_start - timedelta(minutes=1)
        windows.append(PeriodRange(period_range.period_type, start, end, f"Q{quarter} {year}"))
    return windows
