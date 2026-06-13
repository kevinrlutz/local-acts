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
                name="create-event"
                options={{
                    title: "Add Event",
                }}
            />
            <Stack.Screen
                name="edit-event"
                options={{
                    title: "Edit Event",
                }}
            />
            <Stack.Screen
                name="edit-act"
                options={{
                    title: "Edit Act Profile",
                }}
            />
            <Stack.Screen
                name="index"
                options={{
                    title: "Act Profile",
                    headerShown: false,
                }}
            />
        </Stack>
  );
}