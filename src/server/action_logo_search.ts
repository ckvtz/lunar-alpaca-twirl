// Mock data for logo search, simulating results from external repositories
const MOCK_LOGOS = [
  { name: 'Netflix', logo_url: '/placeholder.svg' },
  { name: 'Spotify', logo_url: '/placeholder.svg' },
  { name: 'Amazon Prime', logo_url: '/placeholder.svg' },
  { name: 'Hulu', logo_url: '/placeholder.svg' },
  { name: 'Disney+', logo_url: '/placeholder.svg' },
  { name: 'Google Drive', logo_url: '/placeholder.svg' },
  { name: 'Microsoft 365', logo_url: '/placeholder.svg' },
];

/**
 * Searches mock repositories for logos matching the query.
 * This is a simplified implementation based on the request.
 */
function searchLogos(query: string) {
  if (!query) return [];
  const lowerQuery = query.toLowerCase();
  
  const results = MOCK_LOGOS.filter(logo => 
    logo.name.toLowerCase().includes(lowerQuery)
  );
  
  // Return top 3 candidates
  return results.slice(0, 3);
}

/**
 * Handles logo search requests.
 * Expects a POST request with 'query' in the body.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Missing required field: query' });
    }

    const results = searchLogos(query);

    return res.status(200).json({ 
      ok: true, 
      results 
    });

  } catch (e) {
    console.error('General error in action_logo_search:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}