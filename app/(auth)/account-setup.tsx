import { Href, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
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
import { geocodeLocation, LocationMode, MissingMapboxTokenError } from "@/src/services/mapbox";
import { saveCompletedProfile, UserLocationPayload } from "@/src/services/userProfile";

const SIGN_UP_ROUTE = "/(auth)/sign-up" as Href;

export default function AccountSetupScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [isCheckingUser, setIsCheckingUser] = useState(!auth.currentUser);
  const [displayName, setDisplayName] = useState(auth.currentUser?.displayName ?? "");
  const [locationMode, setLocationMode] = useState<LocationMode>("zip");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [stateInput, setStateInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsCheckingUser(false);
      if (!nextUser) {
        router.replace(SIGN_UP_ROUTE);
      }
    });
    return unsubscribe;
  }, [router]);

  const locationSummary = useMemo(() => {
    if (locationMode === "zip") {
      return zip.trim();
    }
    const trimmedCity = city.trim();
    const trimmedState = stateInput.trim();
    return [trimmedCity, trimmedState].filter(Boolean).join(", ");
  }, [city, stateInput, zip, locationMode]);

  const buildGeocodeInput = () => {
    if (locationMode === "zip") {
      const normalizedZip = zip.trim();
      if (!normalizedZip) {
        throw new Error("Please provide a zip code.");
      }
      return { mode: "zip" as const, zip: normalizedZip };
    }
    const normalizedCity = city.trim();
    const normalizedState = stateInput.trim();
    if (!normalizedCity || !normalizedState) {
      throw new Error("City and state are both required.");
    }
    return {
      mode: "city-state" as const,
      city: normalizedCity,
      state: normalizedState,
    };
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert("Session expired", "Sign in again to continue setup.");
      router.replace(SIGN_UP_ROUTE);
      return;
    }
    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      setError("Display name is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const geocodeInput = buildGeocodeInput();
      const geocodeResult = await geocodeLocation(geocodeInput);
      console.log("Geocode result:", geocodeResult);
      const locationPayload: UserLocationPayload = {
        ...geocodeResult,
        rawInput: locationSummary,
        mode: locationMode,
      };
      console.log("Location payload:", locationPayload);
      console.log("Current user:", auth.currentUser?.uid);
      await saveCompletedProfile({
        uid: user.uid,
        displayName: trimmedDisplayName,
        location: locationPayload,
      });
      router.replace("/");
    } catch (err) {
      if (err instanceof MissingMapboxTokenError) {
        setError(err.message);
        Alert.alert("Mapbox configuration", err.message);
        return;
      }
      const message = err instanceof Error ? err.message : "Unable to finish setup.";
      setError(message);
      Alert.alert("Setup error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingUser) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={24}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Tell us about you</Text>
            <Text style={styles.subtitle}>
              We use this information to personalise your Local Acts experience.
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Add a stage or profile name"
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Location preference</Text>
            <View style={styles.modeRow}>
              {(["zip", "city-state"] as LocationMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setLocationMode(mode)}
                  style={[
                    styles.modeOption,
                    locationMode === mode && styles.modeOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeOptionText,
                      locationMode === mode && styles.modeOptionTextSelected,
                    ]}
                  >
                    {mode === "zip" ? "Zip code" : "City, State"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {locationMode === "zip" ? (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Zip code</Text>
              <TextInput
                value={zip}
                onChangeText={setZip}
                inputMode="numeric"
                keyboardType="number-pad"
                placeholder="e.g. 73301"
                style={styles.input}
                maxLength={10}
              />
            </View>
          ) : (
            <View style={styles.formDoubleRow}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="Austin"
                  style={styles.input}
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>State / Region</Text>
                <TextInput
                  value={stateInput}
                  onChangeText={setStateInput}
                  placeholder="TX"
                  style={styles.input}
                  autoCapitalize="characters"
                  maxLength={2}
                />
              </View>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Finish setup</Text>
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
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 18,
  },
  header: { gap: 6 },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#fff",
  },
  subtitle: {
    color: "#A5A6AB",
    fontSize: 15,
  },
  formGroup: {
    gap: 6,
  },
  formDoubleRow: {
    flexDirection: "row",
    gap: 12,
  },
  halfWidth: { flex: 1, gap: 6 },
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
  modeRow: {
    flexDirection: "row",
    gap: 12,
  },
  modeOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2B2C33",
    alignItems: "center",
  },
  modeOptionSelected: {
    borderColor: "#F97316",
    backgroundColor: "#24160B",
  },
  modeOptionText: {
    color: "#A5A6AB",
    fontWeight: "600",
  },
  modeOptionTextSelected: {
    color: "#F97316",
  },
  errorText: {
    color: "#FF5A5F",
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#F97316",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    color: "#0F0E12",
    fontWeight: "700",
    fontSize: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
