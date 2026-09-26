const PLAYTIME_SCHEME = 'playcrew:';

function parsePlaytimeUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== PLAYTIME_SCHEME ||
      url.hostname !== 'playtime' ||
      (url.pathname !== '' && url.pathname !== '/')
    ) return null;

    const gameName = (url.searchParams.get('game') || '').trim();
    const gameId = (url.searchParams.get('gameId') || '').trim();
    const eventId = (url.searchParams.get('eventId') || '').trim();
    const elapsedSeconds = Number(url.searchParams.get('elapsedSeconds'));

    if (!gameName || gameName.length > 200) return null;
    if (gameId.length > 100 || eventId.length > 180) return null;
    if (!Number.isSafeInteger(elapsedSeconds) || elapsedSeconds <= 0 || elapsedSeconds > 31_536_000) return null;

    return { gameName, gameId, eventId, elapsedSeconds };
  } catch {
    return null;
  }
}

function findPlaytimeUrl(argv) {
  if (!Array.isArray(argv)) return null;
  for (const value of argv) {
    if (typeof value !== 'string' || !value.toLowerCase().startsWith(PLAYTIME_SCHEME)) continue;
    const parsed = parsePlaytimeUrl(value);
    if (parsed) return parsed;
  }
  return null;
}

module.exports = { PLAYTIME_SCHEME, parsePlaytimeUrl, findPlaytimeUrl };
