export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatLocalTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDateLong(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(d);
}

