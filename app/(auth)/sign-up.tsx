import { Href, useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { auth } from "@/src/lib/firebase";
const validatePasswords = (password: string, confirmPassword: string) => {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }
};

export default function SignUpScreen() {
  const router = useRouter();
  const accountSetupRoute = "/(auth)/account-setup" as Href;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showError = (message: string) => {
    setError(message);
    Alert.alert("Sign up error", message);
  };

  const navigateToAccountSetup = () => {
    router.replace(accountSetupRoute);
  };

  const handleEmailSignup = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      validatePasswords(password, confirmPassword);
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error("Email address is required.");
      }
      await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      navigateToAccountSetup();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create your account.";
      showError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
        keyboardVerticalOffset={24}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Discover and track local acts near you.</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              inputMode="email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@email.com"
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Create a password"
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Re-enter password"
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleEmailSignup}
            disabled={isSubmitting}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Account</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0E0F0F",
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#fff",
  },
  subtitle: {
    color: "#A5A6AB",
    fontSize: 16,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    color: "#E0E0E5",
    fontSize: 14,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#2B2C33",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#1A1B21",
    color: "#fff",
  },
  errorText: {
    color: "#FF5A5F",
    fontSize: 14,
    fontWeight: "500",
  },
  primaryButton: {
    backgroundColor: "#F97316",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#0F0E12",
    fontWeight: "700",
    fontSize: 16,
  },
});
