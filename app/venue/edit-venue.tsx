import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/src/Colors";
import { useImagePicker } from "@/src/hooks/useImagePicker";
import { auth, storage } from "@/src/lib/firebase";
import {
    AddressSuggestion,
    MissingMapboxTokenError,
    searchAddresses,
} from "@/src/services/mapbox";
import {
    deleteVenueProfile,
    getVenueProfileById,
    updateVenueProfile,
} from "@/src/services/venues";
import {
    DayHours,
    DayOfWeek,
    DAYS_OF_WEEK,
    VenueCategory,
    VenueProfile,
    WeeklyHours,
} from "@/src/types/venues";

const LOGIN_ROUTE = "/(auth)/login" as Href;
const VENUE_PROFILE_ROUTE = "/venue" as Href;
const HOME_ROUTE = "/" as Href;

const CATEGORY_OPTIONS: VenueCategory[] = [
  "Bar / Club",
  "Concert Hall",
  "Theater",
  "Restaurant",
  "Other",
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const validateHours = (hours: WeeklyHours): void => {
  for (const day of DAYS_OF_WEEK) {
    const { closed, open, close } = hours[day];
    if (closed) continue;
    if (!open || !close) {
      const label = day.charAt(0).toUpperCase() + day.slice(1);
      throw new Error(
        `${label}: both open and close times are required, or mark the day as closed.`
      );
    }
    if (!TIME_PATTERN.test(open)) {
      const label = day.charAt(0).toUpperCase() + day.slice(1);
      throw new Error(`${label}: open time must be in HH:MM format (e.g. 20:00).`);
    }
    if (!TIME_PATTERN.test(close)) {
      const label = day.charAt(0).toUpperCase() + day.slice(1);
      throw new Error(`${label}: close time must be in HH:MM format (e.g. 02:00).`);
    }
  }
};

export default function EditVenueScreen() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { pickImage } = useImagePicker();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [isCheckingUser, setIsCheckingUser] = useState(!auth.currentUser);
  const [isLoading, setIsLoading] = useState(true);
  const [venueProfile, setVenueProfile] = useState<VenueProfile | null>(null);

  const [venueName, setVenueName] = useState("");
  const [categories, setCategories] = useState<VenueCategory[]>(["Bar / Club"]);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [hasImageChanged, setHasImageChanged] = useState(false);
  const [hours, setHours] = useState<WeeklyHours>({
    monday: { closed: false, open: null, close: null },
    tuesday: { closed: false, open: null, close: null },
    wednesday: { closed: false, open: null, close: null },
    thursday: { closed: false, open: null, close: null },
    friday: { closed: false, open: null, close: null },
    saturday: { closed: false, open: null, close: null },
    sunday: { closed: false, open: null, close: null },
  });

  // Address typeahead state — preserves existing confirmed address
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<
    AddressSuggestion[]
  >([]);
  const [selectedAddress, setSelectedAddress] =
    useState<AddressSuggestion | null>(null);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Edit Venue Profile";
      return () => {
        document.title = "Local Acts";
      };
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsCheckingUser(false);
      if (!nextUser) router.replace(LOGIN_ROUTE);
    });
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    const load = async () => {
      if (!uid || !user) return;
      try {
        setIsLoading(true);
        const profile = await getVenueProfileById(uid);
        if (profile.ownerUid !== user.uid) {
          Alert.alert("Access denied", "You can only edit your own venue profile.");
          router.replace(VENUE_PROFILE_ROUTE);
          return;
        }
        setVenueProfile(profile);
        setVenueName(profile.name);
        setCategories(profile.categories ?? ["Bar / Club"]);
        setHours(profile.hours);
        // Pre-populate address query with the formatted address
        setAddressQuery(profile.formattedAddress);
        // Create a synthetic confirmed address from stored data
        setSelectedAddress({
          id: profile.id,
          placeName: profile.formattedAddress,
          address: profile.address,
          city: profile.city,
          state: profile.state,
          zip: profile.zip,
          coordinates: profile.coordinates,
        });
        if (profile.profileImageRef) {
          try {
            const url = await getDownloadURL(ref(storage, profile.profileImageRef));
            setProfileImageUri(url);
          } catch {
            // No image — leave as null
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load venue profile.";
        Alert.alert("Error", message);
        router.replace(VENUE_PROFILE_ROUTE);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [uid, user, router]);

  const handleAddressQueryChange = useCallback((text: string) => {
    setAddressQuery(text);
    setSelectedAddress(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setAddressSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setIsFetchingSuggestions(true);
        const results = await searchAddresses(text);
        setAddressSuggestions(results);
      } catch {
        setAddressSuggestions([]);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 300);
  }, []);

  const handleSelectAddress = useCallback((suggestion: AddressSuggestion) => {
    setSelectedAddress(suggestion);
    setAddressQuery(suggestion.placeName);
    setAddressSuggestions([]);
  }, []);

  const updateDayHours = useCallback(
    (day: DayOfWeek, field: keyof DayHours, value: boolean | string) => {
      setHours((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          [field]: value,
          ...(field === "closed" && value === true
            ? { open: null, close: null }
            : {}),
        },
      }));
    },
    []
  );

  const handlePickImage = async () => {
    const result = await pickImage({ quality: 0.7 });
    if (result) {
      setProfileImageUri(result.uri);
      setHasImageChanged(true);
    }
  };

  const handleSubmit = async () => {
    if (!user || !venueProfile) {
      Alert.alert("Session expired", "Sign in again to continue.");
      router.replace(LOGIN_ROUTE);
      return;
    }

    const trimmedName = venueName.trim();
    if (!trimmedName) {
      setError("Venue name is required.");
      return;
    }

    if (!selectedAddress) {
      setError("Please select a street address from the suggestions.");
      return;
    }

    try {
      validateHours(hours);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Please fix venue hours.";
      setError(message);
      Alert.alert("Invalid hours", message);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let profileImageRef = venueProfile.profileImageRef ?? null;
      if (hasImageChanged && profileImageUri) {
        const response = await fetch(profileImageUri);
        const blob = await response.blob();
        const storageRef = ref(storage, `venue-profile-images/${user.uid}`);
        await uploadBytes(storageRef, blob);
        profileImageRef = `venue-profile-images/${user.uid}`;
      }

      await updateVenueProfile({
        venueId: venueProfile.id,
        name: trimmedName,
        categories,
        address: selectedAddress.address,
        city: selectedAddress.city,
        state: selectedAddress.state,
        zip: selectedAddress.zip,
        formattedAddress: selectedAddress.placeName,
        coordinates: selectedAddress.coordinates,
        hours,
        profileImageRef,
      });

      router.replace(
        `${VENUE_PROFILE_ROUTE}?uid=${encodeURIComponent(venueProfile.id)}` as Href
      );
    } catch (err) {
      if (err instanceof MissingMapboxTokenError) {
        setError(err.message);
        Alert.alert("Mapbox configuration", err.message);
        return;
      }
      const message =
        err instanceof Error ? err.message : "Unable to update venue profile.";
      setError(message);
      Alert.alert("Update error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !venueProfile) return;

    const confirm = () =>
      new Promise<boolean>((resolve) => {
        if (Platform.OS === "web") {
          resolve(
            typeof window !== "undefined"
              ? window.confirm(
                  "Delete this venue profile? This action cannot be undone."
                )
              : false
          );
          return;
        }
        Alert.alert(
          "Delete Venue Profile",
          "Are you sure? This action cannot be undone.",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => resolve(true),
            },
          ]
        );
      });

    const confirmed = await confirm();
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await deleteVenueProfile(venueProfile.id);
      router.replace(HOME_ROUTE);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to delete venue profile.";
      Alert.alert("Delete error", message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isCheckingUser || isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.secondaryAction} />
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Edit Venue Profile</Text>
            </View>

            {/* Venue Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Venue name</Text>
              <TextInput
                value={venueName}
                onChangeText={setVenueName}
                placeholder="e.g. The Blue Room"
                placeholderTextColor={Colors.secondaryGray}
                style={styles.input}
              />
            </View>

            {/* Category */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.chipRow}>
                {CATEGORY_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() =>
                      setCategories((prev) =>
                        prev.includes(option)
                          ? prev.length > 1
                            ? prev.filter((c) => c !== option)
                            : prev
                          : [...prev, option]
                      )
                    }
                    style={[
                      styles.chip,
                      categories.includes(option) && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        categories.includes(option) && styles.chipTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Address Typeahead */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Street address</Text>
              <Text style={styles.helperText}>
                Clear and retype to search for a new address.
              </Text>
              <TextInput
                value={addressQuery}
                onChangeText={handleAddressQueryChange}
                placeholder="123 Main St, City, State"
                placeholderTextColor={Colors.secondaryGray}
                style={[
                  styles.input,
                  selectedAddress ? styles.inputConfirmed : null,
                ]}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {isFetchingSuggestions && (
                <ActivityIndicator
                  style={styles.suggestionsLoader}
                  color={Colors.secondaryAction}
                  size="small"
                />
              )}
              {addressSuggestions.length > 0 && (
                <View style={styles.suggestionsList}>
                  {addressSuggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion.id}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectAddress(suggestion)}
                    >
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {suggestion.placeName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {selectedAddress && (
                <View style={styles.addressConfirmed}>
                  <Text style={styles.addressConfirmedText}>
                    {selectedAddress.address}
                    {selectedAddress.city ? `, ${selectedAddress.city}` : ""}
                    {selectedAddress.state ? `, ${selectedAddress.state}` : ""}
                    {selectedAddress.zip ? ` ${selectedAddress.zip}` : ""}
                  </Text>
                </View>
              )}
            </View>

            {/* Hours */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Hours</Text>
              <Text style={styles.helperText}>
                24-hour format (e.g. 20:00). Close before open = past midnight.
              </Text>
              {DAYS_OF_WEEK.map((day) => (
                <View key={day} style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{DAY_LABELS[day]}</Text>
                  <Switch
                    value={!hours[day].closed}
                    onValueChange={(val) =>
                      updateDayHours(day, "closed", !val)
                    }
                    trackColor={{
                      false: Colors.contentBorder,
                      true: Colors.secondaryAction,
                    }}
                    thumbColor={Colors.primaryWhite}
                  />
                  {!hours[day].closed ? (
                    <View style={styles.timeInputs}>
                      <TextInput
                        value={hours[day].open ?? ""}
                        onChangeText={(v) => updateDayHours(day, "open", v)}
                        placeholder="HH:MM"
                        placeholderTextColor={Colors.secondaryGray}
                        style={styles.timeInput}
                        autoCapitalize="none"
                        maxLength={5}
                      />
                      <Text style={styles.timeSeparator}>–</Text>
                      <TextInput
                        value={hours[day].close ?? ""}
                        onChangeText={(v) => updateDayHours(day, "close", v)}
                        placeholder="HH:MM"
                        placeholderTextColor={Colors.secondaryGray}
                        style={styles.timeInput}
                        autoCapitalize="none"
                        maxLength={5}
                      />
                    </View>
                  ) : (
                    <Text style={styles.closedLabel}>Closed</Text>
                  )}
                </View>
              ))}
            </View>

            {/* Profile Photo */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Profile photo (optional)</Text>
              <View style={styles.photoRow}>
                {profileImageUri ? (
                  <Image
                    source={{ uri: profileImageUri }}
                    style={styles.photoPreview}
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderText}>
                      No photo selected
                    </Text>
                  </View>
                )}
                <Pressable style={styles.photoButton} onPress={handlePickImage}>
                  <Text style={styles.photoButtonText}>
                    {profileImageUri ? "Change Photo" : "Select Photo"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[
                styles.primaryButton,
                isSubmitting && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Save Changes</Text>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.deleteButton,
                isDeleting && styles.buttonDisabled,
              ]}
              onPress={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color={Colors.appleMusic} />
              ) : (
                <Text style={styles.deleteButtonText}>Delete Venue Profile</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 },
  container: { gap: 24, paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  header: { gap: 4 },
  title: { fontSize: 22, fontWeight: "700", color: Colors.primaryWhite },
  formGroup: { gap: 8 },
  label: { color: Colors.primaryWhite, fontWeight: "600", fontSize: 15 },
  helperText: { color: Colors.secondaryGray, fontSize: 13 },
  input: {
    backgroundColor: Colors.secondaryBackground,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.primaryWhite,
    fontSize: 15,
  },
  inputConfirmed: { borderColor: Colors.successGreen },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
  },
  chipActive: {
    backgroundColor: Colors.secondaryAction,
    borderColor: Colors.secondaryAction,
  },
  chipText: { color: Colors.secondaryGray, fontWeight: "600" },
  chipTextActive: { color: Colors.secondaryBackground },
  suggestionsLoader: { marginTop: 4 },
  suggestionsList: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.secondaryBackground,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.contentBorder,
  },
  suggestionText: { color: Colors.primaryWhite, fontSize: 14 },
  addressConfirmed: {
    backgroundColor: Colors.secondaryBackground,
    borderWidth: 1,
    borderColor: Colors.successGreen,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addressConfirmedText: {
    color: Colors.successGreen,
    fontSize: 13,
    fontWeight: "600",
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  dayLabel: { color: Colors.primaryWhite, fontWeight: "600", width: 36 },
  timeInputs: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeInput: {
    flex: 1,
    backgroundColor: Colors.secondaryBackground,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.primaryWhite,
    fontSize: 14,
    textAlign: "center",
  },
  timeSeparator: { color: Colors.secondaryGray, fontWeight: "600" },
  closedLabel: { flex: 1, color: Colors.secondaryGray, fontStyle: "italic" },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  photoPreview: { width: 80, height: 80, borderRadius: 16 },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: Colors.secondaryBackground,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    color: Colors.secondaryGray,
    fontSize: 11,
    textAlign: "center",
  },
  photoButton: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  photoButtonText: { color: Colors.primaryWhite, fontWeight: "600" },
  errorText: { color: Colors.appleMusic, textAlign: "center" },
  primaryButton: {
    backgroundColor: Colors.action,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: Colors.appleMusic,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: {
    color: Colors.secondaryBackground,
    fontWeight: "700",
    fontSize: 15,
  },
  deleteButtonText: {
    color: Colors.appleMusic,
    fontWeight: "700",
    fontSize: 15,
  },
});
