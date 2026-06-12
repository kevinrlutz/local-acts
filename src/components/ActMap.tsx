import Mapbox, { Camera, CircleLayer, MapView, ShapeSource } from "@rnmapbox/maps";
import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import Colors from "../Colors";
import type { ActProfile } from "../types/acts";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "")

const DEFAULT_CENTER: [number, number] = [-98.35, 39.5]
const DEFAULT_ZOOM = 4

export type ActMapProps = {
  acts: ActProfile[]
  userCoordinates?: { latitude: number; longitude: number } | null
  onPinPress: (actId: string) => void
}

export default function ActMap({ acts, userCoordinates, onPinPress }: ActMapProps) {
  const centerCoordinate: [number, number] = userCoordinates
    ? [userCoordinates.longitude, userCoordinates.latitude]
    : DEFAULT_CENTER
  const zoom = userCoordinates ? 10 : DEFAULT_ZOOM

  const geoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: acts
        .filter((act) => act.location?.coordinates)
        .map((act) => ({
          type: "Feature" as const,
          id: act.id,
          geometry: {
            type: "Point" as const,
            coordinates: [
              act.location.coordinates.longitude,
              act.location.coordinates.latitude,
            ] as [number, number],
          },
          properties: { id: act.id, name: act.name },
        })),
    }),
    [acts]
  )

  const handlePress = (e: {
    features?: Array<{ properties?: Record<string, unknown> }>
  }) => {
    const id = e.features?.[0]?.properties?.id
    if (typeof id === "string") {
      onPinPress(id)
    }
  }

  return (
    <MapView style={styles.map}>
      <Camera
        centerCoordinate={centerCoordinate}
        zoomLevel={zoom}
        animationMode="none"
      />
      <ShapeSource id="acts-source" shape={geoJson} onPress={handlePress}>
        <CircleLayer
          id="acts-circles"
          style={{
            circleColor: Colors.secondaryAction,
            circleRadius: 10,
            circleStrokeWidth: 2,
            circleStrokeColor: Colors.primaryWhite,
          }}
        />
      </ShapeSource>
    </MapView>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
})
