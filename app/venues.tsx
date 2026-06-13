import { Feather } from "@expo/vector-icons";
import { Href, useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { getDownloadURL, ref } from "firebase/storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/src/Colors";
import { auth, storage } from "@/src/lib/firebase";
import { calculateDistanceMiles } from "@/src/lib/geoUtils";
import { getAppUserFromFirestore } from "@/src/services/userProfile";
import { getAllVenues } from "@/src/services/venues";
import type { AppUser } from "@/src/types/auth";
import type {
    VenueCategory,
    VenueProfile,
} from "@/src/types/venues";

const LOGIN_ROUTE = "/(auth)/login" as Href;
const CREATE_VENUE_ROUTE = "/venue/create-venue" as Href;
const VENUE_PROFILE_ROUTE = "/venue" as Href;

const DISTANCE_OPTIONS = [10, 25, 50, 100];
const CATEGORY_OPTIONS: ("All" | VenueCategory)[] = [
  "All",
  "Bar / Club",
  "Concert Hall",
  "Theater",
  "Restaurant",
  "Other",
];
const PAGE_SIZE = 10;

const { width: screenWidth } = Dimensions.get("window");
const isMobile = screenWidth < 768;

type VenueWithDistance = VenueProfile & { distanceInMiles: number | null };

export default function VenuesScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [checkingAuth, setCheckingAuth] = useState(!auth.currentUser);
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [venues, setVenues] = useState<VenueProfile[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [venuesError, setVenuesError] = useState<string | null>(null);
  const [venueImageUrls, setVenueImageUrls] = useState<
    Record<string, string>
  >({});
  const [distanceFilter, setDistanceFilter] = useState<number>(
    DISTANCE_OPTIONS[1]
  );
  const [categoryFilter, setCategoryFilter] = useState<"All" | VenueCategory>(
    "All"
  );
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Venues | Local Acts";
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setCheckingAuth(false);
      if (!nextUser) router.replace(LOGIN_ROUTE);
    });
    return unsubscribe;
  }, [router]);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    try {
      const profile = await getAppUserFromFirestore(user.uid);
      setUserProfile(profile);
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
  }, [user]);

  const fetchVenues = useCallback(async () => {
    if (!user) {
      setVenues([]);
      return;
    }
    setVenuesLoading(true);
    setVenuesError(null);
    try {
      const all = await getAllVenues();
      setVenues(all);
    } catch (error) {
      console.error("Failed to fetch venues:", error);
      setVenuesError("Unable to load venues right now.");
    } finally {
      setVenuesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVenues();
    fetchProfile();
  }, [fetchVenues, fetchProfile]);

  useFocusEffect(
    useCallback(() => {
      fetchVenues();
      fetchProfile();
    }, [fetchVenues, fetchProfile])
  );

  useEffect(() => {
    if (venues.length === 0) {
      setVenueImageUrls({});
      return;
    }
    const fetchUrls = async () => {
      const urls: Record<string, string> = {};
      await Promise.all(
        venues.map(async (venue) => {
          if (venue.profileImageRef) {
            try {
              const url = await getDownloadURL(
                ref(storage, venue.profileImageRef)
              );
              urls[venue.id] = url;
            } catch {
              // No image for this venue
            }
          }
        })
      );
      setVenueImageUrls(urls);
    };
    fetchUrls();
  }, [venues]);

  useEffect(() => {
    setCurrentPage(1);
  }, [distanceFilter, categoryFilter]);

  const userCoordinates = userProfile?.location?.coordinates;

  const venuesWithDistance = useMemo<VenueWithDistance[]>(() => {
    return venues.map((venue) => {
      if (userCoordinates) {
        const { latitude: vLat, longitude: vLon } = venue.coordinates;
        const { latitude: uLat, longitude: uLon } = userCoordinates;
        return {
          ...venue,
          distanceInMiles: calculateDistanceMiles(uLat, uLon, vLat, vLon),
        };
      }
      return { ...venue, distanceInMiles: null };
    });
  }, [venues, userCoordinates]);

  const filteredVenues = useMemo<VenueWithDistance[]>(() => {
    const categoryFiltered = venuesWithDistance.filter((v) =>
      categoryFilter === "All" ? true : v.category === categoryFilter
    );

    if (!userCoordinates) return categoryFiltered;

    return categoryFiltered
      .filter(
        (v) =>
          typeof v.distanceInMiles === "number" &&
          v.distanceInMiles <= distanceFilter
      )
      .sort((a, b) => {
        if (a.distanceInMiles === null) return 1;
        if (b.distanceInMiles === null) return -1;
        return a.distanceInMiles - b.distanceInMiles;
      });
  }, [venuesWithDistance, categoryFilter, distanceFilter, userCoordinates]);

  const totalPages = Math.max(1, Math.ceil(filteredVenues.length / PAGE_SIZE));
  const paginatedVenues = filteredVenues.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const advancePage = (delta: number) => {
    setCurrentPage((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > totalPages) return totalPages;
      return next;
    });
  };

  const goToVenue = () => {
    if (userProfile?.hasVenueProfile && user?.uid) {
      router.push(`/venue?uid=${encodeURIComponent(user.uid)}` as Href);
      return;
    }
    router.push("/venue/create-venue" as Href);
  };

  const renderVenueItem = useCallback(
    ({ item }: { item: VenueWithDistance }) => (
      <Pressable
        style={styles.venueCard}
        onPress={() =>
          router.push(
            `${VENUE_PROFILE_ROUTE}?uid=${encodeURIComponent(item.id)}` as Href
          )
        }
      >
        <Image
          source={
            venueImageUrls[item.id]
              ? { uri: venueImageUrls[item.id] }
              : require("@/assets/images/icon.png")
          }
          style={styles.venueImage}
          accessibilityLabel={`${item.name} profile photo`}
        />
        <View style={styles.venueContent}>
          <Text style={styles.venueName}>{item.name}</Text>
          <Text style={styles.venueMeta}>{item.category}</Text>
          <Text style={styles.venueMeta}>
            {[item.city, item.state].filter(Boolean).join(", ") ||
              item.address}
          </Text>
          {typeof item.distanceInMiles === "number" && (
            <Text style={styles.venueDistance}>
              {item.distanceInMiles.toFixed(1)} miles away
            </Text>
          )}
        </View>
      </Pressable>
    ),
    [venueImageUrls, router]
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyState}>
        {venuesLoading ? (
          <ActivityIndicator color={Colors.secondaryAction} />
        ) : (
          <Text style={styles.emptyText}>
            {userCoordinates
              ? "No venues match your current filters. Try expanding the distance or picking a different category."
              : "Add a location to start discovering venues nearby."}
          </Text>
        )}
      </View>
    ),
    [venuesLoading, userCoordinates]
  );

  if (checkingAuth) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return <View style={styles.centered} />;
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={
        Platform.OS === "web"
          ? ["top", "left", "right"]
          : ["top", "bottom", "left", "right"]
      }
    >
      <FlatList
        data={paginatedVenues}
        keyExtractor={(item) => item.id}
        renderItem={renderVenueItem}
        ListEmptyComponent={renderEmpty}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Venues</Text>
            <Text style={styles.subtitle}>
              Discover live music and entertainment spaces near you.
            </Text>
            <Pressable style={styles.myVenueButton} onPress={goToVenue}>
              <Text style={styles.myVenueButtonText}>
                {userProfile?.hasVenueProfile
                  ? "Manage My Venue"
                  : "Create Venue Profile"}
              </Text>
            </Pressable>
            <View style={styles.filtersWrapper}>
              <View style={styles.filterColumn}>
                <Text style={styles.filterLabel}>Distance</Text>
                <View style={styles.chipRow}>
                  {DISTANCE_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      style={[
                        styles.filterChip,
                        distanceFilter === option && styles.filterChipActive,
                        !userCoordinates && styles.filterChipDisabled,
                      ]}
                      disabled={!userCoordinates}
                      onPress={() => setDistanceFilter(option)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          distanceFilter === option &&
                            styles.filterChipTextActive,
                          !userCoordinates && styles.filterChipTextDisabled,
                        ]}
                      >
                        {option} mi
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.filterColumn}>
                <Text style={styles.filterLabel}>Category</Text>
                <View style={styles.chipRow}>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <Pressable
                      key={cat}
                      style={[
                        styles.filterChip,
                        categoryFilter === cat && styles.filterChipActive,
                      ]}
                      onPress={() => setCategoryFilter(cat)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          categoryFilter === cat && styles.filterChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            {venuesError && (
              <Text style={styles.errorText}>{venuesError}</Text>
            )}
          </View>
        }
        ListFooterComponent={
          filteredVenues.length > 0 ? (
            <View style={styles.footerContainer}>
              <View style={styles.pagination}>
                <Pressable
                  style={[
                    styles.paginationButton,
                    currentPage === 1 && styles.paginationButtonDisabled,
                  ]}
                  disabled={currentPage === 1}
                  onPress={() => advancePage(-1)}
                >
                  <Text style={styles.paginationButtonText}>Previous</Text>
                </Pressable>
                <Text style={styles.pageIndicator}>
                  Page {currentPage} / {totalPages}
                </Text>
                <Pressable
                  style={[
                    styles.paginationButton,
                    currentPage === totalPages &&
                      styles.paginationButtonDisabled,
                  ]}
                  disabled={currentPage === totalPages}
                  onPress={() => advancePage(1)}
                >
                  <Text style={styles.paginationButtonText}>Next</Text>
                </Pressable>
              </View>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        style={styles.venuesList}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  headerContainer: { alignItems: "center", gap: 16 },
  footerContainer: { paddingTop: 16, alignItems: "center" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  title: { fontSize: 24, color: Colors.primaryWhite, fontWeight: "700" },
  subtitle: {
    color: Colors.secondaryGray,
    fontSize: 16,
    textAlign: "center",
  },
  myVenueButton: {
    backgroundColor: Colors.action,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    width: "90%",
    maxWidth: 360,
  },
  myVenueButtonText: {
    color: Colors.secondaryBackground,
    fontWeight: "700",
  },
  filtersWrapper: { width: "100%", gap: 20 },
  filterColumn: { gap: 8 },
  filterLabel: { color: Colors.primaryWhite, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.secondaryAction,
    borderColor: Colors.secondaryAction,
  },
  filterChipDisabled: { opacity: 0.4 },
  filterChipText: { color: Colors.secondaryGray, fontWeight: "600" },
  filterChipTextActive: { color: Colors.secondaryBackground },
  filterChipTextDisabled: { color: Colors.secondaryGray },
  venuesList: {
    width: isMobile ? "100%" : "60%",
    alignSelf: "center",
  },
  listContent: { gap: 12, paddingBottom: 12 },
  venueCard: {
    backgroundColor: Colors.secondaryBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    padding: 16,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  venueImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: Colors.contentBorder,
  },
  venueContent: { flex: 1, gap: 4 },
  venueName: { color: Colors.primaryWhite, fontSize: 18, fontWeight: "700" },
  venueMeta: { color: Colors.secondaryGray },
  venueDistance: { color: Colors.successGreen, fontWeight: "600" },
  emptyState: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: Colors.secondaryGray, textAlign: "center" },
  pagination: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  paginationButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  paginationButtonDisabled: { opacity: 0.4 },
  paginationButtonText: { color: Colors.primaryWhite, fontWeight: "600" },
  pageIndicator: {
    color: Colors.secondaryGray,
    fontWeight: "600",
    textAlign: "center",
    minWidth: 120,
  },
  errorText: { color: Colors.appleMusic, textAlign: "center" },
});
