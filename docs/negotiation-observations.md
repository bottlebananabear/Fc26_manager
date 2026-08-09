# FC 26 negotiation observations

Empirical notes from the Wolves career save. These are observations from actual in-game negotiations, not assumed formulas. Use them to calibrate the negotiation helper over time.

## Working principles

- The game's **recommended wage is a useful acceptance-band anchor**, but not a target that must be paid.
- Very large wage lowballs can be treated as an insult and end talks immediately.
- **Signing bonuses and appearance/clean-sheet bonuses are much softer than base wage** and can often be cut aggressively.
- Base wage appears comparatively sticky once the agent has stated a demand.
- If tension remains low, continue shaving small amounts from wage and/or bonus rather than accepting the first viable counter.
- Internal squad wage structure and intended squad role should determine the walk-away point.
- A free agent being clubless should not be assumed to create a huge wage discount; the game may not model this strongly enough to justify extreme lowballs.

## Contract negotiation examples

### Mathías Olivera — free agent

- Player context: 29 years old, 77 OVR, intended as sporadic LB/defensive depth.
- Agreed role: Sporadic.
- Agreed term: 2 years.
- Game recommended wage: **€69k/week**.
- Wolves offer: **€27k/week + €200k signing bonus**.
- Result: **offer treated as an insult; negotiations ended immediately with no counter**.
- Offer wage as % of recommendation: ~39%.

Observation: dropping base wage to roughly 40% of the game recommendation is unsafe even for an older clubless sporadic player. Recommended wage should be treated as a rough acceptance-band signal.

### Joël Drommel — free agent

- Intended role: Sporadic backup GK.
- Agreed term: 2 years.
- Game recommended wage: **€41.5k/week**.
- Final contract: **€34.5k/week + €140k signing bonus**.
- Final wage as % of recommendation: ~83%.

Observation: a meaningful discount below the recommendation is possible when the opening offer remains within a plausible band.

### Altay Bayındır — free agent

- Intended role: Sporadic backup GK.
- Agreed term: 2 years.
- Wolves initial offer: **€31k/week + €130k signing bonus**.
- Agent counter: **€32.5k/week + €185k signing bonus**.
- Wolves continued negotiating despite a small gap.
- Final contract: **€31.5k/week + €125k signing bonus**.

Observation: after an acceptable-band counter, FC 26 can still tolerate small follow-up reductions. Do not automatically accept a counter when tension leaves room to shave another €0.5k–€1k/week or a modest bonus amount.

### Gonçalo Inácio — transfer signing

- Role: Crucial.
- Term: 4 years.
- Previous wage: ~€28k/week.
- Wolves offer: **€48k/week + €260k signing bonus**.
- Agent counter: **€55k/week + €490k signing bonus + €360k after 5 clean sheets**.
- Tension after counter: ~25%.
- Final contract: **€55k/week + €48k signing bonus, no performance bonus**.

Observation: the agent held firm on base wage but allowed an enormous reduction in guaranteed/conditional bonuses. Treat incentive demands as highly negotiable and do not assume the total value of the agent counter is equally sticky across components.

### Sinaly Diomandé — free agent, negotiation in progress

- Intended role: Sporadic CB depth.
- Agreed term: 3 years.
- Release clause: none.
- Game recommended wage: **€61k/week**.
- Agent opening demand: **€52k/week + €470k signing bonus + €250k after 5 appearances**.
- Wolves counter: **€48k/week + €130k signing bonus, no appearance bonus**.
- Tension increase: ~15%.
- Agent counter: **€52k/week + €155k signing bonus, no appearance bonus**.

Observation: an aggressive cut of €590k from combined signing/appearance bonuses was largely accepted while the agent restored the wage to €52k. This strengthens the hypothesis that **base wage is the hard component and bonuses are soft components**. The first aggressive counter also removed the appearance bonus entirely for only modest tension.

## Transfer-fee examples

### Gonçalo Inácio — Sporting CP to Wolves

- Sporting counter during negotiations reached approximately **André (€17m value) + €40.6m + 10% sell-on**.
- Final deal: **André + €19m + 15% sell-on**.

Observation: AI transfer counters can be dramatically above eventual settlement. A high counter should not automatically reset the club's own valuation upward.

### Toni Fruk — Wolves to Burnley

- Earlier offer level: **€23.6m**.
- Later Burnley offer: **€28.5m**.
- Wolves pushed for another €1m.
- Final agreed sale: **€29.5m**.

Observation: when there is no urgency to sell, even an already-good bid can often be pushed incrementally higher. Small final counters are worthwhile.

## Calibration ideas for the CLI

Future contract-negotiation logic should model these separately:

1. Game recommended wage.
2. Internal squad wage band for the player's role.
3. Agent's stated wage demand.
4. Signing bonus and performance bonuses as separate, softer variables.
5. Current negotiation tension.
6. A configurable `shave` step for low-tension follow-up counters.

Initial empirical wage anchors from these examples:

- ~39% of recommended wage: catastrophic lowball observed.
- ~83% of recommended wage: successful Drommel deal.
- Agent-stated wage can remain sticky while bonus demands collapse by >70%.

Do not treat these percentages as fixed rules yet; more observations are needed.
