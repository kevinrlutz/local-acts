import { onAuthStateChanged, User } from "firebase/auth";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { getFirebaseAuth } from "../firebase/init";
import { useAuthStore } from "../store/useAuthStore";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s: { setUser: any; }) => s.setUser);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setUser({ uid: user.uid, name: user.displayName || undefined });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [setUser]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
}
