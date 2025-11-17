import { Stack } from "expo-router";
import React from "react";
import Colors from '../../src/Colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.primaryWhite,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: "Log in",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="sign-up"
        options={{
          title: "Create account",
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
