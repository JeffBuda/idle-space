// src/utils/time.test.ts
import { describe, it, expect } from 'vitest'
import { calculateElapsedSeconds, formatElapsedTime, formatLogTimestamp } from './time'

describe('calculateElapsedSeconds', () => {
  it('should calculate seconds between two timestamps', () => {
    const last = 1_000_000
    const now = 2_000_000
    expect(calculateElapsedSeconds(last, now)).toBe(1000)
  })

  it('should return 0 when timestamps are equal', () => {
    const timestamp = 1_000_000
    expect(calculateElapsedSeconds(timestamp, timestamp)).toBe(0)
  })

  it('should return 0 when current timestamp is before last timestamp', () => {
    const last = 2_000_000
    const now = 1_000_000
    expect(calculateElapsedSeconds(last, now)).toBe(0)
  })

  it('should round down to whole seconds', () => {
    const last = 1_000_000
    const now = 1_000_500 // 0.5 second difference
    expect(calculateElapsedSeconds(last, now)).toBe(0)
  })

  it('should handle sub-second differences correctly', () => {
    const last = 1_000_000
    const now = 1_500_000 // 500 seconds
    expect(calculateElapsedSeconds(last, now)).toBe(500)
  })
})

describe('formatElapsedTime', () => {
  it('should format seconds only', () => {
    expect(formatElapsedTime(45)).toBe('45s')
  })

  it('should format minutes and seconds', () => {
    expect(formatElapsedTime(125)).toBe('2m 5s')
  })

  it('should format hours, minutes, and seconds', () => {
    expect(formatElapsedTime(3725)).toBe('1h 2m 5s')
  })

  it('should format days, hours, minutes, and seconds', () => {
    expect(formatElapsedTime(90125)).toBe('1d 1h 2m 5s')
  })

  it('should handle zero elapsed time', () => {
    expect(formatElapsedTime(0)).toBe('0s')
  })

  it('should omit zero-value components (except seconds)', () => {
    expect(formatElapsedTime(3600)).toBe('1h 0s')
    expect(formatElapsedTime(86400)).toBe('1d 0s')
    // 90061 seconds = 1 day, 1 hour, 1 minute, 1 second
    expect(formatElapsedTime(90061)).toBe('1d 1h 1m 1s')
  })

  it('should handle large values with multiple days', () => {
    const days = 30 * 86400 + 5 * 3600 + 30 * 60 + 15
    expect(formatElapsedTime(days)).toBe('30d 5h 30m 15s')
  })
})

describe('formatLogTimestamp', () => {
  it('should format a timestamp as short locale date and time', () => {
    const ts = new Date('2024-06-15T10:30:45.000Z').getTime()
    const result = formatLogTimestamp(ts)
    // Should NOT be ISO 8601 format (no 'T' separator, no 'Z' suffix)
    expect(result).not.toMatch(/T\d{2}:\d{2}/)
    expect(result).not.toMatch(/Z$/)
    // Should contain a time separator
    expect(result).toContain(':')
    // Should be a non-empty string
    expect(result.length).toBeGreaterThan(0)
  })

  it('should produce a different output than toISOString', () => {
    const ts = new Date('2024-06-15T10:30:45.000Z').getTime()
    const result = formatLogTimestamp(ts)
    const iso = new Date(ts).toISOString()
    expect(result).not.toBe(iso)
  })

  it('should handle the current time', () => {
    const ts = Date.now()
    const result = formatLogTimestamp(ts)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
