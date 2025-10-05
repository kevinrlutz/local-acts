import { Link } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
// dotenv must not be imported in client-side Expo code (it uses Node built-ins).
// Use app.config.js / Constants.manifest.extra or CLI env vars instead.

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ marginBottom: 12 }}>Welcome to LocalActs</Text>
      <Link href="./home">Go to Home</Link>
    </View>
  );
}
