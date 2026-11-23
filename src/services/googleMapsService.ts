export interface MapsConfigResult {
  apiKey: string;
  configured: boolean;
  message: string | null;
}

/**
 * Resolve Google Maps API key from Vite client env (`VITE_GOOGLE_MAPS_API_KEY`)
 * or fallback to `/api/maps/config` when the Express server is running.
 */
export async function resolveGoogleMapsConfig(): Promise<MapsConfigResult> {
  const envKey = (
    ((import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_GOOGLE_MAPS_API_KEY) || ''
  ).trim();

  if (envKey.length > 5) {
    return {
      apiKey: envKey,
      configured: true,
      message: null,
    };
  }

  try {
    const res = await fetch('/api/maps/config');
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return {
        apiKey: '',
        configured: false,
        message:
          'Google Maps API key is not configured for this environment. Add VITE_GOOGLE_MAPS_API_KEY to .env (or run the Express server with GOOGLE_MAPS_API_KEY) to enable the interactive map.',
      };
    }

    const data = await res.json();
    const serverKey = typeof data?.apiKey === 'string' ? data.apiKey.trim() : '';
    if (serverKey.length > 5) {
      return {
        apiKey: serverKey,
        configured: true,
        message: null,
      };
    }

    return {
      apiKey: '',
      configured: false,
      message:
        data?.message ||
        'Google Maps API key is not configured. Set VITE_GOOGLE_MAPS_API_KEY (or GOOGLE_MAPS_API_KEY on the server) in .env to enable the interactive map.',
    };
  } catch (err) {
    console.warn('[GoogleMapsService] Could not load Maps config:', err);
    return {
      apiKey: '',
      configured: false,
      message:
        'Google Maps API key is not configured for this environment. Add VITE_GOOGLE_MAPS_API_KEY to .env (or run the Express server with GOOGLE_MAPS_API_KEY) to enable the interactive map.',
    };
  }
}
