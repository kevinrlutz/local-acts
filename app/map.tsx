import { Feather } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import Colors from "../src/Colors";
import ActMap from "../src/components/ActMap";
import { auth } from "../src/lib/firebase";
import { calculateDistanceMiles } from "../src/lib/geoUtils";
import { getAllActs } from "../src/services/acts";
import { getAppUserFromFirestore } from "../src/services/userProfile";
import { getVenuePinsForArea } from "../src/services/venueCategorySearch";
import { formatCategoryName } from "../src/services/venueDetailsCache";
import type { ActCategory, ActProfile } from "../src/types/acts";
import type { AppUser } from "../src/types/auth";
import type { VenuePin } from "../src/types/venues";

const LOGIN_ROUTE = "/(auth)/login" as Href
const ACT_PROFILE_ROUTE = "/act" as Href
const VENUE_PROFILE_ROUTE = "/venue" as Href
const DISTANCE_OPTIONS = [5, 10, 25]
const CATEGORY_OPTIONS: ("All" | ActCategory)[] = [
  "All",
  "Musician",
  "Comedian",
  "Other",
]

type MapMode = "acts" | "venues"
type ActWithDistance = ActProfile & { distanceInMiles: number | null }

export default function MapScreen() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(() => auth.currentUser)
  const [checkingAuth, setCheckingAuth] = useState(!auth.currentUser)
  const [userProfile, setUserProfile] = useState<AppUser | null>(null)
  const [mapMode, setMapMode] = useState<MapMode>("acts")
  const [acts, setActs] = useState<ActProfile[]>([])
  const [venues, setVenues] = useState<VenuePin[]>([])
  const [actsLoading, setActsLoading] = useState(false)
  const [venuesLoading, setVenuesLoading] = useState(false)
  const [distanceFilter, setDistanceFilter] = useState<number>(DISTANCE_OPTIONS[1])
  const [categoryFilter, setCategoryFilter] = useState<("All" | ActCategory)[]>(["All"])
  const [venueCategoryFilter, setVenueCategoryFilter] = useState<string[]>(["All"])
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Native driver handles opacity/transform; JS driver handles maxHeight (layout prop)
  const slideAnimNative = useRef(new Animated.Value(0)).current
  const slideAnimJS = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Map | Local Acts"
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setCheckingAuth(false)
      if (!nextUser) {
        router.replace(LOGIN_ROUTE)
      }
    })
    return unsubscribe
  }, [router])

  useEffect(() => {
    if (!user) {
      setUserProfile(null)
      return
    }
    const fetchProfile = async () => {
      try {
        const profile = await getAppUserFromFirestore(user.uid)
        setUserProfile(profile)
      } catch (error) {
        console.error("Failed to fetch user profile:", error)
      }
    }
    void fetchProfile()
  }, [user])

  useEffect(() => {
    if (!user) {
      setActs([])
      return
    }
    setActsLoading(true)
    const fetchActs = async () => {
      try {
        const allActs = await getAllActs()
        setActs(allActs)
      } catch (error) {
        console.error("Failed to fetch acts:", error)
      } finally {
        setActsLoading(false)
      }
    }
    void fetchActs()
  }, [user])

  useEffect(() => {
    if (!user || !userProfile?.location?.coordinates) {
      setVenues([])
      return
    }
    const { latitude, longitude } = userProfile.location.coordinates
    let isCancelled = false
    setVenuesLoading(true)
    getVenuePinsForArea({ latitude, longitude, radiusMiles: distanceFilter })
      .then((pins) => {
        if (!isCancelled) setVenues(pins)
      })
      .catch((error) => {
        console.error("Failed to fetch venue pins:", error)
        if (!isCancelled) setVenues([])
      })
      .finally(() => {
        if (!isCancelled) setVenuesLoading(false)
      })
    return () => {
      isCancelled = true
    }
  }, [user, userProfile?.location?.coordinates, distanceFilter])

  const userCoordinates = userProfile?.location?.coordinates

  const actsWithDistance = useMemo<ActWithDistance[]>(() => {
    return acts.map((act) => {
      if (userCoordinates && act.location?.coordinates) {
        const { latitude: actLat, longitude: actLon } = act.location.coordinates
        const { latitude: userLat, longitude: userLon } = userCoordinates
        return {
          ...act,
          distanceInMiles: calculateDistanceMiles(userLat, userLon, actLat, actLon),
        }
      }
      return { ...act, distanceInMiles: null }
    })
  }, [acts, userCoordinates])

  const filteredActs = useMemo<ActWithDistance[]>(() => {
    const categoryFiltered = actsWithDistance.filter((act) =>
      categoryFilter.includes("All") ? true : categoryFilter.includes(act.category)
    )
    if (!userCoordinates) {
      return categoryFiltered
    }
    return categoryFiltered.filter(
      (act) =>
        typeof act.distanceInMiles === "number" &&
        act.distanceInMiles <= distanceFilter
    )
  }, [actsWithDistance, categoryFilter, distanceFilter, userCoordinates])

  const venuesWithDistance = useMemo<VenuePin[]>(() => venues, [venues])

  const venueCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(venues.map((v) => v.category))).sort()
    return ["All", ...unique]
  }, [venues])

  const filteredVenues = useMemo<VenuePin[]>(
    () =>
      venuesWithDistance.filter((venue) =>
        venueCategoryFilter.includes("All")
          ? true
          : venueCategoryFilter.includes(venue.category)
      ),
    [venuesWithDistance, venueCategoryFilter]
  )

  const toggleFilters = () => {
    const toValue = filtersOpen ? 0 : 1
    setFiltersOpen(!filtersOpen)
    Animated.spring(slideAnimNative, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
    Animated.spring(slideAnimJS, {
      toValue,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start()
  }

  const handlePinPress = useCallback(
    (actId: string) => {
      router.push(`${ACT_PROFILE_ROUTE}?uid=${encodeURIComponent(actId)}` as Href)
    },
    [router]
  )

  const handleVenuePinPress = useCallback(
    (venueMapboxId: string) => {
      router.push(`${VENUE_PROFILE_ROUTE}?mapboxId=${encodeURIComponent(venueMapboxId)}` as Href)
    },
    [router]
  )

  if (checkingAuth) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    )
  }

  if (!user) {
    return <View style={styles.centered} />
  }

  return (
    <View style={styles.container}>
      <ActMap
        acts={mapMode === "acts" ? filteredActs : []}
        venues={mapMode === "venues" ? filteredVenues : []}
        userCoordinates={userCoordinates}
        onPinPress={handlePinPress}
        onVenuePinPress={handleVenuePinPress}
      />

      {/* Filter dropdown overlaid on top of the map */}
      <View style={styles.filterOverlay} pointerEvents="box-none">
        <View style={styles.filterCard} pointerEvents="auto">
          {/* Header row — always visible */}
          <Pressable style={styles.filterHeader} onPress={toggleFilters}>
            <Text style={styles.filterHeaderText}>Filters</Text>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: slideAnimNative.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "180deg"],
                    }),
                  },
                ],
              }}
            >
              <Feather name="chevron-down" size={18} color={Colors.primaryWhite} />
            </Animated.View>
          </Pressable>

          {/* Mode toggle — always visible */}
          <View style={styles.modeToggleRow}>
            <Pressable
              style={[styles.modeToggleButton, mapMode === "acts" && styles.modeToggleActive]}
              onPress={() => setMapMode("acts")}
            >
              <Text style={[styles.modeToggleText, mapMode === "acts" && styles.modeToggleTextActive]}>Acts</Text>
            </Pressable>
            <Pressable
              style={[styles.modeToggleButton, mapMode === "venues" && styles.modeToggleActive]}
              onPress={() => setMapMode("venues")}
            >
              <Text style={[styles.modeToggleText, mapMode === "venues" && styles.modeToggleTextActive]}>Venues</Text>
            </Pressable>
          </View>

          {/* Collapsible body - outer wrapper for maxHeight */}
          <Animated.View
            style={{
              maxHeight: slideAnimJS.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 400],
              }),
              overflow: "hidden",
            }}
          >
            {/* Inner view for opacity/transform animations */}
            <Animated.View
              style={{
                opacity: slideAnimNative,
                transform: [
                  {
                    translateY: slideAnimNative.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              }}
            >
              <View style={styles.filterBody}>
                {/* Distance row */}
                <View style={styles.filterRow}>
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
                            distanceFilter === option && styles.filterChipTextActive,
                            !userCoordinates && styles.filterChipTextDisabled,
                          ]}
                        >
                          {option} mi
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Category row — act categories are a fixed enum; venue
                    categories come live from Mapbox pins currently loaded. */}
                {mapMode === "acts" ? (
                  <View style={styles.filterRow}>
                    <Text style={styles.filterLabel}>Category</Text>
                    <View style={styles.chipRow}>
                      {CATEGORY_OPTIONS.map((category) => (
                        <Pressable
                          key={category}
                          style={[
                            styles.filterChip,
                            categoryFilter.includes(category) && styles.filterChipActive,
                          ]}
                          onPress={() => {
                            if (category === "All") {
                              setCategoryFilter(["All"]);
                            } else if (categoryFilter.includes(category)) {
                              const next = categoryFilter.filter((c) => c !== category);
                              setCategoryFilter(next.length === 0 ? ["All"] : next);
                            } else {
                              setCategoryFilter(
                                categoryFilter.filter((c) => c !== "All").concat(category)
                              );
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              categoryFilter.includes(category) && styles.filterChipTextActive,
                            ]}
                          >
                            {category}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.filterRow}>
                    <Text style={styles.filterLabel}>Category</Text>
                    <View style={styles.chipRow}>
                      {venueCategoryOptions.map((category) => (
                        <Pressable
                          key={category}
                          style={[
                            styles.filterChip,
                            venueCategoryFilter.includes(category) && styles.filterChipActive,
                          ]}
                          onPress={() => {
                            if (category === "All") {
                              setVenueCategoryFilter(["All"]);
                            } else if (venueCategoryFilter.includes(category)) {
                              const next = venueCategoryFilter.filter((c) => c !== category);
                              setVenueCategoryFilter(next.length === 0 ? ["All"] : next);
                            } else {
                              setVenueCategoryFilter(
                                venueCategoryFilter.filter((c) => c !== "All").concat(category)
                              );
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              venueCategoryFilter.includes(category) && styles.filterChipTextActive,
                            ]}
                          >
                            {category === "All" ? "All" : formatCategoryName(category)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      {(actsLoading || venuesLoading) && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={Colors.secondaryAction} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  filterOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  filterCard: {
    margin: 12,
    backgroundColor: Colors.secondaryBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    width: "75%",
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterHeaderText: {
    color: Colors.primaryWhite,
    fontWeight: "700",
    fontSize: 14,
  },
  modeToggleRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  modeToggleButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    alignItems: "center",
  },
  modeToggleActive: {
    backgroundColor: Colors.secondaryAction,
    borderColor: Colors.secondaryAction,
  },
  modeToggleText: {
    color: Colors.secondaryGray,
    fontWeight: "600",
    fontSize: 13,
  },
  modeToggleTextActive: {
    color: Colors.secondaryBackground,
  },
  filterBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  filterRow: {
    gap: 8,
  },
  filterLabel: {
    color: Colors.secondaryGray,
    fontWeight: "600",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.secondaryAction,
    borderColor: Colors.secondaryAction,
  },
  filterChipDisabled: {
    opacity: 0.4,
  },
  filterChipText: {
    color: Colors.secondaryGray,
    fontWeight: "600",
    fontSize: 13,
  },
  filterChipTextActive: {
    color: Colors.secondaryBackground,
  },
  filterChipTextDisabled: {
    color: Colors.secondaryGray,
  },
  filterHelperText: {
    color: Colors.secondaryGray,
    fontSize: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(22,23,24,0.6)",
  },
})
