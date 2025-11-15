import { Href, useRouter } from "expo-router";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { auth } from "../src/lib/firebase";

const SIGN_UP_ROUTE = "/(auth)/sign-up" as Href;
const ACCOUNT_SETUP_ROUTE = "/(auth)/account-setup" as Href;

export default function Index() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [checkingAuth, setCheckingAuth] = useState(!auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setCheckingAuth(false);
      if (!nextUser) {
        router.replace(SIGN_UP_ROUTE);
      }
    });
    return unsubscribe;
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign out.";
      Alert.alert("Sign out failed", message);
    }
  };

  const goToSetup = () => router.push(ACCOUNT_SETUP_ROUTE);

  if (checkingAuth) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return <View style={styles.centered} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>
        {user.displayName || user.email || "New Local Acts fan"}
      </Text>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={goToSetup}>
          <Text style={styles.primaryButtonText}>Update location</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleSignOut}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E0F0F",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 20,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E0F0F",
  },
  title: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "700",
  },
  subtitle: {
    color: "#A5A6AB",
    fontSize: 16,
  },
  actions: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#F97316",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#0F0E12",
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#2B2C33",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
