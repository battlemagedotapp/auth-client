import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import { authClient, authData } from "../auth";
import type { WorkflowAction, WorkflowFeedback as Feedback } from "@strawdev/auth-client";
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
          <CreateOrganization.Root
            initialValues={{ name: "" }}
            onCreated={({ organization }) => {
              setMessage(`Created ${organization.slug}`);
            }}
          >
            <OrganizationCreateFormControls />
          </CreateOrganization.Root>
          <authData.OrganizationDirectory
            selection={organizationId ? { organizationId } : undefined}
            onSelect={(org) => router.setParams({ organizationId: org.id })}
          >
            <OrganizationDirectoryControls />
          </authData.OrganizationDirectory>
          {organizationId ? <Organization key={organizationId} id={organizationId} /> : null}
          <Text accessibilityRole="header">Received invitations</Text>
          <authData.ReceivedInvitations
            onAccepted={({ organization }) => setMessage(`Accepted ${organization.slug}`)}
          >
            <ReceivedInvitationsControls />
          </authData.ReceivedInvitations>
          <Text accessibilityRole="header">Sessions</Text>
          <authData.Sessions>
            <SessionsControls />
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
        <OrganizationSettingsControls
          failPreparation={failPreparation}
          setFailPreparation={setFailPreparation}
        />
      </authData.OrganizationSettings>
      <authData.InvitationForm organizationId={id} initialValues={{ role: "member" }}>
        <InvitationFormControls />
      </authData.InvitationForm>
      <TicketInvitation.Root
        organizationId={id}

        initialValues={{ email: "", role: "member", ticket: "" }}
      >
        <TicketInvitationControls />
      </TicketInvitation.Root>
      <authData.OrganizationMembers organizationId={id} pageSize={2}>
        <OrganizationMembersControls />
      </authData.OrganizationMembers>
      <authData.OrganizationInvitations organizationId={id}>
        <OrganizationInvitationsControls />
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
      <InvitationResponseControls />
    </authData.InvitationResponse>
  );
}

function ActionButton({ title, action }: { title: string; action: WorkflowAction }) {
  return <Button title={title} disabled={action.isDisabled} onPress={() => void action.run()} />;
}

