import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/src/Colors";
import { auth } from "@/src/lib/firebase";
import { getUpcomingEventsForVenue } from "@/src/services/events";
import { getVenueDetails, VenueNotFoundError } from "@/src/services/venueDetailsCache";
import type { ActEvent } from "@/src/types/acts";
import type { VenueDetails } from "@/src/types/venues";

const ACT_PROFILE_ROUTE = "/act" as Href;

const formatPopularity = (score: number | null) => {
  if (typeof score !== "number") return "Unknown";
  return `${Math.round(score * 100)}%`;
};

const formatEventDate = (date: Date, hasTime?: boolean) => {
  const datePart = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (!hasTime) return datePart;
  const timePart = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} • ${timePart}`;
};

export default function VenueProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mapboxId?: string | string[] }>();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [isCheckingAuth, setIsCheckingAuth] = useState(!auth.currentUser);

  const [venueDetails, setVenueDetails] = useState<VenueDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(true);

  const [events, setEvents] = useState<ActEvent[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState(true);

  const mapboxId = useMemo(() => {
    const raw = params.mapboxId;
    if (!raw) return undefined;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.mapboxId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsCheckingAuth(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!mapboxId) {
        setDetailsError("Missing venue identifier.");
        setIsDetailsLoading(false);
        return;
      }
      try {
        setIsDetailsLoading(true);
        setDetailsError(null);
        const details = await getVenueDetails(mapboxId);
        if (isMounted) setVenueDetails(details);
      } catch (err) {
        // Degrade gracefully: a Places lookup failure (404, timeout, quota)
        // shouldn't fail the whole page if there are still linked events to
        // show below.
        const message =
          err instanceof VenueNotFoundError
            ? "This venue is no longer listed."
            : err instanceof Error
            ? err.message
            : "Venue details are unavailable right now.";
        if (isMounted) setDetailsError(message);
      } finally {
        if (isMounted) setIsDetailsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [mapboxId]);

  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      if (!mapboxId) {
        setIsEventsLoading(false);
        return;
      }
      try {
        setIsEventsLoading(true);
        const upcoming = await getUpcomingEventsForVenue(mapboxId);
        if (isMounted) setEvents(upcoming);
      } catch (err) {
        console.error("Failed to load venue events:", err);
      } finally {
        if (isMounted) setIsEventsLoading(false);
      }
    };
    loadEvents();
    return () => {
      isMounted = false;
    };
  }, [mapboxId]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = venueDetails?.name ? `${venueDetails.name} • Local Acts` : "Venue Profile";
      return () => {
        document.title = "Local Acts";
      };
    }
  }, [venueDetails?.name]);

  if (isCheckingAuth) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.secondaryAction} />
      </View>
    );
  }

  if (!user) {
    return <View style={styles.centered} />;
  }

  const hasUsableDetails = !!venueDetails;
  const hasEvents = events.length > 0;

  if (isDetailsLoading && isEventsLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.secondaryAction} />
      </View>
    );
  }

  if (!hasUsableDetails && !isDetailsLoading && !hasEvents && !isEventsLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{detailsError ?? "Venue not found."}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["right", "bottom", "left"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {hasUsableDetails ? (
            <>
              <View>
                <Text style={styles.venueName}>{venueDetails.name}</Text>
                <Text style={styles.venueCategory}>
                  {(venueDetails.categories.length
                    ? venueDetails.categories
                    : venueDetails.primaryCategory
                    ? [venueDetails.primaryCategory]
                    : []
                  ).join(", ") || "Venue"}
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Hours</Text>
                <Text style={styles.sectionText}>
                  {venueDetails.openingHours ?? "Hours not available"}
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Popularity</Text>
                <Text style={styles.sectionText}>
                  {formatPopularity(venueDetails.popularityScore)}
                </Text>
              </View>

              {venueDetails.permanentlyClosed ? (
                <Text style={styles.warningText}>This venue is marked as permanently closed.</Text>
              ) : null}
            </>
          ) : (
            <View style={styles.section}>
              <Text style={styles.venueName}>Venue details unavailable</Text>
              <Text style={styles.sectionSubtext}>
                {detailsError ?? "We couldn't load details for this venue right now."}
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            {isEventsLoading ? (
              <ActivityIndicator color={Colors.secondaryAction} />
            ) : hasEvents ? (
              <View style={styles.eventList}>
                {events.map((event) => (
                  <Pressable
                    key={event.id}
                    style={styles.eventCard}
                    onPress={() =>
                      router.push(
                        `${ACT_PROFILE_ROUTE}?uid=${encodeURIComponent(event.actUid)}` as Href
                      )
                    }
                  >
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventMeta}>
                      {formatEventDate(event.eventDate, event.hasTime)}
                    </Text>
                    {event.description ? (
                      <Text style={styles.sectionSubtext}>{event.description}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.sectionSubtext}>No upcoming events at this venue yet.</Text>
            )}
          </View>
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    padding: 24,
    gap: 16,
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
  section: {
    marginTop: 12,
    gap: 8,
  },
  venueName: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.primaryWhite,
  },
  venueCategory: {
    fontSize: 16,
    color: Colors.secondaryGray,
  },
  sectionTitle: {
    fontSize: 16,
    color: Colors.primaryWhite,
    fontWeight: "700",
  },
  sectionText: {
    color: Colors.primaryWhite,
  },
  sectionSubtext: {
    color: Colors.secondaryGray,
    fontSize: 14,
  },
  warningText: {
    color: "#FF5A5F",
    fontWeight: "600",
  },
  eventList: {
    gap: 10,
  },
  eventCard: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  eventTitle: {
    color: Colors.primaryWhite,
    fontWeight: "700",
    fontSize: 15,
  },
  eventMeta: {
    color: Colors.secondaryGray,
    fontSize: 13,
  },
  backButton: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  backButtonText: {
    color: Colors.primaryWhite,
    fontWeight: "600",
  },
  errorText: {
    color: Colors.appleMusic,
    textAlign: "center",
  },
});

