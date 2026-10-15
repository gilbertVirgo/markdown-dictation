import { defineConfig, devices } from '@playwright/test'

try { process.loadEnvFile('.env') } catch { /* no .env: E2E spec skips */ }

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:8888', ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
  webServer: { command: 'npx netlify dev', url: 'http://localhost:8888', reuseExistingServer: true, timeout: 120000 },
})
