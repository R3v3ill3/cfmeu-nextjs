"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useGoogleMaps } from "@/providers/GoogleMapsProvider";

declare global {
  interface Window {
    google?: any;
  }
}

export type GoogleAddress = {
  formatted: string;
  components?: Record<string, string>;
  place_id?: string;
  lat?: number;
  lng?: number;
};

export function GoogleAddressInput({
  value,
  onChange,
  placeholder = "Start typing an address...",
  showLabel = true,
}: {
  value?: string;
  onChange: (addr: GoogleAddress) => void;
  placeholder?: string;
  showLabel?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { isLoaded, loadError } = useGoogleMaps();
  const [text, setText] = useState<string>(value || "");
  const lastFromAutocomplete = useRef(false);
  const selectingFromList = useRef(false);
  const onChangeRef = useRef(onChange);
  const autocompleteRef = useRef<any>(null);
  const placeListenerRef = useRef<any>(null);

  useEffect(() => {
    setText(value || "");
    if (inputRef.current) inputRef.current.value = value || "";
  }, [value]);

  // Keep latest onChange in a ref so Autocomplete listener stays stable
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (loadError) {
      console.error("Google Maps load error:", loadError);
      toast.error("Google Maps failed to load. Autocomplete disabled.");
    }
  }, [loadError]);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;
    if (!(window.google && window.google.maps && window.google.maps.places && window.google.maps.places.Autocomplete)) {
      // Places library not available; keep manual entry working
      return;
    }

    if (!autocompleteRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        fields: ["formatted_address", "address_components", "geometry", "place_id"],
      });

      placeListenerRef.current = autocompleteRef.current.addListener("place_changed", () => {
        const ac = autocompleteRef.current;
        if (!ac) return;
        const place = ac.getPlace();
        const formatted = place.formatted_address || inputRef.current?.value || "";
        const components: Record<string, string> = {};
        (place.address_components || []).forEach((c: any) => {
          components[c.types[0]] = c.long_name;
        });
        const lat = place.geometry?.location?.lat?.();
        const lng = place.geometry?.location?.lng?.();
        lastFromAutocomplete.current = true;
        // Ensure the visible input updates immediately
        if (inputRef.current && typeof formatted === "string") {
          inputRef.current.value = formatted;
        }
        setText(formatted);
        console.debug?.("GoogleAddressInput place_changed", { formatted, place_id: place.place_id });
        onChangeRef.current?.({ formatted, components, place_id: place.place_id, lat, lng });
      });
    }

    return () => {
      if (placeListenerRef.current?.remove) {
        placeListenerRef.current.remove();
        placeListenerRef.current = null;
      }
      autocompleteRef.current = null;
    };
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    const markSelecting = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.pac-container')) {
        selectingFromList.current = true;
        setTimeout(() => {
          selectingFromList.current = false;
        }, 1200);
      }
    };
    document.addEventListener('pointerdown', markSelecting as EventListener, true);
    document.addEventListener('mousedown', markSelecting as EventListener, true);
    document.addEventListener('touchstart', markSelecting as EventListener, true);
    return () => {
      document.removeEventListener('pointerdown', markSelecting as EventListener, true);
      document.removeEventListener('mousedown', markSelecting as EventListener, true);
      document.removeEventListener('touchstart', markSelecting as EventListener, true);
    };
  }, [isLoaded]);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {showLabel && <Label>Address</Label>}
        <Input
          ref={inputRef}
          defaultValue={text}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => {
            const val = e.target.value;
            setText(val);
            // Emit on every keystroke so parents always have the latest manual text
            onChange({ formatted: val });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab") {
              const hasMenu = !!document.querySelector(".pac-container .pac-item");
              if (hasMenu) {
                // Prevent form submission and let Google handle selection
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              if (e.key === "Enter") e.preventDefault();
              lastFromAutocomplete.current = false;
              const val = (inputRef.current?.value ?? text).trim();
              if (val) {
                onChange({ formatted: val });
              }
            }
          }}
          onBlur={() => {
            // Defer commit to allow place_changed after click selection
            setTimeout(() => {
              if (lastFromAutocomplete.current) {
                lastFromAutocomplete.current = false;
                return;
              }
              if (selectingFromList.current) {
                // User clicked a prediction; place_changed will handle value
                return;
              }
              const menuOpen = !!document.querySelector(".pac-container .pac-item");
              if (menuOpen) {
                // Suggestions still open; skip committing manual value
                return;
              }
              const val = (inputRef.current?.value ?? text).trim();
              if (val) {
                onChange({ formatted: val });
              }
            }, 800);
          }}
        />
        <div className="text-xs text-muted-foreground">
          {isLoaded ? <span>Autocomplete enabled.</span> : <span>{loadError?.message || "Autocomplete unavailable; manual entry works."}</span>}
        </div>
      </div>
    </div>
  );
}
