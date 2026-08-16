export function compareAz(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortByLabel(items, getLabel = (item) => item?.label ?? item?.name ?? "") {
  return [...items].sort((a, b) => compareAz(getLabel(a), getLabel(b)));
}

export function sortStrings(items) {
  return [...items].sort(compareAz);
}
