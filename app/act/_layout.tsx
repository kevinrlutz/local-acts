import { Stack } from "expo-router";
import React from "react";

export default function ActLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen
                name="create-act"
                options={{
                    title: "Create Act Profile",
                }}
            />
            <Stack.Screen
                name="[uid]"
                options={{
                    title: "Act Profile",
                    headerShown: false,
                }}
            />
        </Stack>
  );
}