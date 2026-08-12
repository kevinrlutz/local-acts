import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/src/Colors";
import { auth, storage } from "@/src/lib/firebase";
import { getActProfileById } from "@/src/services/acts";
import { getEventById } from "@/src/services/events";
import type { ActEvent, ActProfile } from "@/src/types/acts";
import { getDownloadURL, ref } from "firebase/storage";

const ACT_PROFILE_ROUTE = "/act" as Href;
const EDIT_EVENT_ROUTE = "/act/edit-event" as Href;
const VENUE_PROFILE_ROUTE = "/venue" as Href;

const formatEventDate = (date: Date, hasTime?: boolean) => {
  const datePart = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (!hasTime) {
    return datePart;
  }
  const timePart = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} • ${timePart}`;
};

export default function EventDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [isCheckingAuth, setIsCheckingAuth] = useState(!auth.currentUser);
  const [event, setEvent] = useState<ActEvent | null>(null);
  const [actProfile, setActProfile] = useState<ActProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actImageUrl, setActImageUrl] = useState<string | undefined>(undefined);

  const eventId = useMemo(() => {
    const raw = params.eventId;
    if (!raw) {
      return undefined;
    }
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.eventId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsCheckingAuth(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchEvent = async () => {
      if (!eventId) {
        setError("Missing event identifier.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        const nextEvent = await getEventById(eventId);
        if (isMounted) {
          setEvent(nextEvent);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load event.";
        if (isMounted) {
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchEvent();
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  useEffect(() => {
    let isMounted = true;
    const fetchActProfile = async () => {
      if (!event?.actUid) {
        return;
      }
      try {
        const profile = await getActProfileById(event.actUid);
        if (isMounted) {
          setActProfile(profile);
        }
      } catch (err) {
        console.log("Error loading act profile for event", err);
      }
    };

    fetchActProfile();
    return () => {
      isMounted = false;
    };
  }, [event?.actUid]);

  useEffect(() => {
    if (actProfile?.profileImageRef) {
      getDownloadURL(ref(storage, actProfile.profileImageRef))
        .then(setActImageUrl)
        .catch(() => setActImageUrl(undefined));
    } else {
      setActImageUrl(undefined);
    }
  }, [actProfile?.profileImageRef]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = event?.title ? `${event.title} • Local Acts` : "Event Details";
      return () => {
        document.title = "Local Acts";
      };
    }
  }, [event?.title]);

  const isOwner = user && actProfile && user.uid === actProfile.ownerUid;

  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        throw new Error("Link is not supported on this device.");
      }
      await Linking.openURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to open link.";
      Alert.alert("Link error", message);
    }
  };

  const handleViewAct = () => {
    if (!actProfile) {
      return;
    }
    router.push(`${ACT_PROFILE_ROUTE}?uid=${encodeURIComponent(actProfile.id)}` as Href);
  };

  const handleViewVenue = () => {
    if (!event?.venueMapboxId) {
      return;
    }
    router.push(`${VENUE_PROFILE_ROUTE}?mapboxId=${encodeURIComponent(event.venueMapboxId)}` as Href);
  };

  const handleEditEvent = () => {
    if (!actProfile || !event) {
      return;
    }
    router.push(
      `${EDIT_EVENT_ROUTE}?uid=${encodeURIComponent(actProfile.id)}&eventId=${encodeURIComponent(
        event.id
      )}` as Href
    );
  };

  if (isLoading || isCheckingAuth) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Event not found."}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["right", "bottom", "left"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDate}>{formatEventDate(event.eventDate, event.hasTime)}</Text>

          {event.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.sectionText}>{event.description}</Text>
            </View>
          ) : null}

          {event.location ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <Text style={styles.sectionText}>{event.location}</Text>
            </View>
          ) : null}

          {event.ticketLink ? (
            <Pressable style={styles.actionButton} onPress={() => handleOpenLink(event.ticketLink!)}>
              <Text style={styles.actionButtonText}>Get Tickets</Text>
            </Pressable>
          ) : null}

          {event.venueMapboxId ? (
            <Pressable style={styles.secondaryButton} onPress={handleViewVenue}>
              <Text style={styles.editButtonText}>View Venue</Text>
            </Pressable>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Act</Text>
            <Pressable style={styles.actCard} onPress={handleViewAct}>
              {actImageUrl ? (
                <Image source={{ uri: actImageUrl }} style={styles.actImage} />
              ) : null}
              <View style={styles.actInfo}>
                <Text style={styles.actName}>{actProfile?.name ?? "Loading..."}</Text>
                <Text style={styles.actCategory}>{actProfile?.category ?? ""}</Text>
              </View>
            </Pressable>
          </View>

          {isOwner ? (
            <Pressable style={styles.editButton} onPress={handleEditEvent}>
              <Text style={styles.editButtonText}>Edit Event</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: Platform.select({ ios: 12, android: 8, default: 24 }),
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: Colors.secondaryBackground,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.primaryWhite,
  },
  eventDate: {
    fontSize: 16,
    color: Colors.secondaryGray,
  },
  section: {
    marginTop: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    color: Colors.primaryWhite,
    fontWeight: "700",
  },
  sectionText: {
    color: Colors.primaryWhite,
  },
  actionButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.action,
  },
  actionButtonText: {
    color: Colors.secondaryBackground,
    fontWeight: "700",
  },
  secondaryButton: {
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    backgroundColor: Colors.action,
  },
  secondaryButtonText: {
    color: Colors.secondaryBackground,
    fontWeight: "700",
  },
  actCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.background,
  },
  actImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  actInfo: {
    gap: 2,
  },
  actName: {
    color: Colors.primaryWhite,
    fontWeight: "700",
    fontSize: 16,
  },
  actCategory: {
    color: Colors.secondaryGray,
    fontSize: 14,
  },
  editButton: {
    marginTop: 20,
    backgroundColor: Colors.secondaryAction,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  editButtonText: {
    color: Colors.secondaryBackground,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    padding: 24,
  },
  errorText: {
    color: "#FF5A5F",
    fontWeight: "600",
  },
});
