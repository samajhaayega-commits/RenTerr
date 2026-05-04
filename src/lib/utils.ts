import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Adds a random offset to coordinates to protect user privacy.
 * Offsets approx up to 1km by default.
 */
export function jitterLocation(lat: number, lng: number, radiusKm: number = 1): { lat: number, lng: number } {
  // 1 degree of latitude is roughly 111.1km
  const latOffsetRange = radiusKm / 111.1;
  const lngOffsetRange = radiusKm / (111.1 * Math.cos(lat * Math.PI / 180));

  // Generate random offsets within the range
  // We use Math.random() * 2 - 1 to get a value between -1 and 1
  const dLat = (Math.random() * 2 - 1) * latOffsetRange;
  const dLng = (Math.random() * 2 - 1) * lngOffsetRange;

  return {
    lat: parseFloat((lat + dLat).toFixed(6)),
    lng: parseFloat((lng + dLng).toFixed(6))
  };
}
