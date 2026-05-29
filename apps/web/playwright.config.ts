import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    timeout: 30_000,
    use: {
        baseURL: process.env.WEB_URL ?? "http://localhost:3001",
        trace: "on-first-retry"
    },
    webServer: process.env.PW_SKIP_WEBSERVER
        ? undefined
        : {
              command: "yarn workspace web dev",
              url: "http://localhost:3001/login",
              reuseExistingServer: true,
              timeout: 120_000
          }
});
