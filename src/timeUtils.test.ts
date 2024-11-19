import { calculateElapsedTime } from './timeUtils';

describe('calculateElapsedTime', () => {
  it('should return all zeros when no milliseconds are passed in', () => {
    const result = calculateElapsedTime(0);
    expect(result).toEqual({
      months: 0,
      weeks: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });

  it('should correctly calculate elapsed time for two months plus some extra hours', () => {
    const msInASecond = 1000;
    const msInAMinute = msInASecond * 60;
    const msInAnHour = msInAMinute * 60;
    const msInADay = msInAnHour * 24;
    const msInAMonth = msInADay * 30; // Approximate month length

    const twoMonthsInMs = msInAMonth * 2;
    const extraHoursInMs = msInAnHour * 5; // 5 extra hours

    const elapsedMs = twoMonthsInMs + extraHoursInMs;

    const result = calculateElapsedTime(elapsedMs);
    expect(result).toEqual({
      months: 2,
      weeks: 0,
      days: 0,
      hours: 5,
      minutes: 0,
      seconds: 0,
    });
  });

  it('should correctly calculate elapsed time for one week, three days, and 10 minutes', () => {
    const msInASecond = 1000;
    const msInAMinute = msInASecond * 60;
    const msInAnHour = msInAMinute * 60;
    const msInADay = msInAnHour * 24;
    const msInAWeek = msInADay * 7;

    const oneWeekInMs = msInAWeek;
    const threeDaysInMs = msInADay * 3;
    const tenMinutesInMs = msInAMinute * 10;

    const elapsedMs = oneWeekInMs + threeDaysInMs + tenMinutesInMs;

    const result = calculateElapsedTime(elapsedMs);
    expect(result).toEqual({
      months: 0,
      weeks: 1,
      days: 3,
      hours: 0,
      minutes: 10,
      seconds: 0,
    });
  });
});