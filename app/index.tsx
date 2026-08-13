import { Feather } from "@expo/vector-icons";
import { Href, useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getDownloadURL, ref } from "firebase/storage";
import StageLights from "../src/components/StageLights";
import { auth, storage } from "../src/lib/firebase";
import { getAllActs } from "../src/services/acts";
import {
  getAppUserFromFirestore,
  updateStageLightsPreference,
} from "../src/services/userProfile";

import { formatCategoryName } from '@/src/services/venueDetailsCache';
import type { ActCategory, ActProfile } from "@/src/types/acts";
import { AppUser } from "@/src/types/auth";
import Colors from "../src/Colors";

const LOGIN_ROUTE = "/(auth)/login" as Href
const ACCOUNT_SETUP_ROUTE = "/(auth)/account-setup" as Href
const UPDATE_LOCATION_ROUTE = "/update-location" as Href
const CREATE_ACT_ROUTE = "/act/create-act" as Href
const ACT_PROFILE_ROUTE = "/act" as Href
const MAP_ROUTE = "/map" as Href
const PAGE_SIZE = 10
const DISTANCE_OPTIONS = [5, 10, 25]
const ACT_CATEGORY_OPTIONS: ("All" | ActCategory)[] = [
  "All",
  "Musician",
  "Comedian",
  "Other",
]
const DESCRIPTION_PREVIEW_MAX_LENGTH = 60

const {width: screenWidth} = Dimensions.get("window")
const isMobile = screenWidth < 768

type ActWithDistance = ActProfile & {distanceInMiles: number | null}

const EARTH_RADIUS_MILES = 3958.8

const toRadians = (value: number) => (value * Math.PI) / 180

const calculateDistanceMiles = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_MILES * c
}

const formatActLocation = (act: ActProfile) => {
  const city = act.location?.city
  const state = act.location?.state
  if (city && state) {
    return `${city}, ${state}`
  }
  return act.location?.formattedAddress ?? "Location unavailable"
}

const formatActDescriptionPreview = (description?: string | null) => {
  if (!description) {
    return null
  }
  const trimmed = description.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length <= DESCRIPTION_PREVIEW_MAX_LENGTH) {
    return trimmed
  }
  return `${trimmed.slice(0, DESCRIPTION_PREVIEW_MAX_LENGTH).trimEnd()}...`
}

