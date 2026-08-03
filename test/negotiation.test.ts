import { describe, expect, it } from "vitest";
import { recommendBuy, recommendSell } from "../src/analysis/negotiation.js";

describe("negotiation recommendations", () => {
  it("charges a development premium for elite young targets", () => {
    const recommendation = recommendBuy({
      marketValue: 32_000_000,
      age: 20,
      overall: 79,
      potential: 86,
      contractYears: 4,
      starterQuality: true,
      budget: 60_000_000,
    });

    expect(recommendation.opening).toBeLessThan(recommendation.targetLow);
    expect(recommendation.targetLow).toBeLessThanOrEqual(recommendation.targetHigh);
    expect(recommendation.maximum).toBeGreaterThan(recommendation.targetHigh);
    expect(recommendation.notes.some((note) => note.includes("High-upside"))).toBe(true);
  });

  it("reduces a buy range for an expiring listed player", () => {
    const normal = recommendBuy({
      marketValue: 40_000_000,
      age: 27,
      overall: 82,
      potential: 82,
      contractYears: 4,
    });
    const discounted = recommendBuy({
      marketValue: 40_000_000,
      age: 27,
      overall: 82,
      potential: 82,
      contractYears: 1,
      transferListed: true,
    });

    expect(discounted.opening).toBeLessThan(normal.opening);
    expect(discounted.maximum).toBeLessThan(normal.maximum);
  });

  it("raises the asking price for an important prospect sold to a rich buyer", () => {
    const recommendation = recommendSell({
      marketValue: 20_000_000,
      age: 21,
      overall: 76,
      potential: 86,
      contractYears: 4,
      importantPlayer: true,
      richBuyer: true,
    });

    expect(recommendation.opening).toBeGreaterThan(20_000_000);
    expect(recommendation.targetHigh).toBeGreaterThan(recommendation.targetLow);
    expect(recommendation.maximum).toBeGreaterThanOrEqual(20_000_000);
  });
});
