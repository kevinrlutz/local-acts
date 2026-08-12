import React, { useEffect, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl";
import type { EventMapProps } from "./ActMap";

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? ""
const DEFAULT_VIEW_STATE = { longitude: -98.35, latitude: 39.5, zoom: 4 }

type ViewState = { longitude: number; latitude: number; zoom: number }

export default function ActMap({ events, userCoordinates, onPinPress }: EventMapProps) {
  const [viewState, setViewState] = useState<ViewState>(() =>
    userCoordinates
      ? { longitude: userCoordinates.longitude, latitude: userCoordinates.latitude, zoom: 10 }
      : DEFAULT_VIEW_STATE
  )

  useEffect(() => {
    if (userCoordinates?.longitude != null && userCoordinates?.latitude != null) {
      setViewState({
        longitude: userCoordinates.longitude,
        latitude: userCoordinates.latitude,
        zoom: 10,
      })
    }
  }, [userCoordinates?.latitude, userCoordinates?.longitude])

  // Inject mapbox-gl CSS dynamically since Metro does not bundle CSS files
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById("mapbox-gl-css")) return
    const link = document.createElement("link")
    link.id = "mapbox-gl-css"
    link.rel = "stylesheet"
    link.href = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css"
    document.head.appendChild(link)
  }, [])

  return (
    <Map
      mapboxAccessToken={TOKEN}
      {...viewState}
      onMove={(evt) => setViewState(evt.viewState)}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
    >
      <NavigationControl position="top-left" />
      {events
        .filter((event) => event.venueCoordinates)
        .map((event) => (
          <Marker
            key={event.id}
            longitude={event.venueCoordinates!.longitude}
            latitude={event.venueCoordinates!.latitude}
          >
            <div
              style={{
                width: 15,
                height: 15,
                borderRadius: "50%",
                backgroundColor: "#15b2c7",
                border: "2px solid #F5F5F5",
                cursor: "pointer",
              }}
              title={event.title}
              onClick={(e) => {
                e.stopPropagation()
                onPinPress(event.id)
              }}
            />
          </Marker>
        ))}
    </Map>
  )
}
