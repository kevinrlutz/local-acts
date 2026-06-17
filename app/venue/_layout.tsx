import { Stack } from "expo-router";
import React from "react";

export default function VenueLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="create-venue" options={{ title: "Create Venue Profile" }} />
      <Stack.Screen name="edit-venue" options={{ title: "Edit Venue Profile" }} />
      <Stack.Screen name="index" options={{ title: "Venue Profile", headerShown: false }} />
    </Stack>
  );
}
