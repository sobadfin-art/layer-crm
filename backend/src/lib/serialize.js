// snake_case (colonnes SQL) -> camelCase (JSON API), sans dépendance externe.
export function toCamel(row) {
  if (row === null || typeof row !== "object" || Array.isArray(row)) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camelKey] = value;
  }
  return out;
}

export function toCamelList(rows) {
  return rows.map(toCamel);
}
