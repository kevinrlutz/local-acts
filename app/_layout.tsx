import { Stack } from "expo-router";
import React from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Colors from "../src/Colors";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={{flex: 1}}>
        <Stack
          screenOptions={{
            headerStyle: {backgroundColor: Colors.background},
            headerTintColor: Colors.primaryWhite,
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="act"
            options={{
              title: "Act Profile",
            }}
          />
          <Stack.Screen
            name="venue"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="update-location"
            options={{
              title: "Update Location",
            }}
          />
          <Stack.Screen
            name="map"
            options={{
              title: "Map View",
            }}
          />
          <Stack.Screen
            name="venues"
            options={{
              title: "Venues",
            }}
          />
        </Stack>
      </View>
    </SafeAreaProvider>
  )
}
