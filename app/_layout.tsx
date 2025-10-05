import { Stack } from "expo-router";
import React from "react";
import AuthGate from "../src/auth/AuthGate";
import Providers from "../src/providers/Providers";

export default function RootLayout() {
  return (
    <Providers>
      <AuthGate>
        <Stack />
      </AuthGate>
    </Providers>
  );
}
