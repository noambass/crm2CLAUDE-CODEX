import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

// Lightweight Google Places Autocomplete input.
// Requires VITE_GOOGLE_MAPS_API_KEY in the frontend.
// If the key is missing or Google fails to load, it gracefully falls back to a normal text input.

function loadGoogleMapsPlaces(apiKey) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'));
    if (window.google?.maps?.places) return resolve(window.google);

    const existing = document.querySelector('script[data-google-maps="places"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
      return;
    }

    const script = document.createElement('script');
    script.dataset.googleMaps = 'places';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

/**
 * Props:
 * - value: string
 * - onChangeText: (text: string) => void
 * - onPlaceSelected: ({ addressText, placeId, lat, lng }) => void
 * - placeholder?: string
 */
export default function GooglePlacesInput({
  value,
  onChangeText,
  onPlaceSelected,
  placeholder = 'הקלד כתובת...',
}) {
  const inputRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const apiKey = useMemo(() => import.meta.env.VITE_GOOGLE_MAPS_API_KEY, []);

  useEffect(() => {
    let mounted = true;
    if (!apiKey) return;

    loadGoogleMapsPlaces(apiKey)
      .then((google) => {
        if (!mounted) return;
        if (!inputRef.current) return;
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['place_id', 'formatted_address', 'geometry'],
          types: ['address'],
          componentRestrictions: { country: 'il' },
        });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          const addressText = place?.formatted_address || inputRef.current?.value || '';
          const placeId = place?.place_id || null;
          const lat = place?.geometry?.location?.lat?.() ?? null;
          const lng = place?.geometry?.location?.lng?.() ?? null;
          onChangeText?.(addressText);
          onPlaceSelected?.({ addressText, placeId, lat, lng });
        });
        setEnabled(true);
      })
      .catch(() => {
        // Silent fallback to plain input.
        setEnabled(false);
      });

    return () => {
      mounted = false;
    };
  }, [apiKey, onChangeText, onPlaceSelected]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChangeText?.(e.target.value)}
      placeholder={placeholder}
      autoComplete={enabled ? 'off' : 'street-address'}
    />
  );
}
