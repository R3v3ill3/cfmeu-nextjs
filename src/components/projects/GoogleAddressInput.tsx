"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useGoogleMaps } from "@/providers/GoogleMapsProvider";
import { useMobileKeyboard } from "@/hooks/useMobileKeyboard";
import { AlertCircle, CheckCircle2, MapPin, Navigation } from "lucide-react";

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
  enableGeolocation = true,
}: {
  value?: string;
  onChange: (addr: GoogleAddress, error?: AddressValidationError | null) => void;
  placeholder?: string;
  showLabel?: boolean;
  required?: boolean;
  requireSelection?: boolean;
  onValidationChange?: (error: AddressValidationError | null) => void;
  enableGeolocation?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { isLoaded, loadError } = useGoogleMaps();
  const { scrollToInput, dismissKeyboard } = useMobileKeyboard({
    enableAutoScroll: true,
    scrollOffset: 80,
    enableDismissOnTapOutside: true,
    enableDismissOnScroll: true
  });
  const [text, setText] = useState<string>(value || "");
  const lastFromAutocomplete = useRef(false);
  const selectingFromList = useRef(false);
  const onChangeRef = useRef(onChange);
  const autocompleteRef = useRef<any>(null);
  const placeListenerRef = useRef<any>(null);
  const [validationError, setValidationError] = useState<AddressValidationError | null>(null);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [touched, setTouched] = useState<boolean>(false);
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);

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

  // Geolocation functionality
  const getCurrentLocation = useCallback(async () => {
    if (!enableGeolocation || !navigator.geolocation) {
      toast.error("Geolocation is not supported on this device");
      return;
    }

    setIsGettingLocation(true);
    dismissKeyboard(); // Hide keyboard when getting location

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocoding using Google Maps API
      if (!window.google || !window.google.maps) {
        throw new Error("Google Maps not loaded");
      }

      const geocoder = new window.google.maps.Geocoder();
      const result = await new Promise<window.google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoder.geocode(
          { location: { lat: latitude, lng: longitude } },
          (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
              resolve(results);
            } else {
              reject(new Error('Unable to get address from location'));
            }
          }
        );
      });

      // Find the first address that's in Australia
      const australianAddress = result.find(result =>
        result.address_components?.some(component =>
          component.types.includes('country') && component.long_name === 'Australia'
        )
      );

      if (australianAddress) {
        const formatted = australianAddress.formatted_address || "";
        const components: Record<string, string> = {};
        australianAddress.address_components?.forEach((c: any) => {
          components[c.types[0]] = c.long_name;
        });

        const lat = australianAddress.geometry?.location?.lat?.();
        const lng = australianAddress.geometry?.location?.lng?.();

        const addr: GoogleAddress = {
          formatted,
          components,
          place_id: australianAddress.place_id,
          lat,
          lng
        };

        setText(formatted);
        if (inputRef.current) {
          inputRef.current.value = formatted;
        }

        lastFromAutocomplete.current = true;
        setTouched(true);

        const error = performValidation(addr);
        onChangeRef.current?.(addr, error);

        toast.success("Location detected successfully");
      } else {
        toast.error("Unable to find Australian address for your location");
      }

    } catch (error) {
      console.error("Geolocation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to get your location");
    } finally {
      setIsGettingLocation(false);
    }
  }, [enableGeolocation, dismissKeyboard, performValidation]);

  // Handle input focus with mobile keyboard optimization
  const handleInputFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    scrollToInput(event.target);
  }, [scrollToInput]);

  // Handle input changes with mobile optimization
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newText = event.target.value;
    setText(newText);
    
    // Don't process if this change came from autocomplete selection
    if (lastFromAutocomplete.current) {
      console.log('[GoogleAddressInput] Input change from autocomplete, skipping onChange call')
      lastFromAutocomplete.current = false;
      return;
    }
    
    lastFromAutocomplete.current = false;

    // For search contexts (requireSelection=false), clear previous selection when user types
    // This ensures we don't show stale results from a previous search
    if (requireSelection === false) {
      // Clear the previous address selection by sending an empty address
      // This will clear search results from the previous address
      if (newText !== value && !selectingFromList.current) {
        console.log('[GoogleAddressInput] User typing new address, clearing previous selection')
        onChangeRef.current?.({ formatted: newText }, null);
      }
      return;
    }

    // For form contexts (requireSelection=true), provide immediate feedback
    if (!selectingFromList.current) {
      const addr: GoogleAddress = { formatted: newText };
      const error = performValidation(addr);
      onChangeRef.current?.(addr, error);
    }
  }, [requireSelection, performValidation, value]);

  // Handle input blur with mobile optimization
  const handleInputBlur = useCallback(() => {
    // For search contexts (requireSelection=false), don't trigger onChange on blur
    // Only trigger onChange when user explicitly selects from autocomplete
    if (!requireSelection) {
      return;
    }
    
    // For form contexts, trigger validation on blur if touched
    if (touched && text) {
      const addr: GoogleAddress = { formatted: text };
      const error = performValidation(addr);
      onChangeRef.current?.(addr, error);
    }
  }, [touched, text, performValidation, requireSelection]);

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
    console.log('[GoogleAddressInput] Setup effect running', { 
      isLoaded, 
      hasInputRef: !!inputRef.current,
      hasAutocompleteRef: !!autocompleteRef.current,
      hasListenerRef: !!placeListenerRef.current
    });
    
    if (!isLoaded || !inputRef.current) {
      console.log('[GoogleAddressInput] Not ready - isLoaded:', isLoaded, 'hasInputRef:', !!inputRef.current);
      return;
    }
    
    if (!(window.google && window.google.maps && window.google.maps.places && window.google.maps.places.Autocomplete)) {
      console.log('[GoogleAddressInput] Google Maps Places API not available');
      return;
    }

    // Always re-attach the listener if it's missing, even if autocomplete exists
    const needsAutocomplete = !autocompleteRef.current;
    const needsListener = !placeListenerRef.current;
    
    if (needsAutocomplete) {
      console.log('[GoogleAddressInput] Creating new Autocomplete instance');
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        fields: ["formatted_address", "address_components", "geometry", "place_id"],
        componentRestrictions: { country: "au" },
      });
      console.log('[GoogleAddressInput] Autocomplete created');
    }
    
    if (needsListener && autocompleteRef.current) {
      console.log('[GoogleAddressInput] Attaching place_changed listener');
      placeListenerRef.current = autocompleteRef.current.addListener("place_changed", () => {
        console.log('[GoogleAddressInput] ⚡⚡⚡ place_changed event FIRED ⚡⚡⚡');
        const ac = autocompleteRef.current;
        if (!ac) {
          console.log('[GoogleAddressInput] No autocomplete ref');
          return;
        }
        const place = ac.getPlace();
        console.log('[GoogleAddressInput] Place data:', place);

        // Check if a valid place was selected
        if (!place.place_id) {
          console.log('[GoogleAddressInput] ❌ No place_id, using current value');
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

        console.log('[GoogleAddressInput] ✅ Extracted coordinates:', { lat, lng, formatted });

        lastFromAutocomplete.current = true;
        setTouched(true);

        // Ensure the visible input updates immediately
        if (inputRef.current && typeof formatted === "string") {
          inputRef.current.value = formatted;
        }
        setText(formatted);

        const addr: GoogleAddress = { formatted, components, place_id: place.place_id, lat, lng };

        console.log('[GoogleAddressInput] 🚀 Calling onChange with:', { 
          hasCoordinates: !!(lat && lng), 
          place_id: place.place_id,
          lat,
          lng
        });

        // Perform validation and pass result to onChange
        const error = performValidation(addr);
        console.log('[GoogleAddressInput] About to call onChangeRef.current');
        onChangeRef.current?.(addr, error);
        console.log('[GoogleAddressInput] ✅ onChange called');
      });
      console.log('[GoogleAddressInput] Event listener attached');
    }
    
    if (!needsAutocomplete && !needsListener) {
      console.log('[GoogleAddressInput] Autocomplete and listener already exist');
    }

    // Cleanup: Only remove listener, keep autocomplete instance
    return () => {
      console.log('[GoogleAddressInput] Cleanup running');
      if (placeListenerRef.current) {
        try {
          if (typeof placeListenerRef.current.remove === 'function') {
            placeListenerRef.current.remove();
          } else if (window.google && window.google.maps && window.google.maps.event) {
            window.google.maps.event.removeListener(placeListenerRef.current);
          }
          console.log('[GoogleAddressInput] Listener removed');
          placeListenerRef.current = null;
        } catch (error) {
          console.warn("Error removing listener:", error);
        }
      }
    };
  }, [isLoaded, performValidation]);

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
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                defaultValue={text}
                placeholder={placeholder}
                autoComplete="street-address"
                autoCorrect="off"
                spellCheck={false}
                name="street-address"
                type="text"
                mobileOptimization={true}
                className={`${
                  touched && validationError
                    ? 'border-destructive focus-visible:ring-destructive'
                    : touched && isValid
                    ? 'border-green-600 focus-visible:ring-green-600'
                    : ''
                }`}
                onFocus={handleInputFocus}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
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
              />
              {touched && validationError && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </div>
              )}
            </div>

            {/* Geolocation button - only shown on touch devices and when enabled */}
            {enableGeolocation && 'ontouchstart' in window && (
              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px] min-w-[44px]"
                title="Use current location"
              >
                {isGettingLocation ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
                ) : (
                  <Navigation className="h-4 w-4 text-gray-600" />
                )}
              </button>
            )}
          </div>
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
