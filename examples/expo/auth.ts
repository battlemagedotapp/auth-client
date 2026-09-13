import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { ConvexReactClient } from "convex/react";
import { api } from "../backend/convex/_generated/api";
import { createAuthDataClient } from "@strawdev/auth-client";
export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
  plugins: [
    organizationClient(),
    convexClient(),
    ...(Platform.OS === "web"
      ? [crossDomainClient()]
      : [
          expoClient({
            scheme: "reactive-auth-example",
            storagePrefix: "reactive-auth-example",
            storage: SecureStore,
          }),
        ]),
  ],
});
export const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210",
);
export const authData = createAuthDataClient({
  authClient,
  api: api.authData,
  features: { organization: true, sessions: true },
});
