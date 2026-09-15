import { createAuthClient } from "better-auth/react";
import { z } from "zod";
import { createAuthDataClient, type InvalidationApi } from "../packages/auth-client/src/index.js";

const authClient = createAuthClient({ baseURL: "https://auth.example.com" });
const api = {} as InvalidationApi;
const client = createAuthDataClient({
  authClient,
  api,
  features: { authentication: true, account: true, sessions: true },
  currentUser: {
    useCurrentUser: () => ({
      data: { _id: "user", email: "user@example.com", name: "User", image: null },
      identity: "user",
      isPending: false,
      error: null,
    }),
  },
});

const SignUp = client.defineSignUpForm(
  z
    .object({
      confirmPassword: z.string(),
      email: z.email(),
      locale: z.enum(["en", "ja"]),
      name: z.string(),
      password: z.string(),
    })
    .refine((value) => value.password === value.confirmPassword)
    .transform(({ confirmPassword: _confirmation, ...value }) => value),
);
<SignUp.Root
  initialValues={{
    confirmPassword: "",
    email: "",
    locale: "en",
    name: "",
    password: "",
  }}
  callbackURL="https://example.com/verified"
>
  <SignUpControls />
</SignUp.Root>;
function SignUpControls() {
  const workflow = SignUp.useWorkflowContext();
  workflow.field("locale").onChange("ja");
  // @ts-expect-error The schema keeps locale constrained.
  workflow.field("locale").onChange("fr");
  return null;
}

const Reset = client.definePasswordResetForm(
  z
    .object({ password: z.string(), confirmPassword: z.string() })
    .transform(({ password }) => ({ newPassword: password })),
);
<Reset.Root initialValues={{ password: "", confirmPassword: "" }} token="private-token" />;

const Profile = client.defineProfileSettings(z.object({ name: z.string() }));
<Profile.Root getInitialValues={(user) => ({ name: user.name })} />;

const Email = client.defineEmailChangeForm(
  z.object({ email: z.email() }).transform(({ email }) => ({ newEmail: email })),
);
<Email.Root initialValues={{ email: "" }} callbackURL="https://example.com/account" />;

client.useProfileSettings({
  schema: z
    .object({ displayName: z.string() })
    .transform(({ displayName }) => ({ name: displayName })),
  getInitialValues: (user) => ({ displayName: user.name }),
});
client.useEmailChangeForm({
  schema: z.object({ email: z.email() }).transform(({ email }) => ({ newEmail: email })),
  initialValues: { email: "" },
  callbackURL: "https://example.com/account",
});
client.usePasswordChangeForm({
  schema: z
    .object({ currentPassword: z.string(), password: z.string(), confirmation: z.string() })
    .transform(({ currentPassword, password }) => ({ currentPassword, newPassword: password })),
  initialValues: { currentPassword: "", password: "", confirmation: "" },
  revokeOtherSessions: true,
});
client.useReauthenticationForm({
  schema: z
    .object({ password: z.string(), confirmation: z.literal("yes") })
    .transform(({ password }) => ({ password })),
  initialValues: { password: "", confirmation: "yes" },
});

client.usePasswordChangeForm({
  initialValues: { currentPassword: "", newPassword: "" },
  revokeOtherSessions: true,
});
client.useReauthenticationForm();
client.useSignOut();

const limited = createAuthDataClient({ authClient, api, features: {} });
// @ts-expect-error Authentication workflows are capability-gated.
limited.useSignInForm({ initialValues: { email: "", password: "" } });
