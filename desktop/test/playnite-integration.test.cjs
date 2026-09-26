const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePlaytimeUrl, findPlaytimeUrl } = require('../src/playnite-integration.cjs');

test('parses a valid Playnite playtime URL', () => {
  assert.deepEqual(
    parsePlaytimeUrl('playcrew://playtime?game=Alan%20Wake%202&gameId=abc&elapsedSeconds=3661&eventId=evt-1'),
    { gameName: 'Alan Wake 2', gameId: 'abc', elapsedSeconds: 3661, eventId: 'evt-1' },
  );
  assert.deepEqual(
    parsePlaytimeUrl('playcrew://playtime/?game=Alan%20Wake%202&gameId=abc&elapsedSeconds=3661&eventId=evt-2'),
    { gameName: 'Alan Wake 2', gameId: 'abc', elapsedSeconds: 3661, eventId: 'evt-2' },
  );
});

test('finds a protocol URL in Windows launch arguments', () => {
  assert.equal(findPlaytimeUrl(['PlayCrew.exe', '--flag', 'playcrew://playtime?game=Hades&elapsedSeconds=60']).gameName, 'Hades');
});

test('rejects malformed and unsafe playtime URLs', () => {
  for (const value of [
    'https://playcrew/playtime?game=Hades&elapsedSeconds=60',
    'playcrew://other?game=Hades&elapsedSeconds=60',
    'playcrew://playtime?game=&elapsedSeconds=60',
    'playcrew://playtime?game=Hades&elapsedSeconds=0',
    'playcrew://playtime?game=Hades&elapsedSeconds=oops',
  ]) assert.equal(parsePlaytimeUrl(value), null, value);
});