function WorkflowFeedback({
  feedback,
  queryError,
}: {
  feedback: readonly Feedback[];
  queryError?: unknown;
}) {
  const message = (error: unknown) =>
    error instanceof Error ? error.message : JSON.stringify(error);
  return (
    <View>
      {queryError ? <Text accessibilityRole="alert">{message(queryError)}</Text> : null}
      {feedback.map((entry, index) => (
        <View key={index}>
          {entry.error ? <Text accessibilityRole="alert">{message(entry.error)}</Text> : null}
          {entry.recovery ? (
            <ActionButton title="Retry organization refresh" action={entry.recovery} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const CreateOrganization = authData.defineOrganizationCreateForm(
  z
    .object({ name: z.string().min(1) })
    .transform(({ name }) => ({ name, slug: name.toLowerCase().replaceAll(" ", "-") })),
);
function OrganizationCreateFormControls() {
  const form = CreateOrganization.useWorkflowContext();
  return (
    <>
      <TextInput
        accessibilityLabel="Organization name"
        value={form.field("name").value}
        onChangeText={form.field("name").onChange}
        onBlur={form.field("name").onBlur}
        editable={!form.field("name").isDisabled}
      />
      <ActionButton title="Create organization" action={form.actions.submit} />
      <WorkflowFeedback feedback={form.feedback} queryError={form.queryError} />
    </>
  );
}
function OrganizationDirectoryControls() {
  const directory = authData.useOrganizationDirectoryContext();
  return (
    <>
      <WorkflowFeedback feedback={directory.feedback} queryError={directory.queryError} />
      {directory.data?.map((org) => (
        <ActionButton title={org.name} key={org.id} action={directory.select(org.id)} />
      ))}
    </>
  );
}
function ReceivedInvitationsControls() {
  const invitations = authData.useReceivedInvitationsContext();
  return (
    <>
      <WorkflowFeedback feedback={invitations.feedback} queryError={invitations.queryError} />

      {invitations.data
        ?.filter((invitation) => invitation.status === "pending")
        .map((invitation) => (
          <View key={invitation.id}>
            <Text>{invitation.organizationId}</Text>
            <ActionButton
              title="Accept invitation"
              action={invitations.invitation(invitation.id).accept}
            />
            <ActionButton
              title="Reject invitation"
              action={invitations.invitation(invitation.id).reject}
            />
            <Button
              title="Open invitation"
              onPress={() => router.setParams({ invitationId: invitation.id })}
            />
          </View>
        ))}
    </>
  );
}
function SessionsControls() {
  const sessions = authData.useSessionsContext();
  return (
    <>
      <WorkflowFeedback feedback={sessions.feedback} queryError={sessions.queryError} />
      {sessions.needsFreshSession ? <Text>Sign in again to manage sessions.</Text> : null}
      {sessions.data?.map((item) => (
        <View key={item.id}>
          <Text>{item.id}</Text>
          <ActionButton title="Revoke session" action={sessions.session(item.id).revoke} />
        </View>
      ))}
      <ActionButton title="Revoke other sessions" action={sessions.actions.revokeOthers} />
      <ActionButton title="Revoke all sessions" action={sessions.actions.revokeAll} />
    </>
  );
}
function OrganizationSettingsControls({
  failPreparation,
  setFailPreparation,
}: {
  failPreparation: boolean;
  setFailPreparation: (value: boolean) => void;
}) {
  const settings = authData.useOrganizationSettingsContext();
  return (
    <>
      <Text accessibilityRole="header">{settings.organization?.name}</Text>
      <WorkflowFeedback feedback={settings.feedback} queryError={settings.queryError} />
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
            disabled={settings.form.actions.submit.isPending}
            onPress={() => settings.form?.reset()}
          />
          <ActionButton title="Rename" action={settings.form.actions.submit} />
        </>
      ) : null}
      <ActionButton title="Leave organization" action={settings.actions.leave} />
      <ActionButton title="Delete organization" action={settings.actions.delete} />
      <Button
        title={failPreparation ? "Allow deletion preparation" : "Fail deletion preparation"}
        onPress={() => setFailPreparation(!failPreparation)}
      />
    </>
  );
}
function InvitationFormControls() {
  const form = authData.useInvitationFormContext();
  return (
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
      <ActionButton title="Invite member" action={form.actions.submit} />
      <WorkflowFeedback feedback={form.feedback} />
    </>
  );
}
const TicketInvitation = authData.defineInvitationForm(ticketInvitationSchema);
function TicketInvitationControls() {
  const form = TicketInvitation.useWorkflowContext();
  return (
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
      {form.validationError ? <Text accessibilityRole="alert">Form validation failed</Text> : null}
      <ActionButton title="Invite with ticket" action={form.actions.submit} />
      <WorkflowFeedback feedback={form.feedback} />
    </>
  );
}
function OrganizationMembersControls() {
  const members = authData.useOrganizationMembersContext();
  return (
    <>
      <WorkflowFeedback feedback={members.feedback} queryError={members.queryError} />
      <Text>Member page {members.page + 1}</Text>
      {members.members.map((member) => (
        <View key={member.id}>
          <Text>
            {member.user.name} ({member.role})
          </Text>
          <ActionButton title="Make admin" action={members.member(member.id).updateRole("admin")} />
          <ActionButton title="Remove member" action={members.member(member.id).remove} />
        </View>
      ))}
      <Button
        title="Previous members"
        disabled={!members.hasPreviousPage}
        onPress={members.previousPage}
      />
      <Button title="Next members" disabled={!members.hasNextPage} onPress={members.nextPage} />
    </>
  );
}
function OrganizationInvitationsControls() {
  const invitations = authData.useOrganizationInvitationsContext();
  return (
    <>
      <WorkflowFeedback feedback={invitations.feedback} queryError={invitations.queryError} />
      {invitations.data
        ?.filter((invitation) => invitation.status === "pending")
        .map((invitation) => (
          <View key={invitation.id}>
            <Text>{invitation.email}</Text>
            {invitation.ticket != null ? <Text>Ticket {invitation.ticket}</Text> : null}
            <ActionButton
              title="Cancel invitation"
              action={invitations.invitation(invitation.id).cancel}
            />
            <ActionButton
              title="Resend invitation"
              action={invitations.invitation(invitation.id).resend}
            />
          </View>
        ))}
    </>
  );
}
function InvitationResponseControls() {
  const invitation = authData.useInvitationResponseContext();
  return (
    <View>
      <Text>
        {invitation.isPending
          ? "Loading invitation"
          : (invitation.invitation?.organizationName ?? "Invitation unavailable")}
      </Text>
      <WorkflowFeedback feedback={invitation.feedback} queryError={invitation.queryError} />
      {invitation.invitation ? (
        <>
          <ActionButton title="Accept linked invitation" action={invitation.actions.accept} />
          <ActionButton title="Reject linked invitation" action={invitation.actions.reject} />
        </>
      ) : null}
    </View>
  );
}
