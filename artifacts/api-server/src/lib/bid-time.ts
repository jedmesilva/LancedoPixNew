export function secondsRemainingAtOvertake(
  bidExpiresAt: Date,
  overtakenAt: Date,
): number {
  return Math.max(
    0,
    Math.ceil((bidExpiresAt.getTime() - overtakenAt.getTime()) / 1_000),
  );
}
