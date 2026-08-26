import { computeStarsAmount } from "./stars-pricing";

describe("computeStarsAmount", () => {
  it("rounds up so the platform never under-charges", () => {
    expect(computeStarsAmount(250, 100)).toBe(3);
  });

  it("returns an exact quotient unchanged", () => {
    expect(computeStarsAmount(300, 100)).toBe(3);
  });

  it("never returns less than 1 Star, even for tiny amounts", () => {
    expect(computeStarsAmount(1, 100)).toBe(1);
  });
});
