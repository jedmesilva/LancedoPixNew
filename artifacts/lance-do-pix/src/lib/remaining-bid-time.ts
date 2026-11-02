function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatRemainingBidTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
  }
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(remainingSeconds)}`;
}

export function describeRemainingBidTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`);
  }
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(
      `${remainingSeconds} ${remainingSeconds === 1 ? "segundo" : "segundos"}`,
    );
  }

  return parts.join(", ");
}
