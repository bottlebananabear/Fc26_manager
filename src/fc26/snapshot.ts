import type { DecodedRecord, CareerSnapshot, PlayerSnapshot } from "../types.js";
import { decodeTable, parseSave, selectTable } from "../save/parser.js";
import { loadMappings } from "./mappings.js";

const LILIAN_EPOCH_UTC = Date.UTC(1582, 9, 14);
const RATING_FIELDS = new Set([
  "UERs", "mpuH", "SPge", "NrcP", "RRQB", "onkY", "URGo", "nmgT", "XjDq",
  "iTce", "wWzG", "XsFD", "YCnI", "ZoOK", "jlQJ", "xrSG", "eYFI", "kqda",
  "GBGj", "yfhq", "MgwU", "wGOH", "YFaA", "SJKz", "nEbM", "xJZL", "VgKc",
  "aReg", "kerE", "CsBG", "AGsE", "vObb", "ohpV", "PhuM", "CsyD", "Dydz",
]);

export interface SnapshotOptions {
  teamId?: number;
  ratingOffset?: 0 | 1;
  asOf?: Date;
  dataDirectory?: string;
}

function numberValue(record: DecodedRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

function dateFromLilianDay(raw: number): Date {
  return new Date(LILIAN_EPOCH_UTC + raw * 86_400_000);
}

function ageOn(birthDate: Date, asOf: Date): number {
  let age = asOf.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    asOf.getUTCMonth() < birthDate.getUTCMonth() ||
    (asOf.getUTCMonth() === birthDate.getUTCMonth() && asOf.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function resolvePlayerName(record: DecodedRecord, names: Record<string, string>): string {
  const first = names[String(numberValue(record, "tHlO") ?? "")] ?? "";
  const last = names[String(numberValue(record, "QCfa") ?? "")] ?? "";
  const common = names[String(numberValue(record, "Vqpv") ?? "")] ?? "";
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || common || `Player ${numberValue(record, "ykFq") ?? "unknown"}`;
}

function chooseTeamIdField(teamRows: DecodedRecord[], linkedTeamIds: Set<number>): string | undefined {
  const keys = new Set(teamRows.flatMap((row) => Object.keys(row)));
  let winner: { key: string; overlap: number } | undefined;

  for (const key of keys) {
    const values = new Set<number>();
    for (const row of teamRows) {
      const value = row[key];
      if (typeof value === "number") values.add(value);
    }
    const overlap = [...values].filter((value) => linkedTeamIds.has(value)).length;
    if (!winner || overlap > winner.overlap) winner = { key, overlap };
  }

  return winner?.key;
}

function inferManagedTeamId(
  contracts: DecodedRecord[],
  links: DecodedRecord[],
  requested?: number,
): number {
  if (requested !== undefined) return requested;

  const contractCounts = new Map<number, number>();
  for (const contract of contracts) {
    const teamId = numberValue(contract, "mCXg");
    if (teamId === undefined) continue;
    contractCounts.set(teamId, (contractCounts.get(teamId) ?? 0) + 1);
  }
  const bestContractTeam = [...contractCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (bestContractTeam !== undefined) return bestContractTeam;

  const linkCounts = new Map<number, number>();
  for (const link of links) {
    const teamId = numberValue(link, "mCXg");
    if (teamId === undefined) continue;
    linkCounts.set(teamId, (linkCounts.get(teamId) ?? 0) + 1);
  }
  const bestLinkedTeam = [...linkCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (bestLinkedTeam === undefined) throw new Error("Unable to infer the managed team.");
  return bestLinkedTeam;
}

export async function buildCareerSnapshot(
  savePath: string,
  options: SnapshotOptions = {},
): Promise<CareerSnapshot> {
  const save = await parseSave(savePath);
  selectTable(save, "CZUM");
  selectTable(save, "RrqT");
  selectTable(save, "lyxL");

  const mappings = await loadMappings(options.dataDirectory);
  const players = decodeTable(save, "CZUM");
  const links = decodeTable(save, "RrqT");
  const teams = decodeTable(save, "lyxL");
  const contracts = save.tables.has("DvsP") ? decodeTable(save, "DvsP") : [];
  const managedTeamId = inferManagedTeamId(contracts, links, options.teamId);
  const ratingOffset = options.ratingOffset ?? 0;
  const asOf = options.asOf ?? new Date();

  const linkedTeamIds = new Set(
    links.map((row) => numberValue(row, "mCXg")).filter((value): value is number => value !== undefined),
  );
  const teamIdField = chooseTeamIdField(teams, linkedTeamIds);
  const teamNames = new Map<number, string>();

  if (teamIdField) {
    for (const team of teams) {
      const teamId = numberValue(team, teamIdField);
      if (teamId === undefined) continue;
      const inSaveName = typeof team.AUsv === "string" ? team.AUsv : "";
      const mapped = mappings.globalTeams[String(teamId)];
      teamNames.set(teamId, inSaveName && !inSaveName.startsWith("*") ? inSaveName : mapped ?? `Team ${teamId}`);
    }
  }

  const contractByPlayer = new Map<number, DecodedRecord>();
  for (const contract of contracts) {
    const playerId = numberValue(contract, "ykFq");
    const teamId = numberValue(contract, "mCXg");
    if (playerId !== undefined && teamId === managedTeamId) contractByPlayer.set(playerId, contract);
  }

  const linkByPlayer = new Map<number, DecodedRecord>();
  for (const link of links.filter((row) => numberValue(row, "mCXg") === managedTeamId)) {
    const playerId = numberValue(link, "ykFq");
    if (playerId !== undefined && !linkByPlayer.has(playerId)) linkByPlayer.set(playerId, link);
  }

  const playerById = new Map<number, DecodedRecord>();
  for (const player of players) {
    const playerId = numberValue(player, "ykFq");
    if (playerId !== undefined) playerById.set(playerId, player);
  }

  const squad: PlayerSnapshot[] = [];
  for (const [playerId] of linkByPlayer) {
    const record = playerById.get(playerId);
    if (!record) continue;

    const attributes: Record<string, number> = {};
    for (const [code, label] of Object.entries(mappings.fieldLabels.verified)) {
      const raw = numberValue(record, code);
      if (raw !== undefined) attributes[label] = raw + (RATING_FIELDS.has(code) ? ratingOffset : 0);
    }

    const positions: string[] = [];
    const preferredOne = numberValue(record, "wZQU");
    if (preferredOne !== undefined) {
      const mapped = mappings.fieldLabels.positions[String(preferredOne)];
      if (mapped) positions.push(mapped);
    }
    for (const key of ["NgVS", "OblE", "YnYz"]) {
      const raw = numberValue(record, key);
      if (raw && raw > 0) {
        const mapped = mappings.fieldLabels.positions[String(raw - 1)];
        if (mapped && !positions.includes(mapped)) positions.push(mapped);
      }
    }

    const birthRaw = numberValue(record, "WVIU");
    const birthDate = birthRaw ? dateFromLilianDay(birthRaw) : undefined;
    const contract = contractByPlayer.get(playerId);
    const resolvedTeamName = teamNames.get(managedTeamId) ?? mappings.globalTeams[String(managedTeamId)];
    const contractUntil = numberValue(record, "qvmK");
    const weeklyWage = contract ? numberValue(contract, "cmGX") : undefined;

    squad.push({
      playerId,
      name: resolvePlayerName(record, mappings.globalNames),
      teamId: managedTeamId,
      ...(resolvedTeamName ? { teamName: resolvedTeamName } : {}),
      overall: (numberValue(record, "UERs") ?? 0) + ratingOffset,
      potential: (numberValue(record, "mpuH") ?? 0) + ratingOffset,
      ...(birthDate ? { birthDate: birthDate.toISOString().slice(0, 10), age: ageOn(birthDate, asOf) } : {}),
      positions,
      preferredFoot: numberValue(record, "MDvm") === 1 ? "left" : "right",
      heightCm: (numberValue(record, "ypBQ") ?? 0) + 130,
      weightKg: (numberValue(record, "sNZW") ?? 0) + 30,
      skillMoves: (numberValue(record, "BAPc") ?? 0) + 1,
      weakFoot: (numberValue(record, "aOBn") ?? 0) + 1,
      ...(contractUntil !== undefined ? { contractUntil } : {}),
      ...(weeklyWage !== undefined ? { weeklyWage } : {}),
      attributes,
    });
  }

  squad.sort((left, right) => right.overall - left.overall || right.potential - left.potential);

  return {
    savePath,
    managedTeamId,
    managedTeamName: teamNames.get(managedTeamId) ?? mappings.globalTeams[String(managedTeamId)] ?? `Team ${managedTeamId}`,
    players: squad,
  };
}
