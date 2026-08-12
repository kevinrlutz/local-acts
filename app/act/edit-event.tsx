import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
import VenuePicker, { SelectedVenue } from "@/src/components/VenuePicker";
import { auth } from "@/src/lib/firebase";
import { parseEventDate, validateTicketUrl } from "@/src/lib/validationUtils";
import { getActProfileById } from "@/src/services/acts";
import { getEventById, updateEvent } from "@/src/services/events";
import { getVenueDetails } from "@/src/services/venueDetailsCache";
import type { ActEvent, ActProfile } from "@/src/types/acts";

const LOGIN_ROUTE = "/(auth)/login" as Href;
const ACT_PROFILE_ROUTE = "/act" as Href;

const DATE_PLACEHOLDER = "YYYY-MM-DD";
const TIME_PLACEHOLDER = "HH:MM";

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const formatTimeInput = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export default function EditEventScreen() {
  const router = useRouter();
  const { uid, eventId } = useLocalSearchParams<{ uid: string; eventId: string }>();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [isCheckingUser, setIsCheckingUser] = useState(!auth.currentUser);
  const [actProfile, setActProfile] = useState<ActProfile | null>(null);
  const [event, setEvent] = useState<ActEvent | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [ticketLink, setTicketLink] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<SelectedVenue | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Edit Event";
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

  useEffect(() => {
    const loadData = async () => {
      if (!uid || !eventId || !user) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const profile = await getActProfileById(uid);
        if (profile.ownerUid !== user.uid) {
          Alert.alert("Access denied", "You can only edit events for your own act.");
          router.replace(ACT_PROFILE_ROUTE);
          return;
        }
        const existingEvent = await getEventById(eventId);
        setActProfile(profile);
        setEvent(existingEvent);
        setTitle(existingEvent.title);
        setDate(formatDateInput(existingEvent.eventDate));
        setTime(existingEvent.hasTime ? formatTimeInput(existingEvent.eventDate) : "");
        setLocation(existingEvent.location ?? "");
        setTicketLink(existingEvent.ticketLink ?? "");
        setDescription(existingEvent.description ?? "");
        // Pre-populate the venue picker label if this event already has a
        // linked venue. Uses the venue-details cache (Places), not a fresh
        // Search Box session, since we're only confirming a name for display.
        if (existingEvent.venueMapboxId) {
          const venueMapboxId = existingEvent.venueMapboxId;
          try {
            const details = await getVenueDetails(venueMapboxId);
            setSelectedVenue({
              mapboxId: venueMapboxId,
              name: details.name,
              fullAddress: null,
              coordinates: details.coordinates ?? existingEvent.venueCoordinates ?? null,
            });
          } catch {
            setSelectedVenue({
              mapboxId: venueMapboxId,
              name: "Selected venue",
              fullAddress: null,
              coordinates: existingEvent.venueCoordinates ?? null,
            });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load event.";
        Alert.alert("Error", message);
        router.replace(ACT_PROFILE_ROUTE);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [uid, eventId, user, router]);

  const actName = useMemo(() => actProfile?.name ?? "", [actProfile?.name]);

  const handleSubmit = async () => {
    if (!user || !actProfile || !event) {
      Alert.alert("Session expired", "Sign in again to continue.");
      router.replace(LOGIN_ROUTE);
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Event title is required.");
      return;
    }
    const trimmedDate = date.trim();
    if (!trimmedDate) {
      setError("Event date is required.");
      return;
    }

    let parsedDate: Date;
    let hasTime = false;
    try {
      const parsed = parseEventDate(trimmedDate, time);
      parsedDate = parsed.eventDate;
      hasTime = parsed.hasTime;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Enter a valid event date.";
      setError(message);
      Alert.alert("Invalid date", message);
      return;
    }

    const trimmedLocation = location.trim();
    const trimmedTicketLink = ticketLink.trim();
    let validatedTicketLink: string | undefined;
    try {
      validatedTicketLink = validateTicketUrl(trimmedTicketLink);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Enter a valid ticket URL.";
      setError(message);
      Alert.alert("Invalid ticket link", message);
      return;
    }
    const trimmedDescription = description.trim();

    try {
      setIsSubmitting(true);
      setError(null);

      await updateEvent(event.id, {
        title: trimmedTitle,
        actCategory: actProfile.category,
        location: trimmedLocation || (selectedVenue ? `${selectedVenue.name} - ${selectedVenue.fullAddress}` : undefined),
        ticketLink: validatedTicketLink,
        description: trimmedDescription || undefined,
        eventDate: parsedDate,
        hasTime,
        venueMapboxId: selectedVenue?.mapboxId ?? null,
        venueCoordinates: selectedVenue?.coordinates ?? event.venueCoordinates ?? null,
      });

      router.replace((`${ACT_PROFILE_ROUTE}?uid=${encodeURIComponent(actProfile.id)}`) as Href);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update event.";
      setError(message);
      Alert.alert("Update error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingUser || isLoading) {
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
              <Text style={styles.title}>Edit Event</Text>
              <Text style={styles.subtitle}>
                Update details for {actName || "your act"} so fans stay informed.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Event title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Live at The Echo"
                placeholderTextColor={Colors.secondaryGray}
                style={styles.input}
              />
            </View>

            <View style={styles.formDoubleRow}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Date</Text>
                <Text style={styles.helperText}>Required — {DATE_PLACEHOLDER}</Text>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder={DATE_PLACEHOLDER}
                  placeholderTextColor={Colors.secondaryGray}
                  style={styles.input}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Time</Text>
                <Text style={styles.helperText}>Optional — {TIME_PLACEHOLDER}</Text>
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder={TIME_PLACEHOLDER}
                  placeholderTextColor={Colors.secondaryGray}
                  style={styles.input}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Venue (optional)</Text>
              <VenuePicker value={selectedVenue} onChange={setSelectedVenue} />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Location (optional - you can use this if your venue isn&apos;t listed)</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Venue or address"
                placeholderTextColor={Colors.secondaryGray}
                style={styles.input}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Ticket link (optional)</Text>
              <TextInput
                value={ticketLink}
                onChangeText={setTicketLink}
                placeholder="https://tickets.example.com/show"
                placeholderTextColor={Colors.secondaryGray}
                style={styles.input}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Setlist, openers, or important details."
                placeholderTextColor={Colors.secondaryGray}
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Update Event</Text>
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
    fontSize: 12,
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
  textArea: {
    minHeight: 120,
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
  venuePicker: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: Colors.secondaryBackground,
  },
  venuePickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.contentBorder,
  },
  venuePickerText: {
    color: Colors.primaryWhite,
    fontWeight: "600",
  },
  venuePickerMeta: {
    color: Colors.secondaryGray,
    fontSize: 12,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
});
