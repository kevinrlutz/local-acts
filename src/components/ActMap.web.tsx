import React, { useEffect, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl";
import type { ActMapProps } from "./ActMap";

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? ""
const DEFAULT_VIEW_STATE = { longitude: -98.35, latitude: 39.5, zoom: 4 }

type ViewState = { longitude: number; latitude: number; zoom: number }

export default function ActMap({ acts, userCoordinates, onPinPress }: ActMapProps) {
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
      {acts
        .filter((act) => act.location?.coordinates)
        .map((act) => (
          <Marker
            key={act.id}
            longitude={act.location.coordinates.longitude}
            latitude={act.location.coordinates.latitude}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: "#BB86FC",
                border: "2px solid #F5F5F5",
                cursor: "pointer",
              }}
              title={act.name}
              onClick={(e) => {
                e.stopPropagation()
                onPinPress(act.id)
              }}
            />
          </Marker>
        ))}
    </Map>
  )
}
