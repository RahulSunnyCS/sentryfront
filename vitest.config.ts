import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Global test utilities
    globals: true,
    
    // Setup files
    setupFiles: ['./vitest.setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '.next/',
        'out/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        'vitest.setup.ts',
        'src/app/layout.tsx',
        'src/app/globals.css',
      ],
      // Coverage thresholds
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    
    // Test matching patterns
    include: [
      '**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    
    // Exclude patterns
    // e2e/** and **/e2e/** prevent Playwright *.spec.ts files from being
    // collected by vitest's include globs, which would crash the unit suite.
    exclude: [
      'node_modules',
      '.claude/worktrees/**',
      '.next',
      'out',
      'dist',
      'coverage',
      '**/*.config.*',
      'e2e/**',
      '**/e2e/**',
    ],
    
    // Test timeout
    testTimeout: 10000,
    
    // Hook timeout
    hookTimeout: 10000,
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
