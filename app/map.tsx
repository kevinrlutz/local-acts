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
    TextInput,
    View
} from "react-native";

import Colors from "../src/Colors";
import ActMap from "../src/components/ActMap";
import { auth } from "../src/lib/firebase";
import { getEventsWithinLocationBounds } from "../src/services/events";
import { getAppUserFromFirestore } from "../src/services/userProfile";
import type { ActCategory, ActEvent } from "../src/types/acts";
import type { AppUser } from "../src/types/auth";

const LOGIN_ROUTE = "/(auth)/login" as Href
const EVENT_PROFILE_ROUTE = "/event" as Href
const DISTANCE_OPTIONS = [5, 10, 25]
const CATEGORY_OPTIONS: ("All" | ActCategory)[] = [
  "All",
  "Musician",
  "Comedian",
  "Other",
]

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10)

const parseDateInput = (value: string, endOfDay = false): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) return null
  if (endOfDay) date.setHours(23, 59, 59, 999)
  return date
}

const getLocationBounds = (
  latitude: number,
  longitude: number,
  radiusMiles: number
) => {
  const latitudeDelta = radiusMiles / 69.172
  const longitudeDelta = radiusMiles / (69.172 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01))
  return {
    minLatitude: latitude - latitudeDelta,
    maxLatitude: latitude + latitudeDelta,
    minLongitude: longitude - longitudeDelta,
    maxLongitude: longitude + longitudeDelta,
  }
}

export default function MapScreen() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(() => auth.currentUser)
  const [checkingAuth, setCheckingAuth] = useState(!auth.currentUser)
  const [userProfile, setUserProfile] = useState<AppUser | null>(null)
  const [events, setEvents] = useState<ActEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [distanceFilter, setDistanceFilter] = useState<number>(DISTANCE_OPTIONS[1])
  const [categoryFilter, setCategoryFilter] = useState<("All" | ActCategory)[]>(["All"])
  const [startDateFilter, setStartDateFilter] = useState(() => {
    const startDate = new Date()
    return formatDateInput(startDate)
  })
  const [endDateFilter, setEndDateFilter] = useState(() => {
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 1)
    return formatDateInput(endDate)
  })
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
    if (!user || !userProfile?.location?.coordinates) {
      setEvents([])
      setEventsError(null)
      return
    }
    const { latitude, longitude } = userProfile.location.coordinates
    const startDate = parseDateInput(startDateFilter)
    const endDate = parseDateInput(endDateFilter, true)
    if (!startDate || !endDate || startDate > endDate) {
      setEvents([])
      setEventsError("Enter a valid date range.")
      return
    }
    let isCancelled = false
    setEventsLoading(true)
    setEventsError(null)
    getEventsWithinLocationBounds(
      getLocationBounds(latitude, longitude, distanceFilter),
      startDate,
      endDate
    )
      .then((nextEvents) => {
        if (!isCancelled) setEvents(nextEvents)
      })
      .catch((error) => {
        console.error("Failed to fetch events for map:", error)
        if (!isCancelled) {
          setEvents([])
          setEventsError(error instanceof Error ? error.message : "Unable to load events.")
        }
      })
      .finally(() => {
        if (!isCancelled) setEventsLoading(false)
      })
    return () => {
      isCancelled = true
    }
  }, [user, userProfile?.location?.coordinates, distanceFilter, startDateFilter, endDateFilter])

  const userCoordinates = userProfile?.location?.coordinates

  const filteredEvents = useMemo<ActEvent[]>(
    () => events.filter((event) =>
      categoryFilter.includes("All") ? true : categoryFilter.includes(event.actCategory)
    ),
    [events, categoryFilter]
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
    (eventId: string) => {
      router.push(`${EVENT_PROFILE_ROUTE}?eventId=${encodeURIComponent(eventId)}` as Href)
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
        events={filteredEvents}
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
                outputRange: [0, 450],
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
                            const next = categoryFilter.filter((currentCategory) => currentCategory !== category);
                            setCategoryFilter(next.length === 0 ? ["All"] : next);
                          } else {
                            setCategoryFilter(categoryFilter.filter((currentCategory) => currentCategory !== "All").concat(category));
                          }
                        }}
                      >
                        <Text style={[styles.filterChipText, categoryFilter.includes(category) && styles.filterChipTextActive]}>
                          {category}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Date range</Text>
                  <View style={styles.dateInputRow}>
                    <TextInput
                      accessibilityLabel="Start date"
                      value={startDateFilter}
                      onChangeText={setStartDateFilter}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors.secondaryGray}
                      style={styles.dateInput}
                    />
                    <Text style={styles.dateSeparator}>to</Text>
                    <TextInput
                      accessibilityLabel="End date"
                      value={endDateFilter}
                      onChangeText={setEndDateFilter}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors.secondaryGray}
                      style={styles.dateInput}
                    />
                  </View>
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      {eventsLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={Colors.secondaryAction} />
        </View>
      )}
      {eventsError && !eventsLoading && (
        <View style={styles.errorOverlay} pointerEvents="none">
          <Text style={styles.errorText}>{eventsError}</Text>
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
  dateInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateInput: {
    flex: 1,
    minWidth: 0,
    color: Colors.primaryWhite,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
  },
  dateSeparator: {
    color: Colors.secondaryGray,
    fontSize: 12,
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
  errorOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: "center",
  },
  errorText: {
    color: Colors.primaryWhite,
    backgroundColor: "rgba(190, 45, 45, 0.95)",
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "center",
  },
})
