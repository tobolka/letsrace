"use client";

import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { messagesFor } from "@/lib/i18n/messages";

export type PickedPlace = { label: string; lat: number; lng: number };

/**
 * Where someone races from. Typed, or taken from the browser — both end up as
 * the same pair of coordinates, which is all the alerts and the weekend
 * suggestions need.
 */
export function PlacePicker({
  locale,
  onPick,
}: {
  locale: string;
  onPick: (place: { label: string; lat: number; lng: number }) => void;
}) {
  const t = messagesFor(locale);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 3) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        setError(t.noResults);
        return;
      }
      const hit = (await res.json()) as { lat: number; lng: number; displayName?: string };
      onPick({ label: hit.displayName || query, lat: hit.lat, lng: hit.lng });
      setQ("");
    } catch {
      setError(t.noResults);
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError(t.alertLocationDenied);
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPick({
          label: t.myLocation,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setError(t.alertLocationDenied);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  }

  return (
    <form onSubmit={(e) => void search(e)}>
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="alert-place">{t.alertPlace}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="alert-place"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.alertPlacePlaceholder}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" disabled={searching || q.trim().length < 3}>
                {t.alertAdd}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
        <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
          <LocateFixed data-icon="inline-start" />
          {locating ? t.alertLocating : t.alertUseLocation}
        </Button>
      </FieldGroup>
    </form>
  );
}
