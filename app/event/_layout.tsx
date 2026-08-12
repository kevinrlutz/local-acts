import { Stack } from "expo-router";
import React from "react";

export default function EventLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Event Details", headerShown: false }} />
    </Stack>
  );
}
