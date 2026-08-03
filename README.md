# FC26 Manager

A local TypeScript CLI for scanning EA SPORTS FC 26 manager-career saves, reviewing the managed squad and producing repeatable transfer-negotiation guidance.

## Current scope

- Finds the newest main career save in the normal FC 26 settings folder.
- Parses the embedded FC 26 database tables directly from the binary save.
- Identifies the managed club from the user-club contract table.
- Builds a squad snapshot with OVR/POT, positions, detailed attributes, wages and contracts.
- Watches the save folder and re-runs the squad scan when a save changes.
- Produces buy/sell negotiation ranges from age, OVR, POT, contract context and scouted data.
- Estimates market value and wages when scouting information is missing, with lower confidence clearly labelled.

The parser uses known hashed FC 26 fields and table names. EA's field codes cannot be reversed algorithmically, so mappings are maintained in `data/field_labels.json`. `UERs` is overall rating and `mpuH` is potential; detailed mappings cover the attributes used in squad and transfer analysis.

## Setup

```powershell
npm install
npm run setup-data -- --source C:\path\to\fc26-save-parser\data
npm run build
```

`global_names.json` and `global_teams.json` are EA-derived and are deliberately not committed. `setup-data` copies them from an existing local parser-data folder instead of downloading or redistributing them.

## Scan a save

On Windows, no path is required:

```powershell
npm run dev -- scan
```

The default is `%LOCALAPPDATA%\EA SPORTS FC 26\settings`. Set `FC26_SAVES` or pass a file/folder explicitly to override it.

```powershell
npm run dev -- scan "C:\path\to\settings"
npm run dev -- scan --json
npm run dev -- scan "C:\path\to\settings" --team 109
npm run dev -- scan "C:\path\to\settings" --rating-offset 0
```

The command selects the newest file beginning with `CmMgrL` while excluding `CmMgrLC` companion saves.

## Watch the save folder

```powershell
npm run dev -- watch
```

The watcher waits briefly after a save-file event, then scans the newest career save again.

## Negotiation helper

A scouted market value gives the highest-confidence result:

```powershell
npm run dev -- negotiate buy \
  --value 32000000 --wage 35000 --age 20 --ovr 79 --pot 85 \
  --contract-years 4 --seller-strength strong --starter --budget 50000000
```

When a player is unscouted, omit `--value`; the tool estimates a starting anchor instead of recommending a blind low bid:

```powershell
npm run dev -- negotiate buy \
  --age 19 --ovr 78 --pot 86 --contract-years 4 --seller-strength strong
```

Sale guidance:

```powershell
npm run dev -- negotiate sell \
  --value 20000000 --age 25 --ovr 78 --pot 78 \
  --contract-years 3 --important --rich-buyer
```

The output separates estimated value, aggressive opening, likely settlement range, step size, walk-away/minimum and wage range. The model is deliberately rules-based so it can be calibrated against actual accepted and rejected FC 26 negotiations.

## Rating offset

Career saves store the mapped rating values one point below the displayed game value, so the scanner defaults to `--rating-offset 1`. Use `--rating-offset 0` when comparing with another tool that already applies that correction.

## Development plan

1. Add save-regression fixtures and automatic in-game-date detection.
2. Add squad-role analysis: best XI, depth, positional weaknesses and development minutes.
3. Add player search and target comparison against the current squad.
4. Read shortlist and asking-price data from the `gllz` table.
5. Persist negotiation outcomes to calibrate accepted/rejected fees, clauses and wages.
6. Persist save snapshots to track OVR/POT growth, loans and transfers.
7. Add a local web UI after the CLI and data model are stable.

## Data notes

- Main player table: `CZUM`
- Player/team links: `RrqT`
- Teams: `lyxL`
- User-club contracts: `DvsP`
- Shortlist/negotiation records: `gllz`
- Market value is not directly available as a verified save field. Modelled values are explicitly labelled estimates.

This is an unofficial fan project and is not affiliated with Electronic Arts.
