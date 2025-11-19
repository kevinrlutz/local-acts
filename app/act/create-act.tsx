import * as ImagePicker from "expo-image-picker";
import { Href, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/src/Colors";
import { auth, storage } from "@/src/lib/firebase";
import { createActProfile } from "@/src/services/acts";
import { geocodeLocation, LocationMode, MissingMapboxTokenError } from "@/src/services/mapbox";
import { UserLocationPayload } from "@/src/services/userProfile";
import { ActCategory, ActSocialLinks } from "@/src/types/acts";
import { ref, uploadBytes } from "firebase/storage";

const LOGIN_ROUTE = "/(auth)/login" as Href;
const ACT_PROFILE_ROUTE = "/act" as Href;
const CATEGORY_OPTIONS: ActCategory[] = ["Musician", "Rapper", "Comedian", "Other"];
const SOCIAL_LINK_FIELDS: Record<keyof ActSocialLinks, { label: string; placeholder: string; pattern: RegExp }> = {
  spotify: {
    label: "Spotify",
    placeholder: "https://open.spotify.com/artist/...",
    pattern: /^https?:\/\/(?:open|play)\.spotify\.com\/.+/i,
  },
  appleMusic: {
    label: "Apple Music",
    placeholder: "https://music.apple.com/artist/...",
    pattern: /^https?:\/\/music\.apple\.com\/.+/i,
  },
  instagram: {
    label: "Instagram",
    placeholder: "https://instagram.com/username",
    pattern: /^https?:\/\/(?:www\.)?instagram\.com\/.+/i,
  },
};

type SocialLinkKey = keyof ActSocialLinks;

const validateSocialLinks = (linkValues: Record<SocialLinkKey, string>): ActSocialLinks | undefined => {
  const normalized: ActSocialLinks = {};
  (Object.entries(linkValues) as [SocialLinkKey, string][]).forEach(([key, value]) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    const { pattern, label } = SOCIAL_LINK_FIELDS[key];
    if (!pattern.test(trimmed)) {
      throw new Error(`Enter a valid ${label} link.`);
    }
    normalized[key] = trimmed;
  });

  return Object.keys(normalized).length ? normalized : undefined;
};

