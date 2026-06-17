import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { getDownloadURL, ref } from "firebase/storage";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/src/Colors";
import { auth, storage } from "@/src/lib/firebase";
import { getVenueProfileById } from "@/src/services/venues";
import {
    DayHours,
    DayOfWeek,
    DAYS_OF_WEEK,
    VenueProfile,
} from "@/src/types/venues";

const EDIT_VENUE_ROUTE = "/venue/edit-venue" as Href;

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const formatHours = (day: DayHours): string => {
  if (day.closed) return "Closed";
  if (!day.open || !day.close) return "Hours not set";
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const period = h < 12 ? "AM" : "PM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  };
  return `${fmt(day.open)} – ${fmt(day.close)}`;
};

export default function VenueProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uid?: string | string[] }>();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [isCheckingAuth, setIsCheckingAuth] = useState(!auth.currentUser);
  const [venueProfile, setVenueProfile] = useState<VenueProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

  const venueUid = useMemo(() => {
    const rawUid = params.uid;
    if (!rawUid) return undefined;
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
    const fetchVenueProfile = async () => {
      if (!venueUid) {
        setError("Missing venue identifier.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        const profile = await getVenueProfileById(venueUid);
        if (isMounted) {
          setVenueProfile(profile);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to load venue profile.";
        if (isMounted) {
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchVenueProfile();
    return () => {
      isMounted = false;
    };
  }, [venueUid]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = venueProfile?.name
        ? `${venueProfile.name} • Local Acts`
        : "Venue Profile";
      return () => {
        document.title = "Local Acts";
      };
    }
  }, [venueProfile?.name]);

  useEffect(() => {
    if (venueProfile?.profileImageRef) {
      getDownloadURL(ref(storage, venueProfile.profileImageRef))
        .then(setImageUrl)
        .catch(() => setImageUrl(undefined));
    } else {
      setImageUrl(undefined);
    }
  }, [venueProfile?.profileImageRef]);

  const isOwner =
    user && venueProfile && user.uid === venueProfile.ownerUid;

  if (isCheckingAuth || isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.secondaryAction} />
      </View>
    );
  }

  if (error || !venueProfile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Venue not found."}</Text>
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
          {/* Hero image */}
          <Image
            source={
              imageUrl
                ? { uri: imageUrl }
                : require("@/assets/images/icon.png")
            }
            style={styles.heroImage}
            accessibilityLabel={`${venueProfile.name} profile photo`}
          />

          {/* Name & category */}
          <View>
            <Text style={styles.venueName}>{venueProfile.name}</Text>
            <Text style={styles.venueCategory}>{venueProfile.categories.join(", ")}</Text>
          </View>

          {/* Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Address</Text>
            <Text style={styles.sectionText}>{venueProfile.address}</Text>
            <Text style={styles.sectionSubtext}>
              {[venueProfile.city, venueProfile.state, venueProfile.zip]
                .filter(Boolean)
                .join(", ")}
            </Text>
          </View>

          {/* Hours */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hours</Text>
            {DAYS_OF_WEEK.map((day) => (
              <View key={day} style={styles.hoursRow}>
                <Text style={styles.hoursDay}>{DAY_LABELS[day]}</Text>
                <Text
                  style={[
                    styles.hoursValue,
                    venueProfile.hours[day].closed && styles.hoursClosed,
                  ]}
                >
                  {formatHours(venueProfile.hours[day])}
                </Text>
              </View>
            ))}
          </View>

          {/* Owner actions */}
          {isOwner && (
            <Pressable
              style={styles.editButton}
              onPress={() =>
                router.push(
                  `${EDIT_VENUE_ROUTE}?uid=${encodeURIComponent(venueProfile.id)}` as Href
                )
              }
            >
              <Text style={styles.editButtonText}>Edit Venue Profile</Text>
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
  heroImage: {
    width: "100%",
    height: 240,
    borderRadius: 18,
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
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.contentBorder,
  },
  hoursDay: {
    color: Colors.primaryWhite,
    fontWeight: "600",
    width: 100,
  },
  hoursValue: {
    color: Colors.primaryWhite,
    flex: 1,
    textAlign: "right",
  },
  hoursClosed: {
    color: Colors.secondaryGray,
    fontStyle: "italic",
  },
  editButton: {
    backgroundColor: Colors.action,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  editButtonText: {
    color: Colors.secondaryBackground,
    fontWeight: "700",
    fontSize: 15,
  },
  backButton: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    paddingVertical: 12,
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
