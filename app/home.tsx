import { useRouter } from "expo-router";
import React from "react";
import { Button, Text, View } from "react-native";
import { useAuthStore } from "../src/store/useAuthStore";

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s: { user: any; }) => s.user);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>Home Screen</Text>
      <Text style={{ marginBottom: 8 }}>User: {user ? user.uid : "(not signed in)"}</Text>
  {!user && <Button title="Sign in" onPress={() => router.push("/login")} />}
    </View>
  );
}
