import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase admin env vars are required for e2e Soul tests.");
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
    throw new Error("Supabase anon env vars are required for e2e Soul tests.");
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
      full_name: "SolidDark Soul Test",
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
    await admin.from("soul_conversations").delete().eq("userId", data.id);
  }

  await admin.from("users").delete().eq("supabaseId", userId);
  await admin.auth.admin.deleteUser(userId);
}

test.describe("Soul chat flow", () => {
  test.skip(!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey, "Supabase env vars are required.");

  test("Open Soul -> Send message -> Receive response -> New conversation", async ({ page }) => {
    const unique = Date.now();
    const email = `soliddark-soul-${unique}@example.com`;
    const password = `Soul${unique}!Pass`;
    const question = "What legal document should I put in place first?";
    const mockReply = "## Priority\nYou need a continuity document first.\n\nNEXT STEPS\n1. Create a continuity plan.";
    let userId: string | null = null;
    let postCount = 0;

    try {
      userId = await createConfirmedUser(email, password);
      await waitForUserReady(email, password);

      await page.route("**/api/soul/chat", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: [],
            }),
          });
          return;
        }

        postCount += 1;
        await route.fulfill({
          status: 200,
          contentType: "text/plain; charset=utf-8",
          headers: {
            "X-Conversation-Id": "test-conversation-id",
          },
          body: mockReply,
        });
      });

      await createBrowserSession(page, email, password);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto("/dashboard/soul");
      await expect(page.getByRole("heading", { name: "AI legal advisor" })).toBeVisible();

      await page.getByPlaceholder("Ask the Soul what could break, what the law says, or what document you need next.").fill(question);
      await page.getByRole("button", { name: "Send" }).click();

      await expect(page.getByText(question)).toBeVisible();
      await expect(page.getByText("You need a continuity document first.")).toBeVisible();
      await expect(page.getByText("Create a continuity plan.")).toBeVisible();
      expect(postCount).toBe(1);

      await page.getByRole("button", { name: "New conversation" }).click();
      await expect(page.getByText(question)).toHaveCount(0);
      await expect(page.getByText("I am the SolidDark Soul. SolidDark provides legal information, research, and")).toBeVisible();
    } finally {
      await cleanupUser(userId);
    }
  });
});
