import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createMailbox, getEmailActionUrl } from "@strawdev/resend-tui";

const backendDirectory = fileURLToPath(new URL("../examples/backend", import.meta.url));
const deployment = process.env.AUTH_CLIENT_EMAIL_DEPLOYMENT!;
const mailbox = createMailbox({
  projectDirectory: backendDirectory,
  deployment,
  component: "resend",
});
const password = "Example-password-123!";
const deliveryTimeoutMs = 180_000;

function updateUser(email: string, update: Record<string, unknown>) {
  execFileSync(
    "pnpm",
    [
      "exec",
      "convex",
      "run",
      "--deployment",
      deployment,
      "--component",
      "betterAuth",
      "adapter:updateOne",
      JSON.stringify({
        input: { model: "user", where: [{ field: "email", value: email }], update },
      }),
    ],
    { cwd: backendDirectory, stdio: "pipe" },
  );
}

async function signUp(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const sentAfter = Date.now();
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  const verification = await mailbox.waitForEmail({
    to: email,
    subject: "Verify your email",
    sentAfter,
    timeoutMs: deliveryTimeoutMs,
  });
  await page.goto(getEmailActionUrl(verification, "/api/auth/verify-email"));
  await page.goto("/");
  if (await page.getByLabel("Email", { exact: true }).isVisible()) {
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}

async function invite(owner: Page, recipient: string) {
  await owner.getByLabel("Invite email", { exact: true }).fill(recipient);
  const sentAfter = Date.now();
  await owner.getByRole("button", { name: "Invite member", exact: true }).click();
  const email = await mailbox.waitForEmail({
    to: recipient,
    subject: "Organization invitation",
    sentAfter,
    timeoutMs: deliveryTimeoutMs,
  });
  return getEmailActionUrl(email, "/");
}

test("delivered invitations preserve verification, recipient, and completion behavior", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const recipientContext = await browser.newContext();
  const suffix = Date.now();
  const ownerEmail = `delivered+live-owner-${suffix}@resend.dev`;
  const recipientEmail = `delivered+live-recipient-${suffix}@resend.dev`;
  const organizationName = `Live email ${suffix}`;
  const owner = await ownerContext.newPage();
  const recipient = await recipientContext.newPage();
  let organizationId: string | null = null;
  let organizationExists = false;

  try {
    await Promise.all([signUp(owner, ownerEmail), signUp(recipient, recipientEmail)]);

    await owner.getByLabel("Organization name", { exact: true }).fill(organizationName);
    await owner.getByRole("button", { name: "Create organization", exact: true }).click();
    await owner.getByRole("button", { name: organizationName, exact: true }).click();
    organizationId = new URL(owner.url()).searchParams.get("organizationId");
    expect(organizationId).toBeTruthy();
    organizationExists = true;

    const firstInvitationUrl = await invite(owner, recipientEmail);
    const wrongAccount = owner.waitForResponse(
      (response) =>
        response.url().includes("/organization/get-invitation") && response.status() === 403,
    );
    await owner.goto(firstInvitationUrl);
    await expect(wrongAccount).resolves.toBeTruthy();
    await expect(
      owner.getByRole("button", { name: "Accept linked invitation", exact: true }),
    ).toHaveCount(0);

    updateUser(recipientEmail, { emailVerified: false });
    await recipient.goto("/");
    await expect(
      recipient.getByRole("button", { name: "Send verification email", exact: true }),
    ).toBeVisible();
    await recipient.goto(firstInvitationUrl);
    await expect(
      recipient.getByRole("button", { name: "Accept linked invitation", exact: true }),
    ).toHaveCount(0);
    const verificationSentAfter = Date.now();
    await recipient.getByRole("button", { name: "Send verification email", exact: true }).click();
    const verification = await mailbox.waitForEmail({
      to: recipientEmail,
      subject: "Verify your email",
      sentAfter: verificationSentAfter,
      timeoutMs: deliveryTimeoutMs,
    });
    await recipient.goto(getEmailActionUrl(verification, "/api/auth/verify-email"));
    await recipient.goto(firstInvitationUrl);
    await recipient.getByRole("button", { name: "Reject linked invitation", exact: true }).click();

    await owner.goto(`/?organizationId=${organizationId}`);
    await expect(owner.getByRole("button", { name: "Cancel invitation", exact: true })).toHaveCount(
      0,
    );
    const acceptedInvitationUrl = await invite(owner, recipientEmail);
    await recipient.goto(acceptedInvitationUrl);
    await recipient.getByRole("button", { name: "Accept linked invitation", exact: true }).click();
    const slug = organizationName.toLowerCase().replaceAll(" ", "-");
    await expect(recipient.getByText(`Accepted ${slug}`, { exact: true })).toBeVisible();
    await expect(
      recipient.getByRole("button", { name: organizationName, exact: true }),
    ).toBeVisible();
    await expect(owner.getByText(`${recipientEmail} (member)`, { exact: true })).toBeVisible();

    await owner.getByRole("button", { name: "Delete organization", exact: true }).click();
    await expect(owner.getByRole("button", { name: organizationName, exact: true })).toHaveCount(0);
    organizationExists = false;
  } finally {
    try {
      if (organizationExists && organizationId) {
        await owner.goto(`/?organizationId=${organizationId}`);
        await owner.getByRole("button", { name: "Delete organization", exact: true }).click();
        await expect(
          owner.getByRole("button", { name: organizationName, exact: true }),
        ).toHaveCount(0);
      }
    } finally {
      await ownerContext.close();
      await recipientContext.close();
    }
  }
});
