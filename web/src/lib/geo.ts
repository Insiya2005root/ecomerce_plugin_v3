"use client";

import * as React from "react";
import { apiRequest } from "@/lib/request";
import { CITY_STATES, INDIAN_CITIES } from "@/lib/indianCities";

export type PincodePlace = {
  pin: string;
  city: string;
  state: string;
  country: string;
  areas: string[];
  latitude: number | null;
  longitude: number | null;
};

export const isPincode = (v: string) => /^[1-9]\d{5}$/.test(v.trim());

export const lookupPincode = async (pin: string) =>
  (await apiRequest<{ place: PincodePlace }>(`/geo/pincode?pin=${encodeURIComponent(pin.trim())}`)).place;

export type PincodeLookup =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; place: PincodePlace }
  | { status: "error"; message: string };

/**
 * Looks up a PIN code as soon as it has 6 digits. `onFound` runs once per new PIN (use it to fill the form);
 * the returned state drives the hint under the field.
 */
export function usePincodeLookup(pin: string, onFound: (place: PincodePlace) => void): PincodeLookup {
  const onFoundRef = React.useRef(onFound);
  React.useEffect(() => {
    onFoundRef.current = onFound;
  });
  const value = pin.trim();
  const valid = isPincode(value);
  const [result, setResult] = React.useState<{ pin: string; lookup: PincodeLookup } | null>(null);

  React.useEffect(() => {
    if (!valid) return;
    let active = true;
    const t = window.setTimeout(() => {
      lookupPincode(value)
        .then((place) => {
          if (!active) return;
          setResult({ pin: value, lookup: { status: "found", place } });
          onFoundRef.current(place);
        })
        .catch((err) => active && setResult({ pin: value, lookup: { status: "error", message: err instanceof Error ? err.message : "Lookup failed." } }));
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [value, valid]);

  if (!valid) return { status: "idle" };
  return result?.pin === value ? result.lookup : { status: "loading" };
}

/** Bundled list of Indian cities (largest first) for the city picker. */
export function searchCities(query: string, limit = 8): { name: string; state: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return INDIAN_CITIES.slice(0, limit).map(([name, s]) => ({ name, state: CITY_STATES[s] }));
  const starts: { name: string; state: string }[] = [];
  const contains: { name: string; state: string }[] = [];
  for (const [name, s] of INDIAN_CITIES) {
    const n = name.toLowerCase();
    if (n.startsWith(q)) starts.push({ name, state: CITY_STATES[s] });
    else if (n.includes(q)) contains.push({ name, state: CITY_STATES[s] });
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
