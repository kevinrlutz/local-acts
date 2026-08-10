import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import Colors from "@/src/Colors";
import { generateSessionToken } from "@/src/lib/uuid";
import { retrieveVenue, suggestVenues } from "@/src/services/mapboxSearchBox";
import type { VenueSuggestion } from "@/src/types/venues";

/** What the parent form actually persists is `mapboxId` — `name`/`fullAddress`
 *  here are only kept in local component state to confirm the selection to
 *  the user, never written to the database. */
export type SelectedVenue = {
  mapboxId: string;
  name: string;
  fullAddress: string | null;
};

type VenuePickerProps = {
  value: SelectedVenue | null;
  onChange: (venue: SelectedVenue | null) => void;
  placeholder?: string;
};

const SEARCH_DEBOUNCE_MS = 300;

export default function VenuePicker({ value, onChange, placeholder }: VenuePickerProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<VenueSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh session_token per search session, per Mapbox's session-billing
  // rules (each concurrent session needs a distinct token).
  const sessionTokenRef = useRef(generateSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runSearch = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        setError(null);
        const results = await suggestVenues(text, sessionTokenRef.current);
        setSuggestions(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Venue search failed.");
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setIsOpen(true);
    runSearch(text);
  };

  const handleSelect = async (suggestion: VenueSuggestion) => {
    try {
      setIsResolving(true);
      setError(null);
      // Confirm the selection to the user with the resolved name/address —
      // only `mapboxId` from this result is ever handed back to the parent.
      const resolved = await retrieveVenue(suggestion.mapboxId, sessionTokenRef.current);
      onChange({
        mapboxId: resolved.mapboxId,
        name: resolved.name,
        fullAddress: resolved.fullAddress,
      });
      setQuery("");
      setSuggestions([]);
      setIsOpen(false);
      // A completed /retrieve ends this session — start a fresh token for
      // the next one.
      sessionTokenRef.current = generateSessionToken();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resolve venue.");
    } finally {
      setIsResolving(false);
    }
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    setSuggestions([]);
  };

  return (
    <View>
      <TextInput
        value={
          value ? `${value.name}${value.fullAddress ? ` — ${value.fullAddress}` : ""}` : query
        }
        onChangeText={(text) => {
          if (value) onChange(null);
          handleQueryChange(text);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder ?? "Search for a venue..."}
        placeholderTextColor={Colors.secondaryGray}
        style={styles.input}
        autoCapitalize="none"
      />
      {(isSearching || isResolving) && (
        <ActivityIndicator style={styles.spinner} color={Colors.secondaryAction} />
      )}
      {value && (
        <Pressable onPress={handleClear} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear venue</Text>
        </Pressable>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {isOpen && suggestions.length > 0 && (
        <View style={styles.suggestionList}>
          {suggestions.map((s) => (
            <Pressable
              key={s.mapboxId}
              style={styles.suggestionItem}
              onPress={() => handleSelect(s)}
            >
              <Text style={styles.suggestionName}>{s.name}</Text>
              {s.fullAddress ? (
                <Text style={styles.suggestionMeta}>{s.fullAddress}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.secondaryBackground,
    color: Colors.primaryWhite,
  },
  spinner: { marginTop: 8 },
  clearButton: { marginTop: 8, alignSelf: "flex-start" },
  clearButtonText: {
    color: Colors.secondaryGray,
    fontSize: 12,
    textDecorationLine: "underline",
  },
  errorText: { color: "#FF5A5F", marginTop: 8 },
  suggestionList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.contentBorder,
    borderRadius: 10,
    overflow: "hidden",
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.contentBorder,
  },
  suggestionName: { color: Colors.primaryWhite, fontWeight: "600" },
  suggestionMeta: { color: Colors.secondaryGray, fontSize: 12, marginTop: 2 },
});
