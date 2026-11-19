export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type ZoneId =
  | 'forecourt'
  | 'entrance_hall'
  | 'trap_corridor'
  | 'secret_alcove'
  | 'catacombs'
  | 'secret_catacombs'
  | 'sanctum';

export type HieroglyphSymbol = 'falke' | 'skarabaeus' | 'ankh' | 'auge' | 'lotus' | 'schlange' | 'sonne';

export interface StoryEntry {
  id: string;
  chapter: number;
  title: string;
  subtitle: string;
  text: string;
  clue?: string;
}

export interface HudSnapshot {
  phase: GamePhase;
  zoneId: ZoneId;
  zoneName: string;
  health: number;
  maxHealth: number;
  solarEnergy: number;
  maxSolarEnergy: number;
  gold: number;
  treasuresFound: number;
  totalTreasures: number;
  secretsFound: number;
  totalSecrets: number;
  puzzlesSolved: number;
  totalPuzzles: number;
  mummiesDefeated: number;
  elapsedSeconds: number;
  interactPrompt: string | null;
  bannerMessage: string | null;
  pointerLocked: boolean;
  unlockedStories: string[];
  activeStoryModalId: string | null;
  puzzle1States: [number, number, number];
  puzzle2Progress: number;
  puzzle3MirrorsAligned: boolean;
  bossHealthRatio: number | null;
  hurtFlash: number;
  visitedZones: ZoneId[];
  playerX: number;
  playerZ: number;
  playerYaw: number;
  objectiveText: string;
  hasCheckpoint: boolean;
  checkpointZoneName: string | null;
  targetedMummy: { name: string; healthRatio: number } | null;
  puzzle1Solved: boolean;
  puzzle2Solved: boolean;
  secret1Opened: boolean;
  secret2Opened: boolean;
}

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
  id?: string;
  active?: boolean;
}
