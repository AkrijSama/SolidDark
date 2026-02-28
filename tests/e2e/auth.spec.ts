import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase admin env vars are required for e2e auth tests.");
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
    throw new Error("Supabase anon env vars are required for e2e auth tests.");
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
      full_name: "SolidDark Auth Test",
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Unable to create auth test user.");
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
  await admin.from("users").delete().eq("supabaseId", userId);
  await admin.auth.admin.deleteUser(userId);
}

test.describe("auth flow", () => {
  test.skip(!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey, "Supabase env vars are required.");

  test("Signup page -> Login -> Dashboard -> Logout", async ({ page }) => {
    const unique = Date.now();
    const email = `soliddark-auth-login-${unique}@example.com`;
    const password = `Auth${unique}!Pass`;
    let userId: string | null = null;

    try {
      await page.goto("/signup?redirectTo=%2Fdashboard");
      await page.getByLabel("Full Name").fill("SolidDark Auth Test");
      await page.getByLabel("Email").fill(`soliddark-auth-signup-${unique}@mailinator.com`);
      await page.getByLabel("Password").fill(`Signup${unique}!Pass`);
      await page.goto("/login?redirectTo=%2Fdashboard");
      await expect(page.getByRole("heading", { name: "Log in to SolidDark" })).toBeVisible();

      userId = await createConfirmedUser(email, password);
      await waitForUserReady(email, password);
      await createBrowserSession(page, email, password);
      await page.goto("/dashboard");

      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: "Your protection stack" })).toBeVisible();

      await page.getByText(email).click();
      await page.getByRole("menuitem", { name: "Logout" }).click();

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Log in to SolidDark" })).toBeVisible();
    } finally {
      await cleanupUser(userId);
    }
  });
});
