"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useGoogleMaps } from "@/providers/GoogleMapsProvider";
import { AlertCircle, CheckCircle2 } from "lucide-react";

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

export type AddressValidationError = {
  type: 'required' | 'not_selected' | 'incomplete' | 'out_of_bounds' | 'invalid';
  message: string;
  missingComponents?: string[];
};

// Australian bounds for coordinate validation
const AUSTRALIA_BOUNDS = {
  north: -9.0,
  south: -45.0,
  east: 154.0,
  west: 112.0,
};

// Required address components for a complete Australian address
const REQUIRED_COMPONENTS = {
  street_number: 'Street number',
  route: 'Street name',
  locality: 'Suburb/City',
  administrative_area_level_1: 'State',
  postal_code: 'Postcode',
  country: 'Country',
};

/**
 * Validates if coordinates are within Australian bounds
 */
function validateAustralianBounds(lat: number, lng: number): boolean {
  return (
    lat >= AUSTRALIA_BOUNDS.south &&
    lat <= AUSTRALIA_BOUNDS.north &&
    lng >= AUSTRALIA_BOUNDS.west &&
    lng <= AUSTRALIA_BOUNDS.east
  );
}

/**
 * Validates address completeness and returns validation errors
 */
function validateAddress(
  address: GoogleAddress,
  requireSelection: boolean = true
): AddressValidationError | null {
  // Check if address is empty
  if (!address.formatted || address.formatted.trim() === '') {
    return {
      type: 'required',
      message: 'Address is required',
    };
  }

  // If requireSelection is true, ensure it was selected from Google suggestions
  if (requireSelection && !address.place_id) {
    return {
      type: 'not_selected',
      message: 'Please select an address from the dropdown suggestions',
    };
  }

  // If we have a place_id, validate components
  if (address.place_id && address.components) {
    const missingComponents: string[] = [];

    Object.entries(REQUIRED_COMPONENTS).forEach(([key, label]) => {
      if (!address.components?.[key]) {
        missingComponents.push(label);
      }
    });

    // Check if it's an Australian address
    const country = address.components.country;
    if (country && country !== 'Australia') {
      return {
        type: 'invalid',
        message: 'Please select an Australian address',
      };
    }

    if (missingComponents.length > 0) {
      return {
        type: 'incomplete',
        message: `Incomplete address. Missing: ${missingComponents.join(', ')}`,
        missingComponents,
      };
    }
  }

  // Validate coordinates if available
  if (address.lat !== undefined && address.lng !== undefined) {
    if (!validateAustralianBounds(address.lat, address.lng)) {
      return {
        type: 'out_of_bounds',
        message: 'Address coordinates are outside Australia. Please verify the address.',
      };
    }
  }

  return null;
}

export function GoogleAddressInput({
  value,
  onChange,
  placeholder = "Start typing an Australian address...",
  showLabel = true,
  required = false,
  requireSelection = true,
  onValidationChange,
}: {
  value?: string;
  onChange: (addr: GoogleAddress, error?: AddressValidationError | null) => void;
  placeholder?: string;
  showLabel?: boolean;
  required?: boolean;
  requireSelection?: boolean;
  onValidationChange?: (error: AddressValidationError | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { isLoaded, loadError } = useGoogleMaps();
  const [text, setText] = useState<string>(value || "");
  const lastFromAutocomplete = useRef(false);
  const selectingFromList = useRef(false);
  const onChangeRef = useRef(onChange);
  const autocompleteRef = useRef<any>(null);
  const placeListenerRef = useRef<any>(null);
  const [validationError, setValidationError] = useState<AddressValidationError | null>(null);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [touched, setTouched] = useState<boolean>(false);

  // Validation helper function
  const performValidation = (addr: GoogleAddress) => {
    const error = validateAddress(addr, requireSelection);
    setValidationError(error);
    setIsValid(error === null);

    if (onValidationChange) {
      onValidationChange(error);
    }

    return error;
  };

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
        componentRestrictions: { country: "au" }, // Restrict to Australia
      });

      placeListenerRef.current = autocompleteRef.current.addListener("place_changed", () => {
        const ac = autocompleteRef.current;
        if (!ac) return;
        const place = ac.getPlace();

        // Check if a valid place was selected
        if (!place.place_id) {
          const currentValue = inputRef.current?.value || "";
          const addr: GoogleAddress = { formatted: currentValue };
          const error = performValidation(addr);
          onChangeRef.current?.(addr, error);
          return;
        }

        const formatted = place.formatted_address || inputRef.current?.value || "";
        const components: Record<string, string> = {};
        (place.address_components || []).forEach((c: any) => {
          components[c.types[0]] = c.long_name;
        });
        const lat = place.geometry?.location?.lat?.();
        const lng = place.geometry?.location?.lng?.();

        lastFromAutocomplete.current = true;
        setTouched(true);

        // Ensure the visible input updates immediately
        if (inputRef.current && typeof formatted === "string") {
          inputRef.current.value = formatted;
        }
        setText(formatted);

        const addr: GoogleAddress = { formatted, components, place_id: place.place_id, lat, lng };

        console.debug?.("GoogleAddressInput place_changed", { formatted, place_id: place.place_id, lat, lng });

        // Perform validation and pass result to onChange
        const error = performValidation(addr);
        onChangeRef.current?.(addr, error);
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
        {showLabel && (
          <Label className="flex items-center gap-2">
            Address
            {required && <span className="text-destructive">*</span>}
            {isValid && touched && (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
          </Label>
        )}
        <div className="relative">
          <Input
            ref={inputRef}
            defaultValue={text}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className={`${
              touched && validationError
                ? 'border-destructive focus-visible:ring-destructive'
                : touched && isValid
                ? 'border-green-600 focus-visible:ring-green-600'
                : ''
            }`}
            onChange={(e) => {
              const val = e.target.value;
              setText(val);
              // Clear validation on typing
              if (validationError && validationError.type === 'not_selected') {
                setValidationError(null);
              }
              // Emit on every keystroke so parents always have the latest manual text
              const addr: GoogleAddress = { formatted: val };
              onChange(addr, validationError);
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
                setTouched(true);
                const val = (inputRef.current?.value ?? text).trim();
                if (val) {
                  const addr: GoogleAddress = { formatted: val };
                  const error = performValidation(addr);
                  onChange(addr, error);
                }
              }
            }}
            onBlur={() => {
              setTouched(true);
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
                  const addr: GoogleAddress = { formatted: val };
                  const error = performValidation(addr);
                  onChange(addr, error);
                }
              }, 800);
            }}
          />
          {touched && validationError && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
          )}
        </div>

        {/* Validation Error Message */}
        {touched && validationError && (
          <div className="flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{validationError.message}</p>
              {validationError.missingComponents && validationError.missingComponents.length > 0 && (
                <p className="mt-1 text-muted-foreground">
                  Try selecting a more specific address from the suggestions.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Helper Text */}
        <div className="text-xs text-muted-foreground">
          {isLoaded ? (
            <span>
              {requireSelection
                ? 'Type and select an address from the dropdown. Australian addresses only.'
                : 'Autocomplete enabled for Australian addresses.'}
            </span>
          ) : (
            <span>{loadError?.message || "Autocomplete unavailable; manual entry works."}</span>
          )}
        </div>
      </div>
    </div>
  );
}
