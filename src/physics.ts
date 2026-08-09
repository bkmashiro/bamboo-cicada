const TAU = Math.PI * 2;

export function angularVelocity(previous: number, current: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  let delta = current - previous;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  return delta / elapsedSeconds;
}

export function soundLevel(speed: number, threshold = 5): number {
  const magnitude = Math.abs(speed);
  if (magnitude <= threshold) return 0;
  return Math.min(1, (magnitude - threshold) / 10);
}

export function damp(value: number, elapsedSeconds: number, drag = 2.4): number {
  return value * Math.exp(-drag * elapsedSeconds);
}
