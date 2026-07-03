// Used for prescribed working weights. Program percentages should stay as close
// as possible to the intended load; small TM increases may not visibly change
// every week after rounding to available 2.5 kg plate jumps.
export function roundToNearest2p5(v: number) {
  if (!Number.isFinite(v)) return 0;
  if (v <= 0) return 0;
  return Math.round(v / 2.5) * 2.5;
}
