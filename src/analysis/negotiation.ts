import type { NegotiationRecommendation } from "../types.js";

export interface BuyNegotiationInput {
  marketValue: number;
  age: number;
  overall: number;
  potential: number;
  contractYears?: number;
  transferListed?: boolean;
  starterQuality?: boolean;
  budget?: number;
}

export interface SellNegotiationInput {
  marketValue: number;
  age: number;
  overall: number;
  potential: number;
  contractYears?: number;
  importantPlayer?: boolean;
  richBuyer?: boolean;
}

function roundMoney(value: number): number {
  const increment = value >= 50_000_000 ? 500_000 : value >= 10_000_000 ? 250_000 : 100_000;
  return Math.round(value / increment) * increment;
}

export function recommendBuy(input: BuyNegotiationInput): NegotiationRecommendation {
  const growth = Math.max(0, input.potential - input.overall);
  let openingRate = 0.72;
  let targetLowRate = 0.86;
  let targetHighRate = 0.96;
  let maxRate = 1.05;
  const notes: string[] = [];

  if ((input.contractYears ?? 4) <= 1) {
    openingRate -= 0.14;
    targetLowRate -= 0.12;
    targetHighRate -= 0.08;
    maxRate -= 0.05;
    notes.push("Expiring contract: start materially below market value.");
  }

  if (input.transferListed) {
    openingRate -= 0.08;
    targetLowRate -= 0.05;
    targetHighRate -= 0.03;
    notes.push("Transfer-listed player: apply additional downward pressure.");
  }

  if (input.age <= 21 && growth >= 6) {
    openingRate += 0.06;
    targetLowRate += 0.06;
    targetHighRate += 0.08;
    maxRate += 0.1;
    notes.push("High-upside young player: seller will price future value into the deal.");
  }

  if (input.starterQuality) {
    maxRate += 0.04;
    notes.push("Immediate starter: a modest premium is acceptable.");
  }

  if (input.budget && input.marketValue > input.budget * 0.8) {
    maxRate = Math.min(maxRate, input.budget / input.marketValue);
    notes.push("Budget constraint reduced the walk-away ceiling.");
  }

  const opening = roundMoney(input.marketValue * Math.max(0.45, openingRate));
  const targetLow = roundMoney(input.marketValue * Math.max(openingRate, targetLowRate));
  const targetHigh = roundMoney(input.marketValue * Math.max(targetLowRate, targetHighRate));
  const maximum = roundMoney(input.marketValue * Math.max(targetHighRate, maxRate));
  const step = roundMoney(Math.max(500_000, input.marketValue * 0.045));

  return { opening, targetLow, targetHigh, maximum, step, notes };
}

export function recommendSell(input: SellNegotiationInput): NegotiationRecommendation {
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

  const opening = roundMoney(input.marketValue * openingRate);
  const targetLow = roundMoney(input.marketValue * targetLowRate);
  const targetHigh = roundMoney(input.marketValue * targetHighRate);
  const minimum = roundMoney(input.marketValue * Math.max(0.65, minimumRate));
  const step = roundMoney(Math.max(500_000, input.marketValue * 0.05));

  return {
    opening,
    targetLow,
    targetHigh,
    maximum: minimum,
    step,
    notes: ["For sales, maximum is the minimum acceptable price.", ...notes],
  };
}
