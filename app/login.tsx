import { signInAnonymously } from "firebase/auth";
import React from "react";
import { Alert, Button, Text, View } from "react-native";
import { getFirebaseAuth } from "../src/firebase/init";
import { useAuthStore } from "../src/store/useAuthStore";

export default function Login() {
  const setUser = useAuthStore((s: { setUser: any }) => s.setUser);

  async function handleAnon() {
    try {
      const auth = getFirebaseAuth();
      const result = await signInAnonymously(auth);
      setUser({ uid: result.user.uid });
      console.log("Signed in anonymously with uid:", result.user.uid);
    } catch (error) {
      console.error("Failed to sign in anonymously", error);
      // If Firebase not configured, fallback to fake auth
      setUser({ uid: "fake-uid" });
      Alert.alert("Note", "Firebase not configured - using placeholder auth.");
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>Login</Text>
      <Button title="Sign in (anonymous)" onPress={handleAnon} />
    </View>
  );
}
