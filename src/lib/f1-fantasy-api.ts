const BASE_URL = 'https://fantasy-api.formula1.com/partner_games/f1';

export class FantasyApiError extends Error {
  constructor(message:string, public status?:number) { super(message); }
}

export async function fetchFantasyPlayers(season:number) {
  const token = process.env.F1_FANTASY_TOKEN;
  if (!token) throw new FantasyApiError('F1_FANTASY_TOKEN is not configured');

  const response = await fetch(`${BASE_URL}/${season}/players`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new FantasyApiError(`Official F1 Fantasy API returned ${response.status}`, response.status);
  }

  const payload = await response.json();
  const players = Array.isArray(payload) ? payload : payload?.players;
  if (!Array.isArray(players)) throw new FantasyApiError('Unexpected F1 Fantasy players response');
  return players;
}
