import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initFirebase } from "../firebase/init";

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    initFirebase();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SafeAreaProvider>
  );
}
