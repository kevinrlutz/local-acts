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
import type { ActCategory, ActProfile } from "../src/types/acts";
import type { AppUser } from "../src/types/auth";

const LOGIN_ROUTE = "/(auth)/login" as Href
const ACT_PROFILE_ROUTE = "/act" as Href
const DISTANCE_OPTIONS = [10, 25, 50, 100]
const CATEGORY_OPTIONS: ("All" | ActCategory)[] = [
  "All",
  "Musician",
  "Comedian",
  "Other",
]

type ActWithDistance = ActProfile & { distanceInMiles: number | null }

export default function MapScreen() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(() => auth.currentUser)
  const [checkingAuth, setCheckingAuth] = useState(!auth.currentUser)
  const [userProfile, setUserProfile] = useState<AppUser | null>(null)
  const [acts, setActs] = useState<ActProfile[]>([])
  const [actsLoading, setActsLoading] = useState(false)
  const [distanceFilter, setDistanceFilter] = useState<number>(DISTANCE_OPTIONS[1])
  const [categoryFilter, setCategoryFilter] = useState<"All" | ActCategory>("All")
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
      categoryFilter === "All" ? true : act.category === categoryFilter
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
        acts={filteredActs}
        userCoordinates={userCoordinates}
        onPinPress={handlePinPress}
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

          {/* Collapsible body - outer wrapper for maxHeight */}
          <Animated.View
            style={{
              maxHeight: slideAnimJS.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 200],
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

                {/* Category row */}
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Category</Text>
                  <View style={styles.chipRow}>
                    {CATEGORY_OPTIONS.map((category) => (
                      <Pressable
                        key={category}
                        style={[
                          styles.filterChip,
                          categoryFilter === category && styles.filterChipActive,
                        ]}
                        onPress={() => setCategoryFilter(category)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            categoryFilter === category && styles.filterChipTextActive,
                          ]}
                        >
                          {category}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      {actsLoading && (
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
    width: "50%",
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(22,23,24,0.6)",
  },
})