export default function Index() {
  const router = useRouter()
  const {width: viewportWidth} = useWindowDimensions()
  const isMobileViewport = viewportWidth < 768
  const [user, setUser] = useState<User | null>(() => auth.currentUser)
  const [checkingAuth, setCheckingAuth] = useState(!auth.currentUser)
  const [userProfile, setUserProfile] = useState<AppUser | null>(null)

  const [acts, setActs] = useState<ActProfile[]>([])
  const [actsLoading, setActsLoading] = useState(false)
  const [actsError, setActsError] = useState<string | null>(null)
  const [actImageUrls, setActImageUrls] = useState<Record<string, string>>({})

  const [distanceFilter, setDistanceFilter] = useState<number>(
    DISTANCE_OPTIONS[1]
  )
  const [categoryFilter, setCategoryFilter] = useState<string[]>(
    ["All"]
  )
  const [currentPage, setCurrentPage] = useState(1)
  const [isMenuVisible, setIsMenuVisible] = useState(false)
  const [stageLightsEnabled, setStageLightsEnabled] = useState(false)
  const stageLightsInitialized = useRef(false)

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Local Acts"
    }
  }, [])

  useEffect(() => {
    if (userProfile !== null && !stageLightsInitialized.current) {
      stageLightsInitialized.current = true
      setStageLightsEnabled(userProfile.stageLightsEnabled ?? true)
    }
  }, [userProfile])

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
    if (user) {
      const fetchProfile = async () => {
        try {
          const profile = await getAppUserFromFirestore(user.uid)
          setUserProfile(profile)
        } catch (error) {
          console.error("Failed to fetch user profile:", error)
          // Optionally, set a default or handle error
        }
      }
      fetchProfile()
    } else {
      setUserProfile(null)
    }
  }, [user])

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setUserProfile(null)
      return
    }
    try {
      const profile = await getAppUserFromFirestore(user.uid)
      setUserProfile(profile)
    } catch (error) {
      console.error("Failed to fetch user profile:", error)
      // Optionally, set a default or handle error
    }
  }, [user])

  const fetchActs = useCallback(async () => {
    if (!user) {
      setActs([])
      return
    }
    setActsLoading(true)
    setActsError(null)
    try {
      const allActs = await getAllActs()
      setActs(allActs)

      const urls: Record<string, string> = {}
      await Promise.all(
        allActs.map(async (act) => {
          if (act.profileImageRef) {
            try {
              const url = await getDownloadURL(
                ref(storage, act.profileImageRef)
              )
              urls[act.id] = url
            } catch (error) {
              console.error(
                `Failed to fetch image URL for act ${act.id}:`,
                error
              )
            }
          }
        })
      )
      setActImageUrls(urls)
    } catch (error) {
      console.error("Failed to fetch acts:", error)
      setActsError("Unable to load acts right now.")
    } finally {
      setActsLoading(false)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      fetchActs()
      fetchProfile()
    }, [fetchActs, fetchProfile])
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [distanceFilter, categoryFilter])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign out."
      Alert.alert("Sign out failed", message)
    }
  }

  const goToSetup = () => router.push(ACCOUNT_SETUP_ROUTE)
  const goToUpdateLocation = () => router.push(UPDATE_LOCATION_ROUTE)
  const goToAct = () => {
    if (userProfile?.hasActProfile && user?.uid) {
      router.push(
        `${ACT_PROFILE_ROUTE}?uid=${encodeURIComponent(user.uid)}` as Href
      )
      return
    }
    router.push(CREATE_ACT_ROUTE)
  }

  const goToVenue = () => {
    router.push("/venues" as Href)
  }

  const userCoordinates = userProfile?.location?.coordinates

  const actsWithDistance = useMemo<ActWithDistance[]>(() => {
    return acts.map((act) => {
      if (userCoordinates && act.location?.coordinates) {
        const {latitude: actLat, longitude: actLon} = act.location.coordinates
        const {latitude: userLat, longitude: userLon} = userCoordinates
        const distance = calculateDistanceMiles(
          userLat,
          userLon,
          actLat,
          actLon
        )
        return {...act, distanceInMiles: distance}
      }
      return {...act, distanceInMiles: null}
    })
  }, [acts, userCoordinates])

  const filteredActs = useMemo(() => {
    const categoryFiltered = actsWithDistance.filter((act) =>
      categoryFilter.includes("All") ? true : categoryFilter.includes(act.category)
    )

    if (!userCoordinates) {
      return categoryFiltered
    }

    return categoryFiltered
      .filter(
        (act) =>
          typeof act.distanceInMiles === "number" &&
          act.distanceInMiles <= distanceFilter
      )
      .sort((a, b) => {
        if (a.distanceInMiles === null) {
          return 1
        }
        if (b.distanceInMiles === null) {
          return -1
        }
        return a.distanceInMiles - b.distanceInMiles
      })
  }, [actsWithDistance, categoryFilter, distanceFilter, userCoordinates])

  const totalPages = Math.max(1, Math.ceil(filteredActs.length / PAGE_SIZE))
  const paginatedList = filteredActs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const renderActItem = useCallback(
    ({item}: {item: ActWithDistance}) => {
      const descriptionPreview = formatActDescriptionPreview(item.description)
      return (
        <Pressable
          style={styles.card}
          onPress={() =>
            router.push(
              `${ACT_PROFILE_ROUTE}?uid=${encodeURIComponent(item.id)}` as Href
            )
          }
        >
          <Image
            source={
              actImageUrls[item.id]
                ? {uri: actImageUrls[item.id]}
                : require("@/assets/images/icon.png")
            }
            style={styles.itemImage}
            accessibilityLabel={`${item.name} profile photo`}
          />
          <View style={styles.itemContent}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>{formatCategoryName(item.category)}</Text>
            <Text style={styles.itemMeta}>{formatActLocation(item)}</Text>
            {descriptionPreview ? (
              <Text style={styles.itemDescription}>{descriptionPreview}</Text>
            ) : null}
            {typeof item.distanceInMiles === "number" && (
              <Text style={styles.itemDistance}>
                {item.distanceInMiles.toFixed(1)} miles away
              </Text>
            )}
          </View>
        </Pressable>
      )
    },
    [actImageUrls, router]
  )

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyState}>
        {actsLoading ? (
          <ActivityIndicator color={Colors.secondaryAction} />
        ) : (
          <Text style={styles.emptyText}>
            {userCoordinates
              ? "No acts match your current filters. Try expanding the distance or picking a different category."
              : "Add a location to start discovering acts nearby."}
          </Text>
        )}
      </View>
    ),
    [actsLoading, userCoordinates]
  )

  const advancePage = (delta: number) => {
    setCurrentPage((prev) => {
      const next = prev + delta
      if (next < 1) {
        return 1
      }
      if (next > totalPages) {
        return totalPages
      }
      return next
    })
  }

  const closeMenu = () => setIsMenuVisible(false)
  const openMenu = () => setIsMenuVisible(true)

  const handleMenuActPress = () => {
    closeMenu()
    goToAct()
  }

  const handleMenuSignOut = () => {
    closeMenu()
    void handleSignOut()
  }

  const handleMenuToggleStageLights = () => {
    closeMenu()
    const newValue = !stageLightsEnabled
    setStageLightsEnabled(newValue)
    if (user?.uid) {
      void updateStageLightsPreference(user.uid, newValue)
    }
  }

  const locationSummary = userProfile?.location
    ? `${userProfile.location.city ?? userProfile.location.formattedAddress ?? "Unknown"}${
        userProfile.location.state ? `, ${userProfile.location.state}` : ""
      }`
    : "Unknown"

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
    <SafeAreaView
      style={styles.container}
      edges={
        Platform.OS === "web"
          ? ["top", "left", "right"]
          : ["top", "bottom", "left", "right"]
      }
    >
      {stageLightsEnabled && <StageLights />}
      <FlatList<any>
        data={paginatedList}
        keyExtractor={(item) => item.id}
        renderItem={renderActItem}
        ListEmptyComponent={renderEmpty}
        ListHeaderComponent={
          <View
            style={[
              styles.headerContainer,
              isMobileViewport && styles.mobileHeaderContainer,
            ]}
          >
            <View
              style={[
                styles.menuWrapper,
                isMobileViewport && styles.mobileMenuWrapper,
              ]}
            >
              <Pressable
                style={styles.menuButton}
                accessibilityRole="button"
                accessibilityLabel="Open account menu"
                onPress={openMenu}
              >
                <Feather name="menu" size={24} color={Colors.primaryWhite} />
              </Pressable>
            </View>
            {isMobileViewport ? (
              <View style={styles.mobileBrand}>
                <Image
                  source={require("@/assets/images/icon.png")}
                  style={styles.mobileLogo}
                  accessibilityRole="image"
                  accessibilityLabel="Local Acts logo"
                />
                <Text style={styles.mobileTitle}>Local Acts</Text>
              </View>
            ) : (
              <>
                <Image
                  source={require("@/assets/images/icon.png")}
                  style={styles.logo}
                  accessibilityRole="image"
                  accessibilityLabel="Local Acts logo"
                />
                <Text style={styles.title}>Local Acts</Text>
              </>
            )}
            <Text style={styles.subtitle}>
              Welcome back,{" "}
              {user.displayName || user.email || "New Local Acts fan"}!
            </Text>
            <Text style={styles.subtitle}>
              Currently discovering acts in {locationSummary}
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={
                userProfile?.location?.rawInput ? goToUpdateLocation : goToSetup
              }
            >
              <Text style={styles.primaryButtonText}>
                {userProfile?.location?.rawInput
                  ? "Update Location"
                  : "Finish Profile Setup"}
              </Text>
            </Pressable>

            <View style={styles.secondaryButtonRow}>
              <Pressable
                style={styles.halfButton}
                onPress={() => router.push(MAP_ROUTE)}
              >
                <Text style={styles.secondaryButtonText}>Map View</Text>
              </Pressable>
              <Pressable
                style={styles.halfButton}
                onPress={goToVenue}
              >
                <Text style={styles.secondaryButtonText}>
                  {"Browse Venues"}
                </Text>
              </Pressable>
            </View>
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
                  {ACT_CATEGORY_OPTIONS.map((category) => (
                    <Pressable
                      key={category}
                      style={[
                        styles.filterChip,
                        categoryFilter.includes(category) && styles.filterChipActive,
                      ]}
                      onPress={() => {
                        if (category === "All") {
                          setCategoryFilter(["All"])
                        } else if (categoryFilter.includes(category)) {
                          const next = categoryFilter.filter((c) => c !== category)
                          setCategoryFilter(next.length === 0 ? ["All"] : next)
                        } else {
                          setCategoryFilter(
                            categoryFilter.filter((c) => c !== "All").concat(category)
                          )
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          categoryFilter.includes(category) &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        {formatCategoryName(category)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            {actsError && <Text style={styles.errorText}>{actsError}</Text>}
          </View>
        }
        ListFooterComponent={
          filteredActs.length > 0 ? (
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
        style={styles.listWrapper}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={isMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <View style={[styles.menuBackdrop, Platform.OS !== 'web' && {paddingTop: 80}]}>
          <Pressable style={styles.menuScrim} onPress={closeMenu} />
          <View style={styles.menuCard}>
            <Text style={styles.menuHeader}>{user.displayName || user.email}</Text>
            <Pressable style={styles.menuAction} onPress={handleMenuActPress}>
              <Text style={styles.menuActionText}>
                {userProfile?.hasActProfile
                  ? "Manage Act Profile"
                  : "Create Act Profile"}
              </Text>
            </Pressable>
            {Platform.OS === 'web' && (
              <Pressable
                style={styles.menuAction}
                onPress={handleMenuToggleStageLights}
              >
                <Text style={styles.menuActionText}>
                  {stageLightsEnabled
                    ? "Turn Off Stage Lights"
                    : "Turn On Stage Lights"}
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.menuAction} onPress={handleMenuSignOut}>
              <Text style={styles.menuActionText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  headerContainer: {
    alignItems: "center",
    gap: 16,
  },
  mobileHeaderContainer: {
    width: "100%",
    position: "relative",
  },
  footerContainer: {
    paddingTop: 16,
    alignItems: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  formContainer: {
    width: "100%",
    maxWidth: 960,
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 24,
    color: Colors.primaryWhite,
    fontWeight: "700",
  },
  subtitle: {
    color: Colors.secondaryGray,
    fontSize: 16,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: Colors.action,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    width: "90%",
    maxWidth: 360,
  },
  tertiaryButton: {
    backgroundColor: Colors.secondaryAction,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: Colors.secondaryBackground,
    fontWeight: "700",
  },
  tertiaryButtonText: {
    color: Colors.secondaryBackground,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonRow: {
    flexDirection: "row",
    gap: 12,
    width: "90%",
    maxWidth: 360,
  },
  halfButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  mapButton: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    width: "90%",
    maxWidth: 360,
  },
  secondaryButtonText: {
    color: Colors.primaryWhite,
    fontWeight: "600",
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  mobileBrand: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  mobileLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  mobileTitle: {
    color: Colors.primaryWhite,
    fontSize: 20,
    fontWeight: "700",
  },
  menuWrapper: {
    width: "100%",
    alignItems: "flex-end",
  },
  mobileMenuWrapper: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "auto",
    zIndex: 1,
  },
  menuButton: {
    marginTop: 8,
    padding: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
  },
  filtersWrapper: {
    width: "100%",
    gap: 20,
  },
  filterColumn: {
    gap: 8,
  },
  filterLabel: {
    color: Colors.primaryWhite,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
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
  filterChipDisabled: {
    opacity: 0.4,
  },
  filterChipText: {
    color: Colors.secondaryGray,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: Colors.secondaryBackground,
  },
  filterChipTextDisabled: {
    color: Colors.secondaryGray,
  },
  actsList: {
    width: isMobile ? "100%" : "60%",
    alignSelf: "center",
  },
  listWrapper: {
    width: isMobile ? "100%" : "60%",
    alignSelf: "center",
  },
  listContent: {
    gap: 12,
    paddingBottom: 12,
  },
  actCard: {
    backgroundColor: Colors.secondaryBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    padding: 16,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  card: {
    backgroundColor: Colors.secondaryBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    padding: 16,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  actImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: Colors.contentBorder,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: Colors.contentBorder,
  },
  actContent: {
    flex: 1,
    gap: 4,
  },
  itemContent: {
    flex: 1,
    gap: 4,
  },
  actName: {
    color: Colors.primaryWhite,
    fontSize: 18,
    fontWeight: "700",
  },
  itemName: {
    color: Colors.primaryWhite,
    fontSize: 18,
    fontWeight: "700",
  },
  actMeta: {
    color: Colors.secondaryGray,
  },
  itemMeta: {
    color: Colors.secondaryGray,
  },
  actDescription: {
    color: Colors.primaryWhite,
    fontSize: 13,
  },
  itemDescription: {
    color: Colors.primaryWhite,
    fontSize: 13,
  },
  actDistance: {
    color: Colors.successGreen,
    fontWeight: "600",
  },
  itemDistance: {
    color: Colors.successGreen,
    fontWeight: "600",
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: Colors.secondaryGray,
    textAlign: "center",
  },
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
  paginationButtonDisabled: {
    opacity: 0.4,
  },
  paginationButtonText: {
    color: Colors.primaryWhite,
    fontWeight: "600",
  },
  pageIndicator: {
    color: Colors.secondaryGray,
    fontWeight: "600",
    textAlign: "center",
    minWidth: 120,
  },
  errorText: {
    color: Colors.appleMusic,
    textAlign: "center",
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    padding: 24,
  },
  menuScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  menuCard: {
    backgroundColor: Colors.secondaryBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    width: 240,
    gap: 12,
  },
  menuHeader: {
    color: Colors.secondaryGray,
    fontWeight: "600",
  },
  menuAction: {
    paddingVertical: 8,
  },
  menuActionText: {
    color: Colors.primaryWhite,
    fontWeight: "600",
  },
})
