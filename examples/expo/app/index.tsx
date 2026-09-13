import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import { authClient, authData } from "../auth";
export default function Home() {
  const session = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { organizationId, invitationId } = useLocalSearchParams<{
    organizationId?: string;
    invitationId?: string;
  }>();
  const [profileName, setProfileName] = useState("");
  const [message, setMessage] = useState("");
  const organizations = authData.useListOrganizations();
  const invitations = authData.useListUserInvitations();
  const sessions = authData.useListSessions();
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
          <TextInput
            accessibilityLabel="Profile name"
            value={profileName}
            onChangeText={setProfileName}
          />
          <Button
            title="Update profile"
            onPress={() => run(() => authClient.updateUser({ name: profileName }))}
          />
          {invitationId ? <Invitation id={invitationId} run={run} /> : null}
          <TextInput accessibilityLabel="Organization name" value={name} onChangeText={setName} />
          <Button
            title="Create organization"
            onPress={() =>
              run(() =>
                authData.organization.create({
                  name,
                  slug: name.toLowerCase().replaceAll(" ", "-"),
                }),
              )
            }
          />
          {organizations.error ? (
            <Text>
              {organizations.error instanceof Error
                ? organizations.error.message
                : JSON.stringify(organizations.error)}
            </Text>
          ) : null}
          {organizations.data?.map((org) => (
            <Button
              key={org.id}
              title={org.name}
              onPress={() => router.setParams({ organizationId: org.id })}
            />
          ))}
          {organizationId ? (
            <Organization key={organizationId} id={organizationId} run={run} />
          ) : null}
          <Text accessibilityRole="header">Received invitations</Text>
          {invitations.data?.map((invitation) => (
            <View key={invitation.id}>
              <Text>{invitation.organizationId}</Text>
              <Button
                title="Accept invitation"
                onPress={() =>
                  run(() => authData.organization.acceptInvitation({ invitationId: invitation.id }))
                }
              />
              <Button
                title="Reject invitation"
                onPress={() =>
                  run(() => authData.organization.rejectInvitation({ invitationId: invitation.id }))
                }
              />
            </View>
          ))}
          <Text accessibilityRole="header">Sessions</Text>
          {sessions.data?.map((item) => (
            <View key={item.id}>
              <Text>{item.id}</Text>
              <Button
                title="Revoke session"
                onPress={() => run(() => authData.revokeSession({ token: item.token }))}
              />
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
function Organization({
  id,
  run,
}: {
  id: string;
  run: (work: () => Promise<any>) => Promise<void>;
}) {
  const org = authData.useOrganization({ organizationId: id });
  const [offset, setOffset] = useState(0);
  const members = authData.useListMembers({ organizationId: id, limit: 20, offset });
  const invitations = authData.useListInvitations({ organizationId: id });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header">{org.data?.name}</Text>
      <TextInput accessibilityLabel="Rename organization" value={name} onChangeText={setName} />
      <Button
        title="Rename"
        onPress={() =>
          run(() => authData.organization.update({ organizationId: id, data: { name } }))
        }
      />
      <TextInput accessibilityLabel="Invite email" value={email} onChangeText={setEmail} />
      <Button
        title="Invite member"
        onPress={() =>
          run(() =>
            authData.organization.inviteMember({ organizationId: id, email, role: "member" }),
          )
        }
      />
      {members.data?.members.map((member) => (
        <View key={member.id}>
          <Text>
            {member.user.name} ({member.role})
          </Text>
          <Button
            title="Make admin"
            onPress={() =>
              run(() =>
                authData.organization.updateMemberRole({
                  organizationId: id,
                  memberId: member.id,
                  role: "admin",
                }),
              )
            }
          />
          <Button
            title="Remove member"
            onPress={() =>
              run(() =>
                authData.organization.removeMember({
                  organizationId: id,
                  memberIdOrEmail: member.id,
                }),
              )
            }
          />
        </View>
      ))}
      <Button
        title="Previous members"
        disabled={offset === 0}
        onPress={() => setOffset(Math.max(0, offset - 20))}
      />
      <Button
        title="Next members"
        disabled={(members.data?.members.length ?? 0) < 20}
        onPress={() => setOffset(offset + 20)}
      />
      {invitations.data?.map((invitation) => (
        <View key={invitation.id}>
          <Text>{invitation.email}</Text>
          <Button
            title="Cancel invitation"
            onPress={() =>
              run(() => authData.organization.cancelInvitation({ invitationId: invitation.id }))
            }
          />
        </View>
      ))}
      <Button
        title="Leave organization"
        onPress={() => run(() => authData.organization.leave({ organizationId: id }))}
      />
      <Button
        title="Delete organization"
        onPress={() => run(() => authData.organization.delete({ organizationId: id }))}
      />
    </View>
  );
}

function Invitation({ id, run }: { id: string; run: (work: () => Promise<any>) => Promise<void> }) {
  const invitation = authData.useInvitation({ id });
  return (
    <View>
      <Text>
        {invitation.isPending
          ? "Loading invitation"
          : (invitation.data?.organizationName ?? "Invitation unavailable")}
      </Text>
      {invitation.data ? (
        <>
          <Button
            title="Accept linked invitation"
            onPress={() => run(() => authData.organization.acceptInvitation({ invitationId: id }))}
          />
          <Button
            title="Reject linked invitation"
            onPress={() => run(() => authData.organization.rejectInvitation({ invitationId: id }))}
          />
        </>
      ) : null}
    </View>
  );
}
