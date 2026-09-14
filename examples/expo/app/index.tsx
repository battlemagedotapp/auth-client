import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import { authClient, authData } from "../auth";
import type { WorkflowError } from "@strawdev/auth-client";
import { z } from "zod";

const ticketInvitationSchema = z.object({
  email: z.string().min(1),
  role: z.literal("member"),
  ticket: z
    .string()
    .regex(/^\d+$/, "Enter a ticket number")
    .transform(Number)
    .pipe(z.number().int().nonnegative()),
});
export default function Home() {
  const session = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { organizationId, invitationId } = useLocalSearchParams<{
    organizationId?: string;
    invitationId?: string;
  }>();
  const [profileName, setProfileName] = useState("");
  const [message, setMessage] = useState("");
  async function run(work: () => Promise<any>) {
    try {
      const result = await work();
      setMessage(result?.error?.message ?? "Saved");
    } catch (error) {
      setMessage(String(error));
    }
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 12, maxWidth: 800 }}>
      <Text accessibilityRole="header">Auth data example</Text>
      <Text accessibilityRole="alert">{message}</Text>
      {!session.data ? (
        <>
          <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} />
          <TextInput
            accessibilityLabel="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button
            title="Sign in"
            onPress={() => run(() => authClient.signIn.email({ email, password }))}
          />
          <Button
            title="Sign up"
            onPress={() =>
              run(() => authClient.signUp.email({ email, password, name: email, callbackURL: "/" }))
            }
          />
        </>
      ) : (
        <>
          <Text>{session.data.user.email}</Text>
          <Button title="Sign out" onPress={() => run(() => authClient.signOut())} />
          {!session.data.user.emailVerified ? (
            <Button
              title="Send verification email"
              onPress={() =>
                run(() =>
                  authClient.sendVerificationEmail({
                    email: session.data!.user.email,
                    callbackURL: "/",
                  }),
                )
              }
            />
          ) : null}
          <TextInput
            accessibilityLabel="Profile name"
            value={profileName}
            onChangeText={setProfileName}
          />
          <Button
            title="Update profile"
            onPress={() => run(() => authClient.updateUser({ name: profileName }))}
          />
          {invitationId ? (
            <Invitation id={invitationId} onAccepted={(slug) => setMessage(`Accepted ${slug}`)} />
          ) : null}
          <authData.OrganizationCreateForm
            schema={z
              .object({ name: z.string().min(1) })
              .transform(({ name }) => ({ name, slug: name.toLowerCase().replaceAll(" ", "-") }))}
            initialValues={{ name: "" }}
            onCreated={({ organization }) => {
              setMessage(`Created ${organization.slug}`);
            }}
          >
            {(form) => (
              <>
                <TextInput
                  accessibilityLabel="Organization name"
                  value={form.field("name").value}
                  onChangeText={form.field("name").onChange}
                  onBlur={form.field("name").onBlur}
                  editable={!form.field("name").isDisabled}
                />
                <Button
                  title="Create organization"
                  disabled={form.isBusy}
                  onPress={() => void form.submit()}
                />
                <WorkflowFeedback
                  error={form.error}
                  queryError={form.queryError}
                  retrySync={form.retrySync}
                />
              </>
            )}
          </authData.OrganizationCreateForm>
          <authData.OrganizationDirectory
            selection={organizationId ? { organizationId } : undefined}
            onSelect={(org) => router.setParams({ organizationId: org.id })}
          >
            {(directory) => (
              <>
                <WorkflowFeedback error={directory.error} queryError={directory.queryError} />
                {directory.data?.map((org) => (
                  <Button
                    key={org.id}
                    title={org.name}
                    onPress={() => void directory.selectOrganization(org.id)}
                  />
                ))}
              </>
            )}
          </authData.OrganizationDirectory>
          {organizationId ? <Organization key={organizationId} id={organizationId} /> : null}
          <Text accessibilityRole="header">Received invitations</Text>
          <authData.ReceivedInvitations
            onAccepted={({ organization }) => setMessage(`Accepted ${organization.slug}`)}
          >
            {(invitations) => (
              <>
                <WorkflowFeedback error={invitations.error} queryError={invitations.queryError} />
                {invitations.pendingSync.map((pending) => (
                  <Button
                    key={pending.invitationId}
                    title={`Retry organization refresh ${pending.invitationId}`}
                    disabled={invitations.isBusy}
                    onPress={() => void invitations.retrySync(pending.invitationId)}
                  />
                ))}
                {invitations.data
                  ?.filter((invitation) => invitation.status === "pending")
                  .map((invitation) => (
                    <View key={invitation.id}>
                      <Text>{invitation.organizationId}</Text>
                      <Button
                        title="Accept invitation"
                        disabled={invitations.isBusy}
                        onPress={() => void invitations.accept(invitation.id)}
                      />
                      <Button
                        title="Reject invitation"
                        disabled={invitations.isBusy}
                        onPress={() => void invitations.reject(invitation.id)}
                      />
                      <Button
                        title="Open invitation"
                        onPress={() => router.setParams({ invitationId: invitation.id })}
                      />
                    </View>
                  ))}
              </>
            )}
          </authData.ReceivedInvitations>
          <Text accessibilityRole="header">Sessions</Text>
          <authData.Sessions>
            {(sessions) => (
              <>
                <WorkflowFeedback error={sessions.error} queryError={sessions.queryError} />
                {sessions.needsFreshSession ? <Text>Sign in again to manage sessions.</Text> : null}
                {sessions.data?.map((item) => (
                  <View key={item.id}>
                    <Text>{item.id}</Text>
                    <Button
                      title="Revoke session"
                      disabled={sessions.isBusy}
                      onPress={() => void sessions.revokeSession(item.id)}
                    />
                  </View>
                ))}
                <Button
                  title="Revoke other sessions"
                  disabled={sessions.isBusy}
                  onPress={() => void sessions.revokeOtherSessions()}
                />
                <Button
                  title="Revoke all sessions"
                  disabled={sessions.isBusy}
                  onPress={() => void sessions.revokeSessions()}
                />
              </>
            )}
          </authData.Sessions>
        </>
      )}
    </ScrollView>
  );
}
function Organization({ id }: { id: string }) {
  const [failPreparation, setFailPreparation] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <authData.OrganizationSettings
        organizationId={id}
        getInitialValues={(org) => ({ name: org.name, slug: org.slug })}
        beforeDelete={async () => {
          if (failPreparation) throw new Error("Example cleanup failed");
        }}
        onLeft={() => router.setParams({ organizationId: undefined })}
        onDeleted={() => router.setParams({ organizationId: undefined })}
      >
        {(settings) => (
          <>
            <Text accessibilityRole="header">{settings.organization?.name}</Text>
            <WorkflowFeedback
              error={settings.error}
              queryError={settings.queryError}
              retrySync={settings.retrySync}
            />
            {settings.form ? (
              <>
                <TextInput
                  accessibilityLabel="Rename organization"
                  value={settings.form.field("name").value}
                  onChangeText={settings.form.field("name").onChange}
                  editable={!settings.form.field("name").isDisabled}
                />
                <TextInput
                  accessibilityLabel="Organization slug"
                  value={settings.form.field("slug").value}
                  onChangeText={settings.form.field("slug").onChange}
                  editable={!settings.form.field("slug").isDisabled}
                />
                {settings.hasServerChanges ? <Text>Organization changed on the server</Text> : null}
                <Button
                  title="Reset organization draft"
                  disabled={settings.isBusy}
                  onPress={() => settings.form?.reset()}
                />
                <Button
                  title="Rename"
                  disabled={settings.isBusy || !settings.availability.update.allowed}
                  onPress={() => void settings.form?.submit()}
                />
              </>
            ) : null}
            <Button
              title="Leave organization"
              disabled={settings.isBusy || !settings.availability.leave.allowed}
              onPress={() => void settings.leave()}
            />
            <Button
              title="Delete organization"
              disabled={settings.isBusy || !settings.availability.delete.allowed}
              onPress={() => void settings.delete()}
            />
            <Button
              title={failPreparation ? "Allow deletion preparation" : "Fail deletion preparation"}
              onPress={() => setFailPreparation(!failPreparation)}
            />
          </>
        )}
      </authData.OrganizationSettings>
      <authData.InvitationForm organizationId={id} initialValues={{ role: "member" }}>
        {(form) => (
          <>
            <TextInput
              accessibilityLabel="Invite email"
              value={form.field("email").value}
              onChangeText={form.field("email").onChange}
              onBlur={form.field("email").onBlur}
              editable={!form.field("email").isDisabled}
            />
            {form.field("email").error ? (
              <Text accessibilityRole="alert">{form.field("email").error?.code}</Text>
            ) : null}
            <Button
              title="Invite member"
              disabled={form.field("email").isDisabled}
              onPress={() => void form.submit()}
            />
            <WorkflowFeedback error={form.error} />
          </>
        )}
      </authData.InvitationForm>
      <authData.InvitationForm
        organizationId={id}
        schema={ticketInvitationSchema}
        initialValues={{ email: "", role: "member", ticket: "" }}
      >
        {(form) => (
          <>
            <TextInput
              accessibilityLabel="Ticket invite email"
              value={form.field("email").value}
              onChangeText={form.field("email").onChange}
              onBlur={form.field("email").onBlur}
              editable={!form.field("email").isDisabled}
            />
            <TextInput
              accessibilityLabel="Invitation ticket"
              value={form.field("ticket").value}
              onChangeText={form.field("ticket").onChange}
              onBlur={form.field("ticket").onBlur}
              editable={!form.field("ticket").isDisabled}
            />
            <Text>
              {form.isDirty ? "Unsaved invitation" : "Invitation defaults"}
              {form.isValidating ? " — validating" : ""}
            </Text>
            {Object.entries(form.fieldErrors).map(([name, error]) => (
              <Text key={name} accessibilityRole="alert">
                {name}: {error?.message ?? error?.code}
              </Text>
            ))}
            {form.validationError ? (
              <Text accessibilityRole="alert">Form validation failed</Text>
            ) : null}
            <Button
              title="Invite with ticket"
              disabled={form.isBusy}
              onPress={() => void form.submit()}
            />
            <WorkflowFeedback error={form.error} />
          </>
        )}
      </authData.InvitationForm>
      <authData.OrganizationMembers organizationId={id} pageSize={2}>
        {(members) => (
          <>
            <WorkflowFeedback error={members.error} queryError={members.queryError} />
            <Text>Member page {members.page + 1}</Text>
            {members.members.map((member) => (
              <View key={member.id}>
                <Text>
                  {member.user.name} ({member.role})
                </Text>
                <Button
                  title="Make admin"
                  disabled={members.isBusy}
                  onPress={() =>
                    void members.updateMemberRole({ memberId: member.id, role: "admin" })
                  }
                />
                <Button
                  title="Remove member"
                  disabled={members.isBusy}
                  onPress={() => void members.removeMember({ memberId: member.id })}
                />
              </View>
            ))}
            <Button
              title="Previous members"
              disabled={!members.hasPreviousPage}
              onPress={members.previousPage}
            />
            <Button
              title="Next members"
              disabled={!members.hasNextPage}
              onPress={members.nextPage}
            />
          </>
        )}
      </authData.OrganizationMembers>
      <authData.OrganizationInvitations organizationId={id}>
        {(invitations) => (
          <>
            <WorkflowFeedback error={invitations.error} queryError={invitations.queryError} />
            {invitations.data
              ?.filter((invitation) => invitation.status === "pending")
              .map((invitation) => (
                <View key={invitation.id}>
                  <Text>{invitation.email}</Text>
                  {invitation.ticket != null ? <Text>Ticket {invitation.ticket}</Text> : null}
                  <Button
                    title="Cancel invitation"
                    disabled={invitations.isBusy}
                    onPress={() => void invitations.cancel(invitation.id)}
                  />
                  <Button
                    title="Resend invitation"
                    disabled={invitations.isBusy}
                    onPress={() =>
                      void invitations.resend({ email: invitation.email, role: invitation.role })
                    }
                  />
                </View>
              ))}
          </>
        )}
      </authData.OrganizationInvitations>
    </View>
  );
}

