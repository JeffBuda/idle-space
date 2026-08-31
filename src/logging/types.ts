// src/logging/types.ts
//
// Type definitions for the diagnostic logging system.
// LogCategory groups log entries by game system for the DebugConsole
// filter dropdown. Extensible as new game systems (Economy, Combat,
// etc.) are added to the engine.
export enum LogCategory {
  /** App lifecycle events: going idle, resuming from idle, etc. */
  APP_EVENT = 'APP_EVENT',
  /**
   * Onboarding flow transitions (Launch!, Land, Faster!, mining award, etc.).
   * `withLogging` routes these here. Illegal transitions — which leave a
   * `lastError` on the resulting state — are additionally surfaced as
   * VALIDATION_ERROR (see src/logging/logger.ts).
   */
  GAME_FLOW = 'GAME_FLOW',
  /** A rejected / invalid action (surfaced on an illegal flow transition). */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}
