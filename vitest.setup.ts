// vitest.setup.ts

// Import any global libraries or setup code
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Example: Setting up a global variable
globalThis.myGlobalVariable = 'some value';

// Example: Mocking a global function
globalThis.myGlobalFunction = () => 'mocked value';

// Example: Setting up hooks
beforeAll(() => {
  console.log('Running before all tests');
});

afterAll(() => {
  console.log('Running after all tests');
});

beforeEach(() => {
  console.log('Running before each test');
});

afterEach(() => {
  console.log('Running after each test');
});