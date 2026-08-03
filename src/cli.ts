#!/usr/bin/env node
import { watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { recommendBuy, recommendSell, type ClubStrength } from "./analysis/negotiation.js";
import { buildCareerSnapshot } from "./fc26/snapshot.js";

function usage(): never {
  console.log(`fc26-manager

Commands:
  scan [save-or-folder] [--team <id>] [--json] [--rating-offset 0|1]
  watch [save-folder] [--team <id>] [--rating-offset 0|1]
  negotiate buy  --age <n> --ovr <n> --pot <n> [--value <amount>] [options]
  negotiate sell --age <n> --ovr <n> --pot <n> [--value <amount>] [options]

Negotiation options:
  --value <amount>             Scouted market value; modelled when omitted
  --wage <amount>              Current weekly wage
  --contract-years <n>
  --seller-strength weak|normal|strong|elite
  --budget <amount>
  --release-clause <amount>
  --listed
  --unwilling
  --starter
  --rival
  --important
  --rich-buyer

The default Windows save folder is %LOCALAPPDATA%\\EA SPORTS FC 26\\settings.
Set FC26_SAVES to override it.
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

function optionalNumber(args: string[], name: string): number | undefined {
  const raw = getFlag(args, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid ${name}: ${raw}`);
  return value;
}

function requiredNumber(args: string[], name: string): number {
  const value = optionalNumber(args, name);
  if (value === undefined) throw new Error(`Missing ${name}`);
  return value;
}

function defaultSaveFolder(): string {
  if (process.env.FC26_SAVES) return process.env.FC26_SAVES;
  if (process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "EA SPORTS FC 26", "settings");
  }
  throw new Error("No save path supplied and FC26_SAVES/LOCALAPPDATA is unavailable.");
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
  const teamId = optionalNumber(args, "--team");
  const offsetRaw = getFlag(args, "--rating-offset");
  if (offsetRaw !== undefined && offsetRaw !== "0" && offsetRaw !== "1") {
    throw new Error(`Invalid --rating-offset: ${offsetRaw}`);
  }
  const ratingOffset = offsetRaw === "0" ? 0 : 1;
  const snapshot = await buildCareerSnapshot(savePath, {
    ...(teamId !== undefined ? { teamId } : {}),
    ratingOffset,
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

function sellerStrength(args: string[]): ClubStrength | undefined {
  const value = getFlag(args, "--seller-strength");
  if (value === undefined) return undefined;
  if (["weak", "normal", "strong", "elite"].includes(value)) return value as ClubStrength;
  throw new Error(`Invalid --seller-strength: ${value}`);
}

function formatMoney(value: number | undefined): string {
  if (value === undefined) return "-";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function runNegotiation(side: "buy" | "sell", args: string[]): void {
  const marketValue = optionalNumber(args, "--value");
  const contractYears = optionalNumber(args, "--contract-years");
  const currentWage = optionalNumber(args, "--wage");
  const strength = sellerStrength(args);
  const releaseClause = optionalNumber(args, "--release-clause");
  const budget = optionalNumber(args, "--budget");
  const common = {
    age: requiredNumber(args, "--age"),
    overall: requiredNumber(args, "--ovr"),
    potential: requiredNumber(args, "--pot"),
    ...(marketValue !== undefined ? { marketValue } : {}),
    ...(contractYears !== undefined ? { contractYears } : {}),
  };

  const recommendation =
    side === "buy"
      ? recommendBuy({
          ...common,
          ...(currentWage !== undefined ? { currentWage } : {}),
          transferListed: hasFlag(args, "--listed"),
          unwillingToSell: hasFlag(args, "--unwilling"),
          starterQuality: hasFlag(args, "--starter"),
          ...(strength !== undefined ? { sellerStrength: strength } : {}),
          rivalry: hasFlag(args, "--rival"),
          ...(releaseClause !== undefined ? { releaseClause } : {}),
          ...(budget !== undefined ? { budget } : {}),
        })
      : recommendSell({
          ...common,
          importantPlayer: hasFlag(args, "--important"),
          richBuyer: hasFlag(args, "--rich-buyer"),
        });

  console.table({
    estimatedValue: formatMoney(recommendation.estimatedMarketValue),
    opening: formatMoney(recommendation.opening),
    targetLow: formatMoney(recommendation.targetLow),
    targetHigh: formatMoney(recommendation.targetHigh),
    [side === "buy" ? "walkAway" : "minimum"]: formatMoney(recommendation.maximum),
    step: formatMoney(recommendation.step),
    ...(side === "buy"
      ? {
          openingWage: `${formatMoney(recommendation.openingWage)}/week`,
          targetWage: `${formatMoney(recommendation.targetWageLow)}–${formatMoney(recommendation.targetWageHigh)}/week`,
          confidence: recommendation.confidence ?? "-",
        }
      : {}),
  });
  for (const note of recommendation.notes) console.log(`- ${note}`);
}

async function main(): Promise<void> {
  const [command, first, ...rest] = process.argv.slice(2);
  if (!command) usage();

  if (command === "scan" || command === "watch") {
    const hasPath = first !== undefined && !first.startsWith("--");
    const inputPath = hasPath && first !== undefined ? first : defaultSaveFolder();
    const args = hasPath ? rest : [first, ...rest].filter((value): value is string => value !== undefined);
    if (command === "scan") await runScan(inputPath, args);
    else await runWatch(inputPath, args);
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
