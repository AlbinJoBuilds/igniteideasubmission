// Mirrors the Postgres-side normalization used in submit_idea() so the
// client can do a quick pre-check, though the server is the source of truth.
export function normalizeTitle(title) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