function Invitation({ id, onAccepted }: { id: string; onAccepted: (slug: string) => void }) {
  return (
    <authData.InvitationResponse
      invitationId={id}
      onAccepted={({ organization }) => onAccepted(organization.slug)}
    >
      {(invitation) => (
        <View>
          <Text>
            {invitation.isPending
              ? "Loading invitation"
              : (invitation.invitation?.organizationName ?? "Invitation unavailable")}
          </Text>
          <WorkflowFeedback
            error={invitation.error}
            queryError={invitation.queryError}
            retrySync={invitation.retrySync}
          />
          {invitation.invitation ? (
            <>
              <Button
                title="Accept linked invitation"
                disabled={invitation.isBusy}
                onPress={() => void invitation.accept()}
              />
              <Button
                title="Reject linked invitation"
                disabled={invitation.isBusy}
                onPress={() => void invitation.reject()}
              />
            </>
          ) : null}
        </View>
      )}
    </authData.InvitationResponse>
  );
}

function WorkflowFeedback({
  error,
  queryError,
  retrySync,
}: {
  error: WorkflowError | null;
  queryError?: unknown;
  retrySync?: () => Promise<unknown>;
}) {
  const cause = error?.cause ?? queryError;
  if (!cause) return null;
  return (
    <View>
      <Text accessibilityRole="alert">
        {error?.phase ? `${error.phase}: ` : ""}
        {cause instanceof Error ? cause.message : JSON.stringify(cause)}
      </Text>
      {error?.phase === "synchronization" && retrySync ? (
        <Button title="Retry organization refresh" onPress={() => void retrySync()} />
      ) : null}
    </View>
  );
}
