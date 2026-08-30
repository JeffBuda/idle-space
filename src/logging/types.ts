// src/logging/types.ts
//
// Type definitions for the diagnostic logging system.
// LogCategory groups log entries by game system for the DebugConsole
// filter dropdown. Extensible as new game systems (Economy, Combat,
// etc.) are added to the engine.
export enum LogCategory {
  /** Engine progression: idle distance/time calculations */
  ENGINE_TICK = 'ENGINE_TICK',
}