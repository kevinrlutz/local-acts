import { Href, useRouter } from "expo-router";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { auth } from "../src/lib/firebase";
import { getAppUserFromFirestore } from "../src/services/userProfile";

import { AppUser } from '@/src/types/auth';
import Colors from "../src/Colors";

const LOGIN_ROUTE = "/(auth)/login" as Href;
const ACCOUNT_SETUP_ROUTE = "/(auth)/account-setup" as Href;
const UPDATE_LOCATION_ROUTE = "/update-location" as Href;
const CREATE_ACT_ROUTE = "/act/create-act" as Href;
const ACT_PROFILE_ROUTE = "/act" as Href;

export default function Index() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [checkingAuth, setCheckingAuth] = useState(!auth.currentUser);
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Local Acts";
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setCheckingAuth(false);
      if (!nextUser) {
        router.replace(LOGIN_ROUTE);
      }
    });
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        try {
          const profile = await getAppUserFromFirestore(user.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          // Optionally, set a default or handle error
        }
      };
      fetchProfile();
    } else {
      setUserProfile(null);
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign out.";
      Alert.alert("Sign out failed", message);
    }
  };

  const goToSetup = () => router.push(ACCOUNT_SETUP_ROUTE);
  const goToUpdateLocation = () => router.push(UPDATE_LOCATION_ROUTE);
  const goToAct = () => {
    if (userProfile?.hasActProfile && user?.uid) {
      router.push((`${ACT_PROFILE_ROUTE}?uid=${encodeURIComponent(user.uid)}`) as Href);
      return;
    }
    router.push(CREATE_ACT_ROUTE);
  };

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
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/icon.png')}
        style={styles.logo}
        accessibilityRole="image"
        accessibilityLabel="Local Acts logo"
      />
      <Text style={styles.title}>Local Acts</Text>
      <Text style={styles.subtitle}>
        Welcome back, {user.displayName || user.email || "New Local Acts fan"}!
      </Text>

      <Text style={styles.subtitle}>
        Currently discovering acts in {userProfile?.location?.city + ', ' + userProfile?.location?.state || "Unknown"}
      </Text>

      <View style={styles.formContainer}>
        <View style={styles.actions}>
          <Pressable style={styles.tertiaryButton} onPress={goToAct}>
            <Text style={styles.tertiaryButtonText}>
              {userProfile?.hasActProfile ? "Manage Act Profile" : "Create Act Profile"}
            </Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={userProfile?.location?.rawInput ? goToUpdateLocation : goToSetup}>
            <Text style={styles.primaryButtonText}>{userProfile?.location?.rawInput ? 'Update Location' : 'Finish Profile Setup'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleSignOut}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 20,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  formContainer: {
    width: "60%",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    color: Colors.primaryWhite,
    fontWeight: "700",
  },
  subtitle: {
    color: Colors.secondaryGray,
    fontSize: 16,
  },
  actions: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.action,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
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
  secondaryButtonText: {
    color: Colors.primaryWhite,
    fontWeight: "600",
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
});
