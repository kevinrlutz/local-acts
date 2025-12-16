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
import { auth } from "@/src/lib/firebase";
import { createActEvent, getActProfileById } from "@/src/services/acts";
import type { ActProfile } from "@/src/types/acts";

const LOGIN_ROUTE = "/(auth)/login" as Href;
const ACT_PROFILE_ROUTE = "/act" as Href;

const DATE_PLACEHOLDER = "YYYY-MM-DD";
const TIME_PLACEHOLDER = "HH:MM";

const parseEventDate = (dateInput: string, timeInput?: string) => {
  const normalizedDate = dateInput.trim();
  const [yearStr, monthStr, dayStr] = normalizedDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    throw new Error("Enter a valid event date (YYYY-MM-DD).");
  }

  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    throw new Error("Enter a valid day for the selected month.");
  }

  let hours = 12;
  let minutes = 0;
  let hasTime = false;

  const normalizedTime = timeInput?.trim();
  if (normalizedTime) {
    const match = normalizedTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      throw new Error("Enter a valid time in HH:MM format.");
    }
    hours = Number(match[1]);
    minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
      throw new Error("Enter a valid time in HH:MM format.");
    }
    hasTime = true;
  }

  const eventDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(eventDate.getTime())) {
    throw new Error("Enter a valid event date.");
  }

  return { eventDate, hasTime } as const;
};

export default function CreateEventScreen() {
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [isCheckingUser, setIsCheckingUser] = useState(!auth.currentUser);
  const [actProfile, setActProfile] = useState<ActProfile | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [ticketLink, setTicketLink] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Add Event";
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
    const loadAct = async () => {
      if (!uid || !user) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const profile = await getActProfileById(uid);
        if (profile.ownerUid !== user.uid) {
          Alert.alert("Access denied", "You can only add events to your own act.");
          router.replace(ACT_PROFILE_ROUTE);
          return;
        }
        setActProfile(profile);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load act profile.";
        Alert.alert("Error", message);
        router.replace(ACT_PROFILE_ROUTE);
      } finally {
        setIsLoading(false);
      }
    };

    loadAct();
  }, [uid, user, router]);

  const actName = useMemo(() => actProfile?.name ?? "", [actProfile?.name]);

  const handleSubmit = async () => {
    if (!user || !actProfile) {
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
    const trimmedDescription = description.trim();

    try {
      setIsSubmitting(true);
      setError(null);

      await createActEvent(actProfile.id, {
        title: trimmedTitle,
        location: trimmedLocation || undefined,
        ticketLink: trimmedTicketLink || undefined,
        description: trimmedDescription || undefined,
        eventDate: parsedDate,
        hasTime,
      });

      router.replace((`${ACT_PROFILE_ROUTE}?uid=${encodeURIComponent(actProfile.id)}`) as Href);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create event.";
      setError(message);
      Alert.alert("Creation error", message);
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
              <Text style={styles.title}>Add an Event</Text>
              <Text style={styles.subtitle}>
                Create an event for {actName || "your act"} so fans can plan ahead.
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
              <Text style={styles.label}>Location (optional)</Text>
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
                <Text style={styles.primaryButtonText}>Create Event</Text>
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
});
