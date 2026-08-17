export function intlLocale(locale) {
  return locale === "fa" ? "fa-IR" : "en-GB";
}

export function formatDateTime(value, locale) {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}
