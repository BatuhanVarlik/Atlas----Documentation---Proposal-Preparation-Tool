import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'lib/**/__tests__/**/*.test.ts',
      // Saf mantık taşıyan istemci yardımcıları (taslak saklama gibi) da testli.
      'components/**/__tests__/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
