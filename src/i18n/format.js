export function intlLocale(locale) {
  return locale === "fa" ? "fa-IR" : "en-GB";
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function formatDateTime(value, locale) {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  void locale;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
