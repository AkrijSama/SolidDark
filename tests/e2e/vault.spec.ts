import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase admin env vars are required for e2e vault tests.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createPublicClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase anon env vars are required for e2e vault tests.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function createConfirmedUser(email: string, password: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "SolidDark Vault Test",
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Unable to create test user.");
  }

  return data.user.id;
}

async function waitForUserReady(email: string, password: string) {
  const client = createPublicClient();
  let lastError = "Unknown auth readiness error.";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (!error && data.session) {
      return;
    }

    lastError = error?.message ?? lastError;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`User did not become ready for public login: ${lastError}`);
}

async function createBrowserSession(page: import("@playwright/test").Page, email: string, password: string) {
  const client = createPublicClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw new Error(error?.message ?? "Unable to create browser auth session.");
  }

  const response = await page.context().request.post("http://127.0.0.1:3001/api/auth/session", {
    data: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
  });

  expect(response.ok()).toBeTruthy();
}

async function cleanupUser(userId: string | null) {
  if (!userId) {
    return;
  }

  const admin = createAdminClient();
  const { data } = await admin.from("users").select("id").eq("supabaseId", userId).maybeSingle();

  if (data?.id) {
    await admin.from("vault_entries").delete().eq("userId", data.id);
  }

  await admin.from("users").delete().eq("supabaseId", userId);
  await admin.auth.admin.deleteUser(userId);
}

test.describe("vault flow", () => {
  test.skip(!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey, "Supabase env vars are required.");

  test("Add credential -> View (masked) -> Decrypt -> Edit -> Delete", async ({ page }) => {
    const unique = Date.now();
    const email = `soliddark-vault-${unique}@example.com`;
    const password = `Vault${unique}!Pass`;
    const apiKey = `sk_test_${unique}`;
    let userId: string | null = null;

    try {
      userId = await createConfirmedUser(email, password);
      await waitForUserReady(email, password);
      await createBrowserSession(page, email, password);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto("/dashboard/continuity/vault");
      await expect(page.getByRole("heading", { name: "Credential vault" })).toBeVisible();

      await page.getByRole("button", { name: "Add Credential" }).click();
      await page.getByLabel("Service Name").fill("Stripe");
      await page.locator('button[role="combobox"]').click();
      await page.getByRole("option", { name: "Payment Processor" }).click();
      await page.getByLabel("Username").fill("owner@example.com");
      await page.getByLabel("Password").fill("initial-password");
      await page.getByLabel("API Key").fill(apiKey);
      await page.getByLabel("Notes").fill("Primary production billing account");
      await page.getByRole("button", { name: "Save Credential" }).click();

      await expect(page.getByText("Stripe")).toBeVisible();
      await expect(page.getByText(apiKey)).toHaveCount(0);
      await expect(page.getByText("Primary production billing account")).toHaveCount(0);

      await page.getByRole("button", { name: "Reveal" }).click();
      await page.getByLabel("Current account password").fill(password);
      await page.getByRole("button", { name: "Re-authenticate and reveal" }).click();
      await expect(page.getByText(apiKey)).toBeVisible();
      await expect(page.getByText("Primary production billing account")).toBeVisible();

      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Edit" }).click();
      await page.getByLabel("Current account password").fill(password);
      await page.getByRole("button", { name: "Re-authenticate and reveal" }).click();
      await expect(page.getByRole("heading", { name: "Edit credential" })).toBeVisible();
      await page.getByLabel("Notes").fill("Rotated and reviewed in e2e");
      await page.getByRole("button", { name: "Update Credential" }).click();

      await page.getByRole("button", { name: "Reveal" }).click();
      await page.getByLabel("Current account password").fill(password);
      await page.getByRole("button", { name: "Re-authenticate and reveal" }).click();
      await expect(page.getByText("Rotated and reviewed in e2e")).toBeVisible();

      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByText("Stripe")).toHaveCount(0);
    } finally {
      await cleanupUser(userId);
    }
  });
});
