export function money(amount: number | undefined, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(Number(amount || 0));
}
export function homeTime(instant: string, timezone?: string) {
  return new Date(instant).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", ...(timezone ? { timeZone: timezone } : {}) }) + (timezone ? ` (${timezone})` : "");
}
