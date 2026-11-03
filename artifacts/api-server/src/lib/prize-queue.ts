import { randomInt } from "node:crypto";

type TierLike = { id: number };
type ForecastLike = { tierId: number; passed: boolean };

export function eligiblePrizeCandidates<
  TTier extends TierLike,
  TForecast extends ForecastLike,
>(tiers: readonly TTier[], forecasts: readonly TForecast[]) {
  const forecastsByTierId = new Map(
    forecasts.map((forecast) => [forecast.tierId, forecast]),
  );

  return tiers.flatMap((tier) => {
    const forecast = forecastsByTierId.get(tier.id);
    return forecast?.passed ? [{ tier, forecast }] : [];
  });
}

export function shufflePrizeCandidates<T>(
  candidates: readonly T[],
  chooseIndex: (upperExclusive: number) => number = (upperExclusive) =>
    randomInt(upperExclusive),
): T[] {
  const shuffled = [...candidates];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const selectedIndex = chooseIndex(index + 1);
    if (
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex > index
    ) {
      throw new RangeError("The queue shuffle returned an invalid index.");
    }
    [shuffled[index], shuffled[selectedIndex]] = [
      shuffled[selectedIndex]!,
      shuffled[index]!,
    ];
  }

  return shuffled;
}
