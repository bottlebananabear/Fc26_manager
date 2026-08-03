#!/usr/bin/env node
import { watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { recommendBuy, recommendSell } from "./analysis/negotiation.js";
import { buildCareerSnapshot } from "./fc26/snapshot.js";

function usage(): never {
  console.log(`fc26-manager

Commands:
  scan <save-or-folder> [--team <id>] [--json] [--rating-offset 0|1]
  watch <save-folder> [--team <id>] [--rating-offset 0|1]
  negotiate buy  --value <amount> --age <n> --ovr <n> --pot <n> [options]
  negotiate sell --value <amount> --age <n> --ovr <n> --pot <n> [options]

Negotiation options:
  --contract-years <n>
  --budget <amount>
  --listed
  --starter
  --important
  --rich-buyer
`);
  process.exit(1);
}

function getFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function requiredNumber(args: string[], name: string): number {
  const raw = getFlag(args, name);
  const value = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value)) throw new Error(`Missing or invalid ${name}`);
  return value;
}

async function latestSave(inputPath: string): Promise<string> {
  const metadata = await stat(inputPath);
  if (metadata.isFile()) return inputPath;

  const entries = await readdir(inputPath, { withFileTypes: true });
  const saves = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^CmMgrL(?!C)/.test(entry.name))
      .map(async (entry) => {
        const filePath = path.join(inputPath, entry.name);
        const fileStat = await stat(filePath);
        return { filePath, modified: fileStat.mtimeMs };
      }),
  );

  const latest = saves.sort((left, right) => right.modified - left.modified)[0];
  if (!latest) throw new Error(`No main career save beginning with CmMgrL found in ${inputPath}`);
  return latest.filePath;
}

async function runScan(inputPath: string, args: string[]): Promise<void> {
  const savePath = await latestSave(inputPath);
  const teamIdRaw = getFlag(args, "--team");
  const offsetRaw = getFlag(args, "--rating-offset");
  const snapshot = await buildCareerSnapshot(savePath, {
    ...(teamIdRaw ? { teamId: Number(teamIdRaw) } : {}),
    ...(offsetRaw === "0" || offsetRaw === "1" ? { ratingOffset: Number(offsetRaw) as 0 | 1 } : {}),
  });

  if (hasFlag(args, "--json")) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log(`${snapshot.managedTeamName} | ${path.basename(snapshot.savePath)} | ${snapshot.players.length} players`);
  console.table(
    snapshot.players.map((player) => ({
      name: player.name,
      pos: player.positions.join("/"),
      ovr: player.overall,
      pot: player.potential,
      age: player.age ?? "?",
      wage: player.weeklyWage ?? "?",
      contract: player.contractUntil ?? "?",
    })),
  );
}

async function runWatch(inputPath: string, args: string[]): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const execute = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void runScan(inputPath, args).catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
      });
    }, 1_500);
  };

  await runScan(inputPath, args);
  watch(inputPath, { persistent: true }, (_eventType, fileName) => {
    if (fileName && /^CmMgrL(?!C)/.test(fileName)) execute();
  });
  console.log(`Watching ${inputPath} for updated FC 26 career saves...`);
}

function runNegotiation(side: "buy" | "sell", args: string[]): void {
  const common = {
    marketValue: requiredNumber(args, "--value"),
    age: requiredNumber(args, "--age"),
    overall: requiredNumber(args, "--ovr"),
    potential: requiredNumber(args, "--pot"),
    ...(getFlag(args, "--contract-years")
      ? { contractYears: requiredNumber(args, "--contract-years") }
      : {}),
  };

  const recommendation =
    side === "buy"
      ? recommendBuy({
          ...common,
          transferListed: hasFlag(args, "--listed"),
          starterQuality: hasFlag(args, "--starter"),
          ...(getFlag(args, "--budget") ? { budget: requiredNumber(args, "--budget") } : {}),
        })
      : recommendSell({
          ...common,
          importantPlayer: hasFlag(args, "--important"),
          richBuyer: hasFlag(args, "--rich-buyer"),
        });

  console.table({
    opening: recommendation.opening,
    targetLow: recommendation.targetLow,
    targetHigh: recommendation.targetHigh,
    [side === "buy" ? "walkAway" : "minimum"]: recommendation.maximum,
    step: recommendation.step,
  });
  for (const note of recommendation.notes) console.log(`- ${note}`);
}

async function main(): Promise<void> {
  const [command, first, ...rest] = process.argv.slice(2);
  if (!command) usage();

  if (command === "scan" && first) {
    await runScan(first, rest);
    return;
  }

  if (command === "watch" && first) {
    await runWatch(first, rest);
    return;
  }

  if (command === "negotiate" && (first === "buy" || first === "sell")) {
    runNegotiation(first, rest);
    return;
  }

  usage();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
