import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/peer-cash',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
