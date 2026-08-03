import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface FieldLabels {
  verified: Record<string, string>;
  positions: Record<string, string>;
}

export interface Fc26Mappings {
  fieldLabels: FieldLabels;
  globalNames: Record<string, string>;
  globalTeams: Record<string, string>;
  nations: Record<string, string>;
}

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDirectory = path.resolve(moduleDirectory, "../../data");

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export async function loadMappings(dataDirectory = defaultDataDirectory): Promise<Fc26Mappings> {
  const [fieldLabels, globalNames, globalTeams, nations] = await Promise.all([
    readJson<FieldLabels>(path.join(dataDirectory, "field_labels.json"), {
      verified: {},
      positions: {},
    }),
    readJson<Record<string, string>>(path.join(dataDirectory, "global_names.json"), {}),
    readJson<Record<string, string>>(path.join(dataDirectory, "global_teams.json"), {}),
    readJson<Record<string, string>>(path.join(dataDirectory, "nations.json"), {}),
  ]);

  return { fieldLabels, globalNames, globalTeams, nations };
}
