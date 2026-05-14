import * as Location from 'expo-location';
import { Alert } from 'react-native';

// ===== TYPES =====
export interface Coordinates {
    latitude: number;
    longitude: number;
}

export interface GeocodedAddress {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    formattedAddress: string;
    coordinates: Coordinates;
}

// ===== NOMINATIM (OpenStreetMap) ADDRESS SEARCH =====
export interface NominatimResult {
    placeId: string;
    displayName: string;
    latitude: number;
    longitude: number;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}

export async function searchAddress(query: string): Promise<NominatimResult[]> {
    if (!query || query.length < 3) return [];

    try {
        const encoded = encodeURIComponent(query);
        const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&addressdetails=1&limit=5&countrycodes=pk`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'GardenMate-App/1.0',
                'Accept-Language': 'en',
            },
        });

        if (!response.ok) return [];

        const data = await response.json();

        return data.map((item: any) => ({
            placeId: String(item.place_id),
            displayName: item.display_name,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            street: item.address?.road || item.address?.neighbourhood || item.address?.suburb || '',
            city: item.address?.city || item.address?.town || item.address?.village || item.address?.county || '',
            state: item.address?.state || '',
            postalCode: item.address?.postcode || '',
            country: item.address?.country || 'Pakistan',
        }));
    } catch (error) {
        console.error('❌ Nominatim search error:', error);
        return [];
    }
}

// ===== HAVERSINE DISTANCE FORMULA =====
// Returns distance in kilometers between two GPS coordinates
export function calculateDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) * 10) / 10; // Round to 1 decimal
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

// ===== GET CURRENT LOCATION =====
export async function getCurrentLocation(): Promise<Coordinates | null> {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Location Permission Required',
                'Please enable location access in your device settings to use this feature.'
            );
            return null;
        }

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        };
    } catch (error) {
        console.error('❌ Error getting current location:', error);
        Alert.alert('Location Error', 'Could not get your current location. Please try again.');
        return null;
    }
}

// ===== REVERSE GEOCODE (coords → address) =====
export async function reverseGeocode(
    latitude: number,
    longitude: number
): Promise<GeocodedAddress | null> {
    try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });

        if (results && results.length > 0) {
            const result = results[0];
            const street = [result.streetNumber, result.street]
                .filter(Boolean)
                .join(' ') || result.name || '';

            return {
                street,
                city: result.city || result.subregion || '',
                state: result.region || '',
                postalCode: result.postalCode || '',
                country: result.country || '',
                formattedAddress: [
                    street,
                    result.city || result.subregion,
                    result.region,
                    result.postalCode
                ].filter(Boolean).join(', '),
                coordinates: { latitude, longitude },
            };
        }
        return null;
    } catch (error) {
        console.error('❌ Reverse geocode error:', error);
        return null;
    }
}

// ===== FORWARD GEOCODE (address → coords) =====
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
    try {
        const results = await Location.geocodeAsync(address);

        if (results && results.length > 0) {
            return {
                latitude: results[0].latitude,
                longitude: results[0].longitude,
            };
        }
        return null;
    } catch (error) {
        console.error('❌ Geocode error:', error);
        return null;
    }
}

// ===== SHIPPING RATE CALCULATOR =====
export interface VendorShippingConfig {
    latitude?: number;
    longitude?: number;
    radiusKm?: number; // Default 10km
    standardRate: number;
    outsideCityRate: number;
    freeShippingThreshold?: number;
    freeShippingEnabled?: boolean;
    vendorCity?: string;
}

export interface ShippingResult {
    rate: number;
    type: 'standard' | 'outside' | 'free';
    distanceKm: number | null;
    description: string;
}

export function calculateShippingRate(
    vendorConfig: VendorShippingConfig,
    customerCoords: Coordinates | null,
    subtotal: number
): ShippingResult {
    // 1. Check free shipping first
    if (vendorConfig.freeShippingEnabled && subtotal >= (vendorConfig.freeShippingThreshold || 0)) {
        return {
            rate: 0,
            type: 'free',
            distanceKm: null,
            description: 'Free delivery!',
        };
    }

    // 2. If both have coordinates, use distance
    if (
        vendorConfig.latitude && vendorConfig.longitude &&
        customerCoords?.latitude && customerCoords?.longitude
    ) {
        const distanceKm = calculateDistance(
            vendorConfig.latitude, vendorConfig.longitude,
            customerCoords.latitude, customerCoords.longitude
        );

        const radiusKm = vendorConfig.radiusKm || 10;
        const isWithinRadius = distanceKm <= radiusKm;

        return {
            rate: isWithinRadius ? vendorConfig.standardRate : vendorConfig.outsideCityRate,
            type: isWithinRadius ? 'standard' : 'outside',
            distanceKm,
            description: isWithinRadius
                ? `${distanceKm} km away (within ${radiusKm} km radius)`
                : `${distanceKm} km away (outside ${radiusKm} km radius)`,
        };
    }

    // 3. Fallback: default to standard rate
    return {
        rate: vendorConfig.standardRate,
        type: 'standard',
        distanceKm: null,
        description: 'Distance could not be calculated',
    };
}
