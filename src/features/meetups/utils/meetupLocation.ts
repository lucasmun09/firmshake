export function formatMeetupLocation(
  lat: number,
  lng: number,
  address?: string,
): string {
  if (address?.trim()) {
    return address.trim();
  }

  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
