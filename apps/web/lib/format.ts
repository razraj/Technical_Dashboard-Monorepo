export function formatWeekRange(periodStart: string, periodEnd: string): string {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const month = (d: Date) => d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    const day = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
    const year = end.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });
    if (month(start) === month(end)) {
        return `${day(start)} - ${day(end)} ${month(end)}, ${year}`;
    }
    return `${day(start)} ${month(start)} - ${day(end)} ${month(end)}, ${year}`;
}