export default function CreateActScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [isCheckingUser, setIsCheckingUser] = useState(!auth.currentUser);
  const [actName, setActName] = useState("");
  const [category, setCategory] = useState<ActCategory>("Musician");
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<SocialLinkKey, string>>({
    spotify: "",
    appleMusic: "",
    instagram: "",
  });
  const [locationMode, setLocationMode] = useState<LocationMode>("zip");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [stateInput, setStateInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Create Act Profile";
      return () => {
        document.title = "Local Acts";
      };
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsCheckingUser(false);
      if (!nextUser) {
        router.replace(LOGIN_ROUTE);
      }
    });
    return unsubscribe;
  }, [router]);

  const locationSummary = useMemo(() => {
    if (locationMode === "zip") {
      return zip.trim();
    }
    const normalizedCity = city.trim();
    const normalizedState = stateInput.trim();
    return [normalizedCity, normalizedState].filter(Boolean).join(", ");
  }, [city, stateInput, zip, locationMode]);

  const buildGeocodeInput = () => {
    if (locationMode === "zip") {
      const normalizedZip = zip.trim();
      if (!normalizedZip) {
        throw new Error("Please provide a zip code for your act.");
      }
      return { mode: "zip" as const, zip: normalizedZip };
    }
    const normalizedCity = city.trim();
    const normalizedState = stateInput.trim();
    if (!normalizedCity || !normalizedState) {
      throw new Error("City and state are both required for your act location.");
    }
    return { mode: "city-state" as const, city: normalizedCity, state: normalizedState };
  };

  const ensureMediaPermission = async () => {
    const { granted, status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Permission needed",
        status === ImagePicker.PermissionStatus.DENIED
          ? "Please enable photo permissions to upload an act profile picture."
          : "Unable to access your media library."
      );
      return false;
    }
    return true;
  };

  const handlePickImage = async () => {
  const canAccessMedia = await ensureMediaPermission();
  if (!canAccessMedia) {
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (!result.canceled) {
    const asset = result.assets?.[0];
    if (asset?.uri) {
      setProfileImageUri(asset.uri);
    }
  }
};

  const handleLinkChange = (key: SocialLinkKey, value: string) => {
    setLinks((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert("Session expired", "Sign in again to continue.");
      router.replace(LOGIN_ROUTE);
      return;
    }
    const trimmedActName = actName.trim();
    if (!trimmedActName) {
      setError("Act name is required.");
      return;
    }
    if (!profileImageUri) {
      setError("Add a profile picture for your act.");
      return;
    }

    let normalizedLinks: ActSocialLinks | undefined;
    try {
      normalizedLinks = validateSocialLinks(links);
    } catch (validationError) {
      const message =
        validationError instanceof Error ? validationError.message : "Enter valid social links.";
      setError(message);
      Alert.alert("Invalid social link", message);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch(profileImageUri);
      const blob = await response.blob();
      const storageRef = ref(storage, `act-profile-images/${user.uid}`);
      await uploadBytes(storageRef, blob);
      const profileImageRef = `act-profile-images/${user.uid}`;

      const geocodeInput = buildGeocodeInput();
      const geocodedLocation = await geocodeLocation(geocodeInput);
      const locationPayload: UserLocationPayload = {
        ...geocodedLocation,
        rawInput: locationSummary,
        mode: locationMode,
      };

      const actId = await createActProfile({
        ownerUid: user.uid,
        name: trimmedActName,
        category,
        profileImageRef,
        links: normalizedLinks,
        location: locationPayload,
      });

      router.replace((`${ACT_PROFILE_ROUTE}?uid=${encodeURIComponent(actId)}`) as Href);
    } catch (err) {
        console.log("Error creating act profile:", err);
      if (err instanceof MissingMapboxTokenError) {
        setError(err.message);
        Alert.alert("Mapbox configuration", err.message);
        return;
      }
      const message = err instanceof Error ? err.message : "Unable to create act profile.";
      setError(message);
      Alert.alert("Creation error", message);
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Create an Act Profile</Text>
              <Text style={styles.subtitle}>
                Share your act details so fans nearby can find and follow you.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Act name</Text>
              <TextInput
                value={actName}
                onChangeText={setActName}
                placeholder="e.g. Sunset Sounds"
                placeholderTextColor={Colors.secondaryGray}
                style={styles.input}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.modeRow}>
                {CATEGORY_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setCategory(option)}
                    style={[styles.modeOption, category === option && styles.modeOptionSelected]}
                  >
                    <Text
                      style={[styles.modeOptionText, category === option && styles.modeOptionTextSelected]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Profile picture</Text>
              <View style={styles.photoRow}>
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderText}>No photo selected</Text>
                  </View>
                )}
                <Pressable style={styles.photoButton} onPress={handlePickImage}>
                  <Text style={styles.photoButtonText}>
                    {profileImageUri ? "Change Photo" : "Select Photo"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Social links (optional)</Text>
              {Object.entries(SOCIAL_LINK_FIELDS).map(([key, config]) => (
                <View key={key} style={styles.linkField}>
                  <Text style={styles.linkLabel}>{config.label}</Text>
                  <TextInput
                    value={links[key as SocialLinkKey]}
                    onChangeText={(value) => handleLinkChange(key as SocialLinkKey, value)}
                    placeholder={config.placeholder}
                    placeholderTextColor={Colors.secondaryGray}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </View>
              ))}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Act location</Text>
              <Text style={styles.helperText}>
                Fans will see your act when they search within this area.
              </Text>
              <View style={styles.modeRow}>
                {(["zip", "city-state"] as LocationMode[]).map((mode) => (
                  <Pressable
                    key={mode}
                    onPress={() => setLocationMode(mode)}
                    style={[styles.modeOption, locationMode === mode && styles.modeOptionSelected]}
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
                  placeholder="e.g. 10001"
                  placeholderTextColor={Colors.secondaryGray}
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
                    placeholder="Los Angeles"
                    placeholderTextColor={Colors.secondaryGray}
                    style={styles.input}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Text style={styles.label}>State / Region</Text>
                  <TextInput
                    value={stateInput}
                    onChangeText={(next) => setStateInput(next.toUpperCase())}
                    placeholder="CA"
                    placeholderTextColor={Colors.secondaryGray}
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
                <Text style={styles.primaryButtonText}>Create Act Profile</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === "android" ? 48 : 24,
    alignItems: "center",
  },
  container: {
    width: "100%",
    maxWidth: 720,
  },
  header: {
    gap: 6,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.primaryWhite,
  },
  subtitle: {
    color: Colors.secondaryGray,
    fontSize: 15,
  },
  formGroup: {
    marginTop: 16,
    gap: 10,
  },
  label: {
    color: Colors.primaryWhite,
    fontWeight: "700",
    fontSize: 14,
  },
  helperText: {
    color: Colors.secondaryGray,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.secondaryBackground,
    color: Colors.primaryWhite,
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
    borderColor: Colors.contentBorder,
    alignItems: "center",
  },
  modeOptionSelected: {
    borderColor: Colors.action,
    backgroundColor: Colors.secondaryBackground,
  },
  modeOptionText: {
    color: Colors.secondaryGray,
    fontWeight: "600",
  },
  modeOptionTextSelected: {
    color: Colors.action,
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  photoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.secondaryBackground,
  },
  photoPlaceholderText: {
    color: Colors.secondaryGray,
    textAlign: "center",
    fontSize: 12,
  },
  photoPreview: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  photoButton: {
    backgroundColor: Colors.secondaryAction,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  photoButtonText: {
    color: Colors.primaryWhite,
    fontWeight: "700",
  },
  linkField: {
    gap: 6,
  },
  linkLabel: {
    color: Colors.secondaryGray,
    fontSize: 13,
  },
  formDoubleRow: {
    flexDirection: "row",
    gap: 12,
  },
  halfWidth: {
    flex: 1,
    gap: 6,
  },
  errorText: {
    color: "#FF5A5F",
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: Colors.action,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: Colors.secondaryBackground,
    fontWeight: "700",
    fontSize: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
});
