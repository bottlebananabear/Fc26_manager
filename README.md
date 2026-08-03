# FC26 Manager

A local TypeScript CLI for scanning EA Sports FC 26 career saves, reviewing a managed squad, and producing repeatable transfer-negotiation guidance.

## Current scope

- Finds the newest main career save in a folder.
- Parses the embedded FC 26 database tables directly from the binary save.
- Identifies the managed club from the user-club contract table.
- Builds a squad snapshot with OVR/POT, positions, attributes, wages and contract years.
- Watches the save folder and re-runs the squad scan when the save changes.
- Produces buy/sell negotiation ranges from market value, age, rating, potential and contract context.

The parser uses the known hashed FC 26 fields and table names. EA's field codes cannot be reversed algorithmically, so mappings are maintained in `data/field_labels.json`. The current mapping recognises `UERs` as overall rating and `mpuH` as potential, plus the detailed attributes used in squad and transfer analysis.

## Setup

```bash
npm install
npm run setup-data
npm run build
```

`setup-data` downloads the large player-name, team and nation mappings used by the save decoder. They are kept out of the repository so the project remains small.

## Scan a save

```bash
npm run dev -- scan "C:\\Users\\you\\Documents\\FC 26\\settings"
```

The command selects the newest file beginning with `CmMgrL` while excluding `CmMgrLC` companion saves.

Useful options:

```bash
npm run dev -- scan "C:\\path\\to\\save-folder" --json
npm run dev -- scan "C:\\path\\to\\save-folder" --team 109
npm run dev -- scan "C:\\path\\to\\save-folder" --rating-offset 1
```

## Watch the save folder

```bash
npm run dev -- watch "C:\\path\\to\\save-folder"
```

The watcher waits briefly after a save-file event, then scans the newest career save again.

## Negotiation helper

```bash
npm run dev -- negotiate buy \
  --value 32000000 --age 20 --ovr 79 --pot 85 \
  --contract-years 4 --starter --budget 50000000

npm run dev -- negotiate sell \
  --value 20000000 --age 25 --ovr 78 --pot 78 \
  --contract-years 3 --important --rich-buyer
```

The output separates the aggressive opening, likely settlement range, step size and walk-away/minimum value. It is deliberately rules-based so we can calibrate it against actual FC 26 negotiation outcomes rather than presenting unsupported precision.

## Development plan

1. Add parser fixtures and save-regression tests.
2. Add squad-role analysis: best XI, depth, positional weaknesses and development minutes.
3. Add target comparison against the current squad.
4. Read shortlist and asking-price data from the `gllz` table.
5. Persist historical save snapshots to track OVR/POT growth, loans and transfers.
6. Add a local web UI after the CLI and data model are stable.

## Data notes

- Main player table: `CZUM`
- Player/team links: `RrqT`
- Teams: `lyxL`
- User-club contracts: `DvsP`
- Shortlist/negotiation records: `gllz`
- Rating storage appears to vary by save/context. The current Wolves saves match `--rating-offset 0`; the CLI supports `--rating-offset 1` for saves that store displayed ratings one point lower. A later calibration step will detect this automatically.
- Market value is not directly stored in the save and must currently be entered from the game UI. A later model may estimate it, but estimates will be labelled as estimates.
