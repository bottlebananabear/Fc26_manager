import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourceBase =
  process.env.FC26_MAPPING_SOURCE ??
  "https://raw.githubusercontent.com/mhirst1992/fc26-save-parser/main/data";

const files = ["global_names.json", "global_teams.json", "nations.json"];
const destination = path.resolve(process.cwd(), "data");

await mkdir(destination, { recursive: true });

for (const file of files) {
  const url = `${sourceBase}/${file}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download ${url}: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  JSON.parse(content);
  await writeFile(path.join(destination, file), content, "utf8");
  console.log(`Downloaded data/${file}`);
}
