// shape returned by your /api/hltb (and used by the modal)
export interface HLTBApiGame {
  id: number;
  name: string;
  imageUrl: string;
  gameplayMain: number;
  gameplayMainExtra: number;
  gameplayCompletionist: number;
}

// shape you store in Firestore under trackedGames[gameId].hltb
export interface HLTBStored {
  game_id: number;
  game_name: string;
  game_image: string;
  comp_main: number;
  comp_plus: number;
  comp_100: number;
}

// mapper helper
export function mapApiToStored(api: HLTBApiGame): HLTBStored {
  return {
    game_id: api.id,
    game_name: api.name,
    game_image: api.imageUrl,
    comp_main: api.gameplayMain,
    comp_plus: api.gameplayMainExtra,
    comp_100: api.gameplayCompletionist,
  };
}
