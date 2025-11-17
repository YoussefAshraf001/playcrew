export interface HLTBResult {
  id: string | number;
  name: string;
  imageUrl: string;
  gameplayMain?: number;
  gameplayCompletionist?: number;
}

export interface HLTBModalProps {
  open: boolean;
  loading: boolean;
  gameName: string;
  results: HLTBResult[];
  onClose: () => void;
  onSelect: (result: HLTBResult) => void;
}
