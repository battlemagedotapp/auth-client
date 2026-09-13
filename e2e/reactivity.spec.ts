import { test, expect, type Page } from "@playwright/test";
async function signUp(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Example-password-123!");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  let url = "";
  await expect
    .poll(async () => {
      const messages = (await (await fetch("http://127.0.0.1:8025")).json()) as {
        to: string;
        url: string;
      }[];
      url = messages.findLast((m) => m.to === email)?.url ?? "";
      return url;
    })
    .toBeTruthy();
  await page.goto(url);
  await page.goto("/");
  if (await page.getByLabel("Email", { exact: true }).isVisible()) {
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Example-password-123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}
test("two clients receive invitations and membership updates without polling", async ({
  browser,
}) => {
  const owner = await browser.newContext();
  const recipient = await browser.newContext();
  const a = await owner.newPage();
  const b = await recipient.newPage();
  const suffix = Date.now();
  const email = `recipient-${suffix}@example.com`;
  await signUp(a, `owner-${suffix}@example.com`);
  await signUp(b, email);
  const name = `Organization ${suffix}`;
  await a.getByLabel("Organization name", { exact: true }).fill(name);
  await a.getByRole("button", { name: "Create organization", exact: true }).click();
  await a.getByRole("button", { name, exact: true }).click();
  await a.getByLabel("Invite email").fill(email);
  await a.getByRole("button", { name: "Invite member", exact: true }).click();
  await expect(b.getByRole("button", { name: "Accept invitation", exact: true })).toBeVisible();
  await b.getByRole("button", { name: "Accept invitation", exact: true }).click();
  await expect(b.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(a.getByText(`${email} (member)`, { exact: true })).toBeVisible();
  await b.getByRole("button", { name, exact: true }).click();
  await a.getByLabel("Rename organization").fill("Renamed " + suffix);
  await a.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(b.getByRole("button", { name: "Renamed " + suffix, exact: true })).toBeVisible();
  const displayName = `Member ${suffix}`;
  await b.getByLabel("Profile name", { exact: true }).fill(displayName);
  await b.getByRole("button", { name: "Update profile", exact: true }).click();
  await expect(a.getByText(`${displayName} (member)`, { exact: true })).toBeVisible();
  const recipientRow = a.getByText(`${displayName} (member)`, { exact: true }).locator("..");
  await recipientRow.getByRole("button", { name: "Make admin", exact: true }).click();
  await expect(b.getByText(`${displayName} (admin)`, { exact: true })).toBeVisible();
  await recipient.setOffline(true);
  await a.getByLabel("Rename organization").fill("Recovered " + suffix);
  await a.getByRole("button", { name: "Rename", exact: true }).click();
  await recipient.setOffline(false);
  await b.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(b.getByRole("button", { name: "Recovered " + suffix, exact: true })).toBeVisible();
  await b.waitForTimeout(1000);
  let reads = 0;
  const count = (request: import("@playwright/test").Request) => {
    if (request.method() === "GET" && request.url().includes("/api/auth/organization/")) reads++;
  };
  b.on("request", count);
  await b.waitForTimeout(5500);
  b.off("request", count);
  expect(reads).toBe(0);
  await a
    .getByText(`${displayName} (admin)`, { exact: true })
    .locator("..")
    .getByRole("button", { name: "Remove member", exact: true })
    .click();
  await expect(b.getByRole("button", { name: "Recovered " + suffix, exact: true })).toHaveCount(0);
  await b.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(b.getByLabel("Email", { exact: true })).toBeVisible();
  await owner.close();
  await recipient.close();
});

test("revoking another session removes its protected cached reads", async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const a = await first.newPage();
  const b = await second.newPage();
  const suffix = Date.now();
  const email = `sessions-${suffix}@example.com`;
  await signUp(a, email);
  const name = `Sessions ${suffix}`;
  await a.getByLabel("Organization name", { exact: true }).fill(name);
  await a.getByRole("button", { name: "Create organization", exact: true }).click();
  await expect(a.getByRole("button", { name, exact: true })).toBeVisible();
  let sessionId = "";
  b.on("response", async (response) => {
    if (response.url().includes("/api/auth/get-session")) {
      try {
        const body = await response.json();
        sessionId = body?.session?.id ?? sessionId;
      } catch {
        /* A superseded request may have no response body. */
      }
    }
  });
  await b.goto("/");
  await b.getByLabel("Email", { exact: true }).fill(email);
  await b.getByLabel("Password", { exact: true }).fill("Example-password-123!");
  await b.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(b.getByRole("button", { name, exact: true })).toBeVisible();
  await expect.poll(() => sessionId).toBeTruthy();
  await a
    .getByText(sessionId, { exact: true })
    .locator("..")
    .getByRole("button", { name: "Revoke session", exact: true })
    .click();
  await expect(b.getByRole("button", { name, exact: true })).toHaveCount(0);
  await first.close();
  await second.close();
});
