import type { NegotiationRecommendation } from "../types.js";
import { estimateMarketValue, estimateWeeklyWage, roundMoney, roundWage } from "./valuation.js";

export type ClubStrength = "weak" | "normal" | "strong" | "elite";

export interface BuyNegotiationInput {
  marketValue?: number;
  currentWage?: number;
  age: number;
  overall: number;
  potential: number;
  contractYears?: number;
  transferListed?: boolean;
  unwillingToSell?: boolean;
  starterQuality?: boolean;
  sellerStrength?: ClubStrength;
  rivalry?: boolean;
  releaseClause?: number;
  budget?: number;
}

export interface SellNegotiationInput {
  marketValue?: number;
  age: number;
  overall: number;
  potential: number;
  contractYears?: number;
  importantPlayer?: boolean;
  richBuyer?: boolean;
}

export function recommendBuy(input: BuyNegotiationInput): NegotiationRecommendation {
  const marketValue = input.marketValue ?? estimateMarketValue(input.overall, input.potential, input.age);
  const growth = Math.max(0, input.potential - input.overall);
  const strengthPremium = { weak: -0.04, normal: 0, strong: 0.04, elite: 0.08 }[
    input.sellerStrength ?? "normal"
  ];
  let openingRate = 0.81 + strengthPremium;
  let targetLowRate = 0.92 + strengthPremium;
  let targetHighRate = 1.02 + strengthPremium;
  let maxRate = 1.14 + strengthPremium;
  const notes: string[] = [];

  if ((input.contractYears ?? 3) <= 1) {
    openingRate -= 0.11;
    targetLowRate -= 0.12;
    targetHighRate -= 0.1;
    maxRate -= 0.08;
    notes.push("Contract is close to expiry; use that leverage and resist a full-value price.");
  } else if ((input.contractYears ?? 3) >= 4) {
    openingRate += 0.03;
    targetLowRate += 0.03;
    targetHighRate += 0.04;
    maxRate += 0.05;
  }

  if (input.transferListed) {
    openingRate -= 0.08;
    targetLowRate -= 0.08;
    targetHighRate -= 0.05;
    maxRate -= 0.04;
    notes.push("Transfer-listed player: apply additional downward pressure.");
  }

  if (input.unwillingToSell) {
    openingRate += 0.09;
    targetLowRate += 0.08;
    targetHighRate += 0.1;
    maxRate += 0.13;
    notes.push("The selling club is unwilling, so expect a meaningful premium or a failed negotiation.");
  }

  if (input.age <= 21 && input.potential >= 85) {
    openingRate += 0.05;
    targetLowRate += 0.05;
    targetHighRate += 0.06;
    maxRate += 0.07;
    notes.push("High-upside young player: clubs often reject speculative low bids immediately.");
  } else if (growth >= 5) {
    openingRate += 0.025;
    targetHighRate += 0.03;
  }

  if (input.starterQuality) {
    maxRate += 0.04;
    notes.push("Immediate starter: a modest premium is acceptable.");
  }

  if (input.rivalry) {
    openingRate += 0.05;
    targetLowRate += 0.06;
    targetHighRate += 0.07;
    maxRate += 0.08;
    notes.push("Rivalry premium applied.");
  }

  let opening = roundMoney(marketValue * Math.max(0.45, openingRate));
  let targetLow = roundMoney(marketValue * Math.max(openingRate, targetLowRate));
  let targetHigh = roundMoney(marketValue * Math.max(targetLowRate, targetHighRate));
  let maximum = roundMoney(marketValue * Math.max(targetHighRate, maxRate));

  if (input.releaseClause && input.releaseClause > 0) {
    maximum = Math.min(maximum, input.releaseClause);
    if (input.releaseClause <= targetHigh) {
      opening = input.releaseClause;
      targetLow = input.releaseClause;
      targetHigh = input.releaseClause;
      notes.push("Release clause is at or below the expected settlement; trigger it directly.");
    }
  }

  if (input.budget && maximum > input.budget) {
    maximum = input.budget;
    notes.push("Budget constraint reduced the walk-away ceiling.");
  }

  const wageAnchor = input.currentWage ?? estimateWeeklyWage(input.overall, input.potential, input.age);
  const openingWage = roundWage(wageAnchor * (input.currentWage ? 1.05 : 0.95));
  const targetWageLow = roundWage(wageAnchor * (input.currentWage ? 1.12 : 1));
  const targetWageHigh = roundWage(wageAnchor * (input.currentWage ? 1.28 : 1.18));

  if (input.marketValue === undefined) {
    notes.unshift("Market value is modelled from age, OVR and POT because scouting data is unavailable.");
  }
  if (input.currentWage === undefined) {
    notes.push("Wage range is modelled; let the agent state their demand first where possible.");
  }
  notes.push("Raise the fee in small steps after rejection rather than jumping to the ceiling.");

  return {
    opening,
    targetLow,
    targetHigh,
    maximum,
    step: roundMoney(Math.max(500_000, marketValue * 0.045)),
    estimatedMarketValue: marketValue,
    openingWage,
    targetWageLow,
    targetWageHigh,
    confidence: input.marketValue !== undefined ? "high" : input.currentWage !== undefined ? "medium" : "low",
    notes,
  };
}

export function recommendSell(input: SellNegotiationInput): NegotiationRecommendation {
  const marketValue = input.marketValue ?? estimateMarketValue(input.overall, input.potential, input.age);
  const growth = Math.max(0, input.potential - input.overall);
  let openingRate = 1.2;
  let targetLowRate = 1.05;
  let targetHighRate = 1.15;
  let minimumRate = 0.95;
  const notes: string[] = [];

  if (input.age <= 23 && growth >= 5) {
    openingRate += 0.12;
    targetLowRate += 0.08;
    targetHighRate += 0.1;
    minimumRate += 0.05;
    notes.push("Young high-potential player: demand a development premium.");
  }
  if (input.importantPlayer) {
    openingRate += 0.08;
    targetLowRate += 0.05;
    targetHighRate += 0.05;
    minimumRate += 0.05;
    notes.push("Important squad member: replacement cost increases the minimum.");
  }
  if (input.richBuyer) {
    openingRate += 0.07;
    targetHighRate += 0.05;
    notes.push("Wealthy buyer: push the counteroffer higher.");
  }
  if ((input.contractYears ?? 4) <= 1) {
    openingRate -= 0.12;
    targetLowRate -= 0.1;
    targetHighRate -= 0.08;
    minimumRate -= 0.12;
    notes.push("Expiring contract weakens leverage.");
  }
  if (input.marketValue === undefined) {
    notes.unshift("Market value is modelled from age, OVR and POT because no value was supplied.");
  }

  return {
    opening: roundMoney(marketValue * openingRate),
    targetLow: roundMoney(marketValue * targetLowRate),
    targetHigh: roundMoney(marketValue * targetHighRate),
    maximum: roundMoney(marketValue * Math.max(0.65, minimumRate)),
    step: roundMoney(Math.max(500_000, marketValue * 0.05)),
    estimatedMarketValue: marketValue,
    confidence: input.marketValue !== undefined ? "high" : "low",
    notes: ["For sales, maximum is the minimum acceptable price.", ...notes],
  };
}
