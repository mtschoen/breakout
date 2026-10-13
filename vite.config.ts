import { defineConfig } from 'vitest/config';

const environment =
  (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process
    ?.env ?? {};
const buildIdentifier = (environment.GITHUB_SHA ?? `local-${Date.now()}`).slice(0, 16);

export default defineConfig({
  base: './',
  define: {
    __BUILD_IDENTIFIER__: JSON.stringify(buildIdentifier),
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});
