const BASE_VALUE_CURVE: ReadonlyArray<readonly [overall: number, value: number]> = [
  [50, 100_000], [55, 250_000], [60, 600_000], [65, 1_400_000],
  [70, 3_500_000], [72, 5_500_000], [74, 8_000_000], [76, 12_000_000],
  [78, 19_000_000], [80, 28_000_000], [82, 40_000_000], [84, 55_000_000],
  [86, 74_000_000], [88, 98_000_000], [90, 130_000_000], [92, 165_000_000],
  [94, 205_000_000], [96, 250_000_000],
];

const WAGE_CURVE: ReadonlyArray<readonly [overall: number, weeklyWage: number]> = [
  [50, 1_000], [55, 2_500], [60, 5_000], [65, 10_000], [70, 20_000],
  [74, 30_000], [76, 38_000], [78, 48_000], [80, 63_000], [82, 82_000],
  [84, 108_000], [86, 145_000], [88, 190_000], [90, 250_000],
  [92, 320_000], [94, 400_000],
];

export function estimateMarketValue(overall: number, potential: number, age: number): number {
  validateProfile(overall, potential, age);
  const base = interpolate(BASE_VALUE_CURVE, overall);
  const growth = Math.max(0, potential - overall);
  let multiplier = 1;

  if (age <= 18) multiplier += growth * 0.08 + Math.max(0, potential - 85) * 0.035;
  else if (age <= 21) multiplier += growth * 0.07 + Math.max(0, potential - 85) * 0.025;
  else if (age <= 24) multiplier += growth * 0.04 + Math.max(0, potential - 87) * 0.015;
  else if (age <= 27) multiplier += growth * 0.02;
  else multiplier *= ageMultiplier(age);

  return roundMoney(base * multiplier);
}

export function estimateWeeklyWage(overall: number, potential: number, age: number): number {
  validateProfile(overall, potential, age);
  const base = interpolate(WAGE_CURVE, overall);
  const youthMultiplier = age <= 20 ? 0.82 : age <= 23 ? 0.9 : 1;
  const potentialMultiplier = potential >= 90 ? 1.12 : potential >= 86 ? 1.05 : 1;
  return roundWage(base * youthMultiplier * potentialMultiplier);
}

export function roundMoney(value: number): number {
  if (value >= 100_000_000) return Math.round(value / 1_000_000) * 1_000_000;
  if (value >= 10_000_000) return Math.round(value / 500_000) * 500_000;
  if (value >= 1_000_000) return Math.round(value / 100_000) * 100_000;
  return Math.round(value / 25_000) * 25_000;
}

export function roundWage(value: number): number {
  return value >= 100_000
    ? Math.round(value / 5_000) * 5_000
    : Math.round(value / 1_000) * 1_000;
}

function interpolate(curve: ReadonlyArray<readonly [number, number]>, input: number): number {
  const first = curve[0];
  if (!first) return 0;
  if (input <= first[0]) return first[1];

  for (let index = 1; index < curve.length; index += 1) {
    const lower = curve[index - 1];
    const upper = curve[index];
    if (!lower || !upper) continue;
    if (input <= upper[0]) {
      const ratio = (input - lower[0]) / (upper[0] - lower[0]);
      return lower[1] + ratio * (upper[1] - lower[1]);
    }
  }

  return curve.at(-1)?.[1] ?? 0;
}

function ageMultiplier(age: number): number {
  if (age === 28) return 0.95;
  if (age === 29) return 0.88;
  if (age === 30) return 0.78;
  if (age === 31) return 0.68;
  if (age === 32) return 0.58;
  if (age === 33) return 0.5;
  return Math.max(0.25, 0.5 - (age - 33) * 0.05);
}

function validateProfile(overall: number, potential: number, age: number): void {
  if (overall < 1 || overall > 99) throw new Error("Overall must be between 1 and 99.");
  if (potential < overall || potential > 99) throw new Error("Potential must be between overall and 99.");
  if (age < 14 || age > 50) throw new Error("Age must be between 14 and 50.");
}
