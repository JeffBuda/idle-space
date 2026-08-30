/**
 * Architecture enforcement tests powered by ArchUnitTS (npm: archunit).
 *
 * These tests serve as a safety net for the architectural rules documented in:
 *   - ARCHITECTURE.md
 *   - .clinerules/engine.md, .clinerules/ui.md, .clinerules/core.md
 *
 * They enforce layer separation at the dependency level. If ESLint rules are
 * bypassed or misconfigured, these tests will still fail in CI when boundaries
 * are violated.
 */

import { projectFiles } from 'archunit';

// All source files are described by tsconfig.app.json's include pattern.
const configPath = './tsconfig.app.json';

// ---------------------------------------------------------------------------
// Engine layer isolation
// (pure functional game logic - no DOM, no persistence, no React)
// ---------------------------------------------------------------------------
test('engine layer should not depend on db layer', async () => {
  await expect(
    projectFiles(configPath).inFolder('src/engine').shouldNot().dependOnFiles().inFolder('src/db'),
  ).toPassAsync();
});

test('engine layer should not depend on hooks layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/engine')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/hooks'),
  ).toPassAsync();
});

test('engine layer should not depend on components layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/engine')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/components'),
  ).toPassAsync();
});

test('engine layer should have no circular dependencies', async () => {
  await expect(
    projectFiles(configPath).inFolder('src/engine').should().haveNoCycles(),
  ).toPassAsync();
});

// ---------------------------------------------------------------------------
// Db layer isolation
// (IndexedDB persistence - no engine, no React, no DOM)
// ---------------------------------------------------------------------------
test('db layer should not depend on engine layer', async () => {
  await expect(
    projectFiles(configPath).inFolder('src/db').shouldNot().dependOnFiles().inFolder('src/engine'),
  ).toPassAsync();
});

test('db layer should not depend on hooks layer', async () => {
  await expect(
    projectFiles(configPath).inFolder('src/db').shouldNot().dependOnFiles().inFolder('src/hooks'),
  ).toPassAsync();
});

test('db layer should not depend on components layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/db')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/components'),
  ).toPassAsync();
});

test('db layer should not depend on utils layer', async () => {
  await expect(
    projectFiles(configPath).inFolder('src/db').shouldNot().dependOnFiles().inFolder('src/utils'),
  ).toPassAsync();
});

test('db layer should have no circular dependencies', async () => {
  await expect(projectFiles(configPath).inFolder('src/db').should().haveNoCycles()).toPassAsync();
});

// ---------------------------------------------------------------------------
// Components layer isolation
// (presentational React - no engine math, no direct db access)
// ---------------------------------------------------------------------------
test('components layer should not depend on engine layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/components')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/engine'),
  ).toPassAsync();
});

test('components layer should not depend on db layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/components')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/db'),
  ).toPassAsync();
});

test('components layer should have no circular dependencies', async () => {
  await expect(
    projectFiles(configPath).inFolder('src/components').should().haveNoCycles(),
  ).toPassAsync();
});

// ---------------------------------------------------------------------------
// Hooks layer isolation
// (bridge between engine/db and React - no component imports)
// ---------------------------------------------------------------------------
test('hooks layer should not depend on components layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/hooks')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/components'),
  ).toPassAsync();
});

test('hooks layer should have no circular dependencies', async () => {
  await expect(
    projectFiles(configPath).inFolder('src/hooks').should().haveNoCycles(),
  ).toPassAsync();
});

// ---------------------------------------------------------------------------
// Utils layer isolation
// (pure helpers - no dependency on any other internal layer)
// ---------------------------------------------------------------------------
test('utils layer should not depend on engine layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/utils')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/engine'),
  ).toPassAsync();
});

test('utils layer should not depend on db layer', async () => {
  await expect(
    projectFiles(configPath).inFolder('src/utils').shouldNot().dependOnFiles().inFolder('src/db'),
  ).toPassAsync();
});

test('utils layer should not depend on hooks layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/utils')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/hooks'),
  ).toPassAsync();
});

test('utils layer should not depend on components layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/utils')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/components'),
  ).toPassAsync();
});

test('utils layer should have no circular dependencies', async () => {
  await expect(
    projectFiles(configPath).inFolder('src/utils').should().haveNoCycles(),
  ).toPassAsync();
});
// ---------------------------------------------------------------------------
// Logging layer isolation
// (diagnostic logging - depends on engine and db, but not hooks/components)
// ---------------------------------------------------------------------------
test('engine layer should not depend on logging layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/engine')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/logging'),
  ).toPassAsync();
});

test('logging layer should not depend on components layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/logging')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/components'),
  ).toPassAsync();
});

test('logging layer should not depend on hooks layer', async () => {
  await expect(
    projectFiles(configPath)
      .inFolder('src/logging')
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/hooks'),
  ).toPassAsync();
});

test('logging layer should have no circular dependencies', async () => {
  await expect(
    projectFiles(configPath).inFolder('src/logging').should().haveNoCycles(),
  ).toPassAsync();
});
