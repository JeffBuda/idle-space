// timeUtils.ts
export function calculateElapsedTime(elapsedMs: number) {
  const msInASecond = 1000;
  const msInAMinute = msInASecond * 60;
  const msInAnHour = msInAMinute * 60;
  const msInADay = msInAnHour * 24;
  const msInAWeek = msInADay * 7;
  const msInAMonth = msInADay * 30; // Approximate month length

  const months = Math.floor(elapsedMs / msInAMonth);
  elapsedMs %= msInAMonth;

  const weeks = Math.floor(elapsedMs / msInAWeek);
  elapsedMs %= msInAWeek;

  const days = Math.floor(elapsedMs / msInADay);
  elapsedMs %= msInADay;

  const hours = Math.floor(elapsedMs / msInAnHour);
  elapsedMs %= msInAnHour;

  const minutes = Math.floor(elapsedMs / msInAMinute);
  elapsedMs %= msInAMinute;

  const seconds = Math.floor(elapsedMs / msInASecond);

  return {
    months,
    weeks,
    days,
    hours,
    minutes,
    seconds,
  };
}