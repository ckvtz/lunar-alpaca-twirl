/**
 * action_logo_search.ts
 * Simple mock logo search that returns up to 3 candidates from a static list.
 */

const MOCK_LOGOS = [
  { name: 'Netflix', logo_url: '/placeholder.svg' },
  { name: 'Spotify', logo_url: '/placeholder.svg' },
  { name: 'Amazon Prime', logo_url: '/placeholder.svg' },
  { name: 'Hulu', logo_url: '/placeholder.svg' },
  { name: 'Disney+', logo_url: '/placeholder.svg' },
  { name: 'Google Drive', logo_url: '/placeholder.svg' },
  { name: 'Microsoft 365', logo_url: '/placeholder.svg' },
];

function searchLogos(query: string) {
  if (!query) return [];
  const q = query.toLowerCase();
  const results = MOCK_LOGOS.filter(l => l.name.toLowerCase().includes(q));
  return results.slice(0, 3);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const body = req.body || {};
    const q = (body.query || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'Missing field: query' });

    const results = searchLogos(q);
    return res.status(200).json({ ok: true, results });
  } catch (err: any) {
    console.error('action_logo_search error', err);
    return res.status(500).json({ error: String(err) });
  }
}
