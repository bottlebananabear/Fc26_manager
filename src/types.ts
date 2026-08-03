export type DecodedScalar = string | number | null;
export type DecodedRecord = Record<string, DecodedScalar>;

export interface FieldDefinition {
  index: number;
  shortName: string;
  type: number;
  bitOffset: number;
  bitDepth: number;
}

export interface TableDefinition {
  databaseIndex: number;
  index: number;
  shortName: string;
  directoryOffset: number;
  headerOffset: number;
  recordSize: number;
  validRecords: number;
  fieldsCount: number;
  recordsStart: number;
  fields: FieldDefinition[];
}

export interface ParsedSave {
  filePath: string;
  buffer: Buffer;
  tables: Map<string, TableDefinition[]>;
}

export interface PlayerSnapshot {
  playerId: number;
  name: string;
  teamId?: number;
  teamName?: string;
  overall: number;
  potential: number;
  age?: number;
  birthDate?: string;
  positions: string[];
  preferredFoot?: "left" | "right";
  heightCm?: number;
  weightKg?: number;
  skillMoves?: number;
  weakFoot?: number;
  contractUntil?: number;
  weeklyWage?: number;
  attributes: Record<string, number>;
}

export interface CareerSnapshot {
  savePath: string;
  managedTeamId: number;
  managedTeamName: string;
  players: PlayerSnapshot[];
}

export interface NegotiationRecommendation {
  opening: number;
  targetLow: number;
  targetHigh: number;
  maximum: number;
  step: number;
  estimatedMarketValue?: number;
  openingWage?: number;
  targetWageLow?: number;
  targetWageHigh?: number;
  confidence?: "low" | "medium" | "high";
  notes: string[];
}
