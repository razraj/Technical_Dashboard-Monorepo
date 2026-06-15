import { test, expect } from "@playwright/test";

const WEB = process.env.WEB_URL ?? "http://localhost:3001";
const EMAIL = process.env.E2E_EMAIL ?? "dave@example.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "password123";

test.describe("auth and loading UI", () => {
    test.beforeEach(async ({ context }) => {
        await context.clearCookies();
    });

    test("login page shows form without full-page loader", async ({ page }) => {
        await page.goto(`${WEB}/login`);
        await expect(page.getByRole("heading", { name: "Login to your account" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
        // Should not sit on a lone status-only loading page
        await expect(page.getByRole("status")).toHaveCount(0);
    });

    test("browser back from signup shows login form (not full-page loader)", async ({ page }) => {
        await page.goto(`${WEB}/login`);
        await expect(page.getByRole("heading", { name: "Login to your account" })).toBeVisible();
        await page.getByRole("link", { name: "Sign up" }).click();
        await page.waitForURL(/\/signup/);
        await page.goBack();
        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByRole("heading", { name: "Login to your account" })).toBeVisible();
        await expect(page.getByRole("status")).toHaveCount(0);
    });

    test("logged-in user visiting login is redirected to dashboard", async ({ page }) => {
        await page.goto(`${WEB}/login`);
        await page.getByLabel("Email").fill(EMAIL);
        await page.getByLabel("Password").fill(PASSWORD);
        await page.getByRole("button", { name: "Login" }).click();
        await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

        await page.goto(`${WEB}/login`);
        await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    });

    test("unauthenticated dashboard redirects to login", async ({ page }) => {
        await page.goto(`${WEB}/dashboard`);
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        await expect(page.getByRole("heading", { name: "Login to your account" })).toBeVisible();
    });
});
