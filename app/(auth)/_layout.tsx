import { Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0E0F0F" },
        headerTintColor: "#fff",
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="sign-up"
        options={{
          title: "Create account",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="account-setup"
        options={{
          title: "Finish setup",
        }}
      />
    </Stack>
  );
}
