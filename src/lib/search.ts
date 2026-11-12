/** Case-insensitive name filter for search boxes. Empty query keeps everything. */
export function filterByName<T extends { name: string }>(items: T[], query: string): T[] {
  const needle = query.trim().toLowerCase()
  return needle ? items.filter((i) => i.name.toLowerCase().includes(needle)) : items
}
