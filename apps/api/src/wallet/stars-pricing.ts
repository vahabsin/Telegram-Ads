/** Converts a coin amount into Stars, rounding up so the platform never under-charges. */
export function computeStarsAmount(amountCoins: number, coinsPerStar: number): number {
  return Math.max(1, Math.ceil(amountCoins / coinsPerStar));
}
