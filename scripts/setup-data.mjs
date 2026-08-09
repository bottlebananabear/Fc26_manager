import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function flagValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const sourceArgument = flagValue("--source") ?? process.env.FC26_MAPPING_SOURCE;
if (!sourceArgument) {
  throw new Error(
    "Reference data is EA-derived and is not downloaded from GitHub. " +
      "Run: npm run setup-data -- --source C:\\path\\to\\fc26-save-parser\\data",
  );
}

const source = path.resolve(sourceArgument);
const destination = path.resolve(flagValue("--destination") ?? "data");
const required = ["field_labels.json", "nations.json"];
const optional = ["global_names.json", "global_teams.json"];

await mkdir(destination, { recursive: true });
for (const file of [...required, ...optional]) {
  const input = path.join(source, file);
  const metadata = await stat(input).catch(() => undefined);
  if (!metadata?.isFile()) {
    if (required.includes(file)) throw new Error(`Missing required reference file: ${input}`);
    console.warn(`Skipped optional ${file}: not found in ${source}`);
    continue;
  }
  await copyFile(input, path.join(destination, file));
  console.log(`Copied ${file}`);
}
