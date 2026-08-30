// Build-time constants injected by Vite's `define` option.
// These identifiers (__APP_VERSION__, __BUILD_TIME__) are declared as
// global consts in src/vite-env.d.ts and replaced at build/test time
// with their JSON-stringified values. See vite.config.ts and vitest.config.ts.
export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_TIME: string = __BUILD_TIME__;
