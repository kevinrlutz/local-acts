import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import Colors from "@/src/Colors";
import { auth, storage } from "@/src/lib/firebase";
import { getActProfileById } from "@/src/services/acts";
import type { ActProfile } from "@/src/types/acts";
import { getDownloadURL, ref } from "firebase/storage";

const CREATE_ACT_ROUTE = "/act/create-act" as Href;

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

  const handleEditPress = () => router.push(CREATE_ACT_ROUTE);

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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Image source={{ uri: imageUrl }} style={styles.heroImage} />
          <Text style={styles.actName}>{actProfile.name}</Text>
          <Text style={styles.category}>{actProfile.category}</Text>

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
    padding: 24,
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
