import { Stack } from "expo-router";
import React from "react";
import Colors from '../src/Colors';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.primaryWhite,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(auth)"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="act"
        options={{
          title: "Act Profile",
        }}
      />
      <Stack.Screen
        name="update-location"
        options={{
          title: "Update Location",
        }}
      />
    </Stack>
  );
}