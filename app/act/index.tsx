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
import { deleteEvent, getEventsForAct } from "@/src/services/events";
import type { ActEvent, ActProfile } from "@/src/types/acts";
import { getDownloadURL, ref } from "firebase/storage";

const EDIT_ACT_ROUTE = "/act/edit-act" as Href;
const CREATE_EVENT_ROUTE = "/act/create-event" as Href;
const EDIT_EVENT_ROUTE = "/act/edit-event" as Href;
const EVENT_ROUTE = "/event" as Href;
const VENUE_PROFILE_ROUTE = "/venue" as Href;

const SOCIAL_LINK_LABELS: Partial<Record<keyof NonNullable<ActProfile["links"]>, string>> = {
  spotify: "Spotify",
  appleMusic: "Apple Music",
  instagram: "Instagram",
};

const getSocialLinkColor = (key: keyof NonNullable<ActProfile["links"]>): string => {
  switch (key) {
    case 'spotify':
      return Colors.spotify;
    case 'appleMusic':
      return Colors.appleMusic;
    case 'instagram':
      return Colors.instagram;
    default:
      return Colors.action;
  }
};

export default function ActProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uid?: string | string[] }>();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [isCheckingAuth, setIsCheckingAuth] = useState(!auth.currentUser);
  const [actProfile, setActProfile] = useState<ActProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [events, setEvents] = useState<ActEvent[] | null>(null);
  const [isEventsLoading, setIsEventsLoading] = useState(true);

  const actUid = useMemo(() => {
    const rawUid = params.uid;
    if (!rawUid) {
      return undefined;
    }
    return Array.isArray(rawUid) ? rawUid[0] : rawUid;
  }, [params.uid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsCheckingAuth(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchActProfile = async () => {
      if (!actUid) {
        setError("Missing act identifier.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        const profile = await getActProfileById(actUid);
        if (isMounted) {
          setActProfile(profile);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load act profile.";
        if (isMounted) {
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchActProfile();
    return () => {
      isMounted = false;
    };
  }, [actUid]);

  useEffect(() => {
    let isMounted = true;
    const fetchEvents = async () => {
      if (!actUid || !actProfile || actProfile.id !== actUid) {
        setIsEventsLoading(false);
        return;
      }
      try {
        setIsEventsLoading(true);
        const nextEvents = await getEventsForAct(actUid, actProfile.eventUids ?? []);
        if (isMounted) {
          setEvents(nextEvents);
        }
      } catch (err) {
        console.log("Error loading act events", err);
      } finally {
        if (isMounted) {
          setIsEventsLoading(false);
        }
      }
    };

    fetchEvents();
    return () => {
      isMounted = false;
    };
  }, [actUid, actProfile]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = actProfile?.name ? `${actProfile.name} • Local Acts` : "Act Profile";
      return () => {
        document.title = "Local Acts";
      };
    }
  }, [actProfile?.name]);

  useEffect(() => {
    if (actProfile?.profileImageRef) {
      getDownloadURL(ref(storage, actProfile.profileImageRef))
        .then(setImageUrl)
        .catch(() => setImageUrl(undefined));
    } else {
      setImageUrl(undefined);
    }
  }, [actProfile?.profileImageRef]);

  const isOwner = user && actProfile && user.uid === actProfile.ownerUid;

  const formatEventDate = (date: Date, hasTime?: boolean) => {
    const datePart = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    if (!hasTime) {
      return datePart;
    }
    const timePart = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${datePart} • ${timePart}`;
  };

  const confirmDeleteEvent = () =>
    new Promise<boolean>((resolve) => {
      const isWeb = Platform.OS === "web";
      if (isWeb) {
        const confirmed = typeof window !== "undefined"
          ? window.confirm("Delete this event? This action cannot be undone.")
          : false;
        resolve(confirmed);
        return;
      }

      Alert.alert(
        "Delete Event",
        "Are you sure you want to delete this event? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Delete", style: "destructive", onPress: () => resolve(true) },
        ]
      );
    });

  const handleDeleteEvent = async (eventId: string) => {
    if (!actProfile || !isOwner) {
      return;
    }

    const confirmed = await confirmDeleteEvent();

    if (!confirmed) {
      return;
    }

    try {
      await deleteEvent(eventId);
      setEvents((prev) => prev?.filter((event) => event.id !== eventId) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete event.";
      Alert.alert("Delete error", message);
    }
  };

  const handleAddEventPress = () => {
    if (!actProfile) return;
    router.push((`${CREATE_EVENT_ROUTE}?uid=${encodeURIComponent(actProfile.id)}`) as Href);
  };

  const handleEditEventPress = (eventId: string) => {
    if (!actProfile) return;
    router.push((`${EDIT_EVENT_ROUTE}?uid=${encodeURIComponent(actProfile.id)}&eventId=${encodeURIComponent(eventId)}`) as Href);
  };

  const handleViewEventPress = (eventId: string) => {
    router.push(`${EVENT_ROUTE}?eventId=${encodeURIComponent(eventId)}` as Href);
  };

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

  const handleEditPress = () => router.push((`${EDIT_ACT_ROUTE}?uid=${encodeURIComponent(actProfile!.id)}`) as Href);

  if (isLoading || isCheckingAuth) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !actProfile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Act profile not found."}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["right", "bottom", "left"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Image source={{ uri: imageUrl }} style={styles.heroImage} />
          <Text style={styles.actName}>{actProfile.name}</Text>
          <Text style={styles.category}>{actProfile.category}</Text>

          {actProfile.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.sectionText}>{actProfile.description}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.sectionText}>{actProfile.location.formattedAddress}</Text>
            {actProfile.location.city && actProfile.location.state ? (
              <Text style={styles.sectionSubtext}>
                {actProfile.location.city}, {actProfile.location.state}
              </Text>
            ) : null}
          </View>

          {actProfile.links && Object.keys(actProfile.links).length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Social Links</Text>
              {Object.entries(actProfile.links).map(([key, url]) => {
                if (!url) {
                  return null;
                }
                const label = SOCIAL_LINK_LABELS[key as keyof typeof SOCIAL_LINK_LABELS] ?? key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => handleOpenLink(url)}
                    style={[styles.linkButton, { backgroundColor: getSocialLinkColor(key as keyof NonNullable<ActProfile["links"]>) }]}
                  >
                    <Text style={styles.linkButtonText}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              {isOwner ? (
                <Pressable style={styles.secondaryButton} onPress={handleAddEventPress}>
                  <Text style={styles.secondaryButtonText}>Add Event</Text>
                </Pressable>
              ) : null}
            </View>

            {isEventsLoading ? (
              <ActivityIndicator />
            ) : events && events.length ? (
              <View style={styles.eventList}>
                {events.map((event) => (
                  <Pressable key={event.id} style={styles.eventCard} onPress={() => handleViewEventPress(event.id)}>
                    <View style={styles.eventHeader}>
                      <View style={styles.eventTitleGroup}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Text style={styles.eventMeta}>{formatEventDate(event.eventDate, event.hasTime)}</Text>
                      </View>
                      {isOwner ? (
                        <View style={styles.eventActions}>
                          <Pressable style={styles.eventIconButton} onPress={() => handleEditEventPress(event.id)}>
                            <Text style={styles.eventIconText}>✎</Text>
                          </Pressable>
                          <Pressable style={styles.eventIconButton} onPress={() => handleDeleteEvent(event.id)}>
                            <Text style={styles.eventIconText}>×</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                    {event.description ? (
                      <Text style={styles.sectionText}>{event.description}</Text>
                    ) : null}
                    {event.location ? (
                      <Text style={styles.sectionSubtext}>{event.location}</Text>
                    ) : null}
                    {event.ticketLink ? (
                      <Pressable
                        style={styles.ticketButton}
                        onPress={() => handleOpenLink(event.ticketLink!)}
                      >
                        <Text style={styles.ticketButtonText}>Get Tickets</Text>
                      </Pressable>
                    ) : null}
                    {event.venueMapboxId ? (
                      <Pressable
                        style={styles.ticketButton}
                        onPress={() =>
                          router.push(
                            `${VENUE_PROFILE_ROUTE}?mapboxId=${encodeURIComponent(
                              event.venueMapboxId!
                            )}` as Href
                          )
                        }
                      >
                        <Text style={styles.editButtonText}>View Venue</Text>
                      </Pressable>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.sectionSubtext}>Check back for upcoming events</Text>
            )}
          </View>

          {isOwner && (
            <Pressable style={styles.editButton} onPress={handleEditPress}>
              <Text style={styles.editButtonText}>Edit Act Profile</Text>
            </Pressable>
          )}
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
  heroImage: {
    width: "100%",
    height: 240,
    borderRadius: 18,
  },
  actName: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.primaryWhite,
  },
  category: {
    fontSize: 16,
    color: Colors.secondaryGray,
  },
  section: {
    marginTop: 12,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  linkButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  linkButtonText: {
    color: Colors.primaryWhite,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    backgroundColor: Colors.secondaryBackground,
  },
  secondaryButtonText: {
    color: Colors.primaryWhite,
    fontWeight: "700",
  },
  eventList: {
    gap: 12,
  },
  eventCard: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.background,
    gap: 6,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  eventActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eventTitleGroup: {
    gap: 2,
    flex: 1,
  },
  eventTitle: {
    color: Colors.primaryWhite,
    fontWeight: "700",
    fontSize: 16,
  },
  eventMeta: {
    color: Colors.secondaryGray,
    fontSize: 13,
  },
  eventIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.secondaryBackground,
  },
  eventIconText: {
    color: Colors.primaryWhite,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
  },
  ticketButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.action,
  },
  ticketButtonText: {
    color: Colors.secondaryBackground,
    fontWeight: "700",
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
