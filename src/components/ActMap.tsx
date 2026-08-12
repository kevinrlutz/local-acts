import Mapbox, { Camera, CircleLayer, MapView, ShapeSource } from "@rnmapbox/maps";
import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import Colors from "../Colors";
import type { ActEvent } from "../types/acts";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "")

const DEFAULT_CENTER: [number, number] = [-98.35, 39.5]
const DEFAULT_ZOOM = 4

export type EventMapProps = {
  events: ActEvent[]
  userCoordinates?: { latitude: number; longitude: number } | null
  onPinPress: (eventId: string) => void
}

export default function ActMap({ events, userCoordinates, onPinPress }: EventMapProps) {
  const centerCoordinate: [number, number] = userCoordinates
    ? [userCoordinates.longitude, userCoordinates.latitude]
    : DEFAULT_CENTER
  const zoom = userCoordinates ? 10 : DEFAULT_ZOOM

  const eventsGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: events
        .filter((event) => event.venueCoordinates)
        .map((event) => ({
          type: "Feature" as const,
          id: event.id,
          geometry: {
            type: "Point" as const,
            coordinates: [
              event.venueCoordinates!.longitude,
              event.venueCoordinates!.latitude,
            ] as [number, number],
          },
          properties: { id: event.id, name: event.title },
        })),
    }),
    [events]
  )

  const handleEventPress = (e: {
    features?: { properties?: Record<string, unknown> | null }[]
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
      {events.length > 0 && (
        <ShapeSource id="events-source" shape={eventsGeoJson} onPress={handleEventPress}>
          <CircleLayer
            id="events-circles"
            style={{
              circleColor: Colors.action,
              circleRadius: 10,
              circleStrokeWidth: 2,
              circleStrokeColor: Colors.primaryWhite,
            }}
          />
        </ShapeSource>
      )}
    </MapView>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
})
