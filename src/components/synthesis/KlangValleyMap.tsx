import React, { useState, useEffect, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { MapPin, Users, ShoppingBag, ShieldCheck, HelpCircle, Filter, Sparkles, Navigation, Layers, ExternalLink } from 'lucide-react';
import { InterviewRecord } from '../../types';
import { isAnalysisEligibleRecord } from '../../lib/recordEligibility';
import { resolveGoogleMapsConfig } from '../../services/googleMapsService';

interface KlangValleyMapProps {
  records: InterviewRecord[];
  embedded?: boolean;
}

// Known Klang Valley coordinates mapping
const KLANG_VALLEY_COORDINATES: Record<string, { lat: number; lng: number; displayName: string }> = {
  kepong: { lat: 3.2104, lng: 101.6338, displayName: 'Kepong' },
  'brem mall': { lat: 3.2045, lng: 101.6669, displayName: 'Brem Mall Kepong' },
  'brem mall kepong': { lat: 3.2045, lng: 101.6669, displayName: 'Brem Mall Kepong' },
  nsk: { lat: 3.2023, lng: 101.6685, displayName: 'NSK Trade City (Kepong / Kuchai)' },
  ampang: { lat: 3.1499, lng: 101.7618, displayName: 'Ampang' },
  'petaling jaya': { lat: 3.1073, lng: 101.6067, displayName: 'Petaling Jaya (PJ)' },
  pj: { lat: 3.1073, lng: 101.6067, displayName: 'Petaling Jaya' },
  'subang jaya': { lat: 3.0567, lng: 101.5851, displayName: 'Subang Jaya' },
  subang: { lat: 3.0567, lng: 101.5851, displayName: 'Subang Jaya' },
  publika: { lat: 3.1714, lng: 101.6653, displayName: 'Publika / Solaris Dutamas' },
  'mont kiara': { lat: 3.1725, lng: 101.6525, displayName: 'Mont Kiara' },
  cheras: { lat: 3.0850, lng: 101.7314, displayName: 'Cheras' },
  'shah alam': { lat: 3.0738, lng: 101.5183, displayName: 'Shah Alam' },
  'aeon mall': { lat: 3.0805, lng: 101.5478, displayName: 'AEON Mall Shah Alam' },
  'aeon mall shah alam': { lat: 3.0805, lng: 101.5478, displayName: 'AEON Mall Shah Alam' },
  'jaya grocer': { lat: 3.1764, lng: 101.5189, displayName: 'Jaya Grocer Elmina Lakeside Mall' },
  elmina: { lat: 3.1764, lng: 101.5189, displayName: 'Jaya Grocer Elmina Lakeside Mall' },
  klang: { lat: 3.0449, lng: 101.4456, displayName: 'Klang' },
  puchong: { lat: 3.0333, lng: 101.6167, displayName: 'Puchong' },
  damansara: { lat: 3.1365, lng: 101.6214, displayName: 'Damansara' },
  bangsar: { lat: 3.1292, lng: 101.6710, displayName: 'Bangsar' },
  'wangsa maju': { lat: 3.1979, lng: 101.7226, displayName: 'Wangsa Maju' },
  setapak: { lat: 3.1900, lng: 101.7100, displayName: 'Setapak' },
  selayang: { lat: 3.2384, lng: 101.6750, displayName: 'Selayang' },
  'batu caves': { lat: 3.2379, lng: 101.6840, displayName: 'Batu Caves' },
  'kuala lumpur': { lat: 3.1390, lng: 101.6869, displayName: 'Kuala Lumpur City Center' },
  kl: { lat: 3.1390, lng: 101.6869, displayName: 'Kuala Lumpur' },
};

export const KlangValleyMap: React.FC<KlangValleyMapProps> = ({ records, embedded = false }) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [loadingKey, setLoadingKey] = useState<boolean>(true);
  const [mapConfigMessage, setMapConfigMessage] = useState<string | null>(null);
  const [mapAuthError, setMapAuthError] = useState<string | null>(null);
  const [selectedClusterKey, setSelectedClusterKey] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<'interviewVenue' | 'residence'>('interviewVenue');
  const [filterRole, setFilterRole] = useState<'all' | 'mummy' | 'elderly' | 'other'>('all');
  const [filterSpending, setFilterSpending] = useState<string>('all');

  // Fetch Maps API key from client env or backend /api/maps/config via googleMapsService
  useEffect(() => {
    let cancelled = false;
    resolveGoogleMapsConfig()
      .then((result) => {
        if (cancelled) return;
        setApiKey(result.apiKey);
        setMapConfigMessage(result.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingKey(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Catch Google Maps JavaScript API authentication / referrer failures cleanly
  useEffect(() => {
    if (!apiKey || typeof window === 'undefined') return;
    const win = window as unknown as { gm_authFailure?: () => void };
    const previousHandler = win.gm_authFailure;
    win.gm_authFailure = () => {
      const origin = window.location?.origin || 'this origin';
      console.warn(
        `[KlangValleyMap] Google Maps authentication failed for ${origin}. Verify API key restrictions and enabled Maps JavaScript API.`
      );
      setMapAuthError(
        `Google Maps could not authenticate for "${origin}". Verify VITE_GOOGLE_MAPS_API_KEY / GOOGLE_MAPS_API_KEY, ensure Maps JavaScript API is enabled, and add "${origin}/*" to your key's HTTP referrer restrictions in Google Cloud Console.`
      );
      if (typeof previousHandler === 'function') {
        previousHandler();
      }
    };
    return () => {
      win.gm_authFailure = previousHandler;
    };
  }, [apiKey]);

  const eligibleRecords = useMemo(
    () => records.filter(isAnalysisEligibleRecord),
    [records]
  );

  // Group records into geographic clusters across Klang Valley with ZERO mock data
  const { locationClusters, unstatedRecords } = useMemo(() => {
    const clusters: Record<
      string,
      {
        key: string;
        displayName: string;
        lat: number;
        lng: number;
        records: InterviewRecord[];
      }
    > = {};
    const unstated: InterviewRecord[] = [];

    eligibleRecords.forEach((rec) => {
      const dec = rec.adkotmDecode;
      let rawLoc = '';

      if (locationMode === 'residence') {
        // Participant Home Residence (Demographic D - RL)
        rawLoc = (
          dec?.demographic?.residentialDistrict ||
          dec?.demographic?.residentialLocation ||
          dec?.postAnalysisCodes?.RL ||
          ''
        ).toLowerCase().trim();
      } else {
        // Interview Retail Venue (Metadata M - IL)
        rawLoc = (
          dec?.metadata?.interviewLocation ||
          dec?.postAnalysisCodes?.IL ||
          rec.sessionLocation ||
          ''
        ).toLowerCase().trim();
      }

      // Check if location is unstated or null
      if (
        !rawLoc ||
        rawLoc === 'null' ||
        rawLoc === 'unstated' ||
        rawLoc === 'unknown' ||
        rawLoc === 'none' ||
        rawLoc.includes('unstated')
      ) {
        unstated.push(rec);
        return;
      }

      // Find matching coordinate
      let matchedKey: string | null = null;
      for (const [key] of Object.entries(KLANG_VALLEY_COORDINATES)) {
        if (rawLoc.includes(key)) {
          matchedKey = key;
          break;
        }
      }

      if (!matchedKey) {
        unstated.push(rec);
        return;
      }

      const coordInfo = KLANG_VALLEY_COORDINATES[matchedKey];
      if (!clusters[matchedKey]) {
        clusters[matchedKey] = {
          key: matchedKey,
          displayName: coordInfo.displayName,
          lat: coordInfo.lat,
          lng: coordInfo.lng,
          records: [],
        };
      }
      clusters[matchedKey].records.push(rec);
    });

    return {
      locationClusters: Object.values(clusters),
      unstatedRecords: unstated,
    };
  }, [eligibleRecords, locationMode]);

  // Filter clusters by user selection
  const filteredClusters = useMemo(() => {
    return locationClusters
      .map((c) => {
        const matchingRecords = c.records.filter((r) => {
          const dec = r.adkotmDecode;
          const role = (dec?.demographic?.familyRole || dec?.postAnalysisCodes?.FR || '').toLowerCase();
          const spending = r.spendingPower?.spendingPowerTier || 'Unclassified';

          if (filterRole === 'mummy' && !role.includes('mum') && !role.includes('mother')) return false;
          if (filterRole === 'elderly' && !role.includes('elderly') && !role.includes('grand')) return false;
          if (filterRole === 'other' && (role.includes('mum') || role.includes('elderly'))) return false;

          if (filterSpending !== 'all' && spending !== filterSpending) return false;

          return true;
        });

        return {
          ...c,
          records: matchingRecords,
        };
      })
      .filter((c) => c.records.length > 0);
  }, [locationClusters, filterRole, filterSpending]);

  const selectedCluster = useMemo(() => {
    return filteredClusters.find((c) => c.key === selectedClusterKey) || filteredClusters[0] || null;
  }, [filteredClusters, selectedClusterKey]);

  return (
    <div
      className={
        embedded
          ? 'overflow-hidden flex flex-col'
          : 'bg-white rounded-3xl border border-[#EAE6DF] shadow-studio overflow-hidden flex flex-col'
      }
    >
      {/* Top Map Header & Filters */}
      <div className="p-4 sm:p-5 bg-[#F7F5F0] border-b border-[#EAE6DF] text-[#292524] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="p-1.5 rounded-full bg-[#E6F5F1] text-[#1E4D42] border border-[#96D6C7]">
              <MapPin className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-bold text-lg sm:text-xl text-[#292524] tracking-[-0.02em]">
              Klang Valley Demographic Distribution Map
            </h3>
            <span className="text-[13px] font-semibold px-3 py-0.5 rounded-full bg-[#F2FBF8] text-[#1E4D42] border border-[#96D6C7]">
              Google Maps Platform
            </span>
          </div>
          <p className="text-base leading-[1.65] text-[#57534E]">
            Geographic clustering of {eligibleRecords.length} study respondents across Kuala Lumpur, Kepong, Ampang, PJ & Subang.
          </p>
        </div>

        {/* Filter Controls & Location Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {/* Location Mode Switcher (IL vs RL) */}
          <div className="flex items-center bg-white p-0.5 rounded-full border border-[#EAE6DF] text-[13px]">
            <button
              type="button"
              onClick={() => setLocationMode('interviewVenue')}
              className={`px-3 py-1 rounded-full font-semibold cursor-pointer transition-all whitespace-nowrap ${
                locationMode === 'interviewVenue'
                  ? 'bg-[#D97A75] text-white'
                  : 'text-[#57534E] hover:text-[#292524]'
              }`}
            >
              Interview Venue (IL)
            </button>
            <button
              type="button"
              onClick={() => setLocationMode('residence')}
              className={`px-3 py-1 rounded-full font-semibold cursor-pointer transition-all whitespace-nowrap ${
                locationMode === 'residence'
                  ? 'bg-[#528BCA] text-white'
                  : 'text-[#57534E] hover:text-[#292524]'
              }`}
            >
              Residence (RL)
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-[#EAE6DF] rounded-full px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-[#78716C]" />
            <span className="text-[#78716C] font-medium">Role:</span>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as any)}
              className="bg-transparent text-[#292524] font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="mummy">Mummies Only</option>
              <option value="elderly">Elderly Only</option>
              <option value="other">Dads & Others</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-[#EAE6DF] rounded-full px-3 py-1.5">
            <span className="text-[#78716C] font-medium">Spending:</span>
            <select
              value={filterSpending}
              onChange={(e) => setFilterSpending(e.target.value)}
              className="bg-transparent text-[#292524] font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">All Tiers</option>
              <option value="High">High Tier</option>
              <option value="Medium-High">Medium-High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Map + District Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[500px]">
        {/* Google Map Viewport */}
        <div className="lg:col-span-2 relative h-[420px] lg:h-[540px] w-full bg-[#F7F5F0] border-b lg:border-b-0 lg:border-r border-[#EAE6DF]">
          {apiKey && !mapAuthError ? (
            <APIProvider
              apiKey={apiKey}
              onError={(err) => {
                console.warn('[KlangValleyMap] Google Maps script load error:', err);
                const origin =
                  typeof window !== 'undefined' && window.location?.origin
                    ? window.location.origin
                    : 'this origin';
                setMapAuthError(
                  `Failed to load Google Maps JS API on "${origin}". Check your API key, network connectivity, and Google Cloud Maps JavaScript API settings.`
                );
              }}
            >
              <Map
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={['gmp_git_agentskills_v1']}
                defaultCenter={{ lat: 3.1500, lng: 101.6869 }}
                defaultZoom={11}
                gestureHandling="greedy"
                disableDefaultUI={false}
                mapTypeControl={false}
                streetViewControl={false}
                fullscreenControl={false}
                zoomControl={true}
                style={{ width: '100%', height: '100%' }}
              >
                {filteredClusters.map((cluster) => {
                  const isSelected = selectedCluster?.key === cluster.key;
                  const activeStyle =
                    locationMode === 'residence'
                      ? 'bg-[#528BCA] text-white border-white ring-2 ring-[#528BCA]/40 scale-105 z-30'
                      : 'bg-[#D97A75] text-white border-white ring-2 ring-[#D97A75]/40 scale-105 z-30';
                  return (
                    <AdvancedMarker
                      key={cluster.key}
                      position={{ lat: cluster.lat, lng: cluster.lng }}
                      onClick={() => setSelectedClusterKey(cluster.key)}
                      title={`${cluster.displayName}: ${cluster.records.length} participants`}
                    >
                      <div
                        className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-md border transition-all cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? activeStyle
                            : 'bg-[#292524]/95 text-white border-[#EAE6DF]/40 hover:bg-[#292524] hover:scale-105 z-10'
                        }`}
                      >
                        <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-[#F7D147]'}`} />
                        <span className="font-bold text-[13px] tracking-tight truncate max-w-[78px]">
                          {cluster.displayName.split(' ')[0]}
                        </span>
                        <span className="min-w-5 h-5 px-1.5 rounded-full text-[13px] font-black bg-white text-[#292524] flex items-center justify-center shrink-0 tabular-nums">
                          {cluster.records.length}
                        </span>
                      </div>
                    </AdvancedMarker>
                  );
                })}

                {selectedCluster && (
                  <InfoWindow
                    position={{ lat: selectedCluster.lat, lng: selectedCluster.lng }}
                    onCloseClick={() => setSelectedClusterKey(null)}
                  >
                    <div className="p-2.5 max-w-xs text-[#292524]">
                      <div className="font-heading font-bold text-base text-[#292524] mb-1 flex items-center justify-between gap-2">
                        <span>{selectedCluster.displayName}</span>
                        <span className="text-[13px] px-2.5 py-0.5 rounded-full bg-[#FEFBEB] text-[#6B5306] border border-[#F7D147]/60 font-semibold whitespace-nowrap">
                          {selectedCluster.records.length} {selectedCluster.records.length === 1 ? 'person' : 'people'}
                        </span>
                      </div>
                      <p className="text-sm leading-[1.65] text-[#57534E] mb-2">
                        Key respondents identified in this residential & venue zone.
                      </p>
                      <div className="space-y-1.5 border-t border-[#EAE6DF] pt-2 text-sm">
                        {selectedCluster.records.slice(0, 3).map((r) => {
                          const dec = r.adkotmDecode;
                          return (
                            <div key={r.id} className="bg-[#FDFCF8] p-2 rounded-xl border border-[#EAE6DF]">
                              <div className="font-semibold text-[#292524] truncate">{r.fileName}</div>
                              <div className="text-[13px] text-[#78716C] flex items-center gap-2 mt-0.5">
                                <span>Role: {dec?.demographic?.familyRole || 'Mum'}</span>
                                <span>•</span>
                                <span>Spending: {r.spendingPower?.spendingPowerTier || 'Medium'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#FDFCF8]">
              <MapPin className="w-10 h-10 text-[#78716C] mb-2.5" />
              <p className="font-heading font-semibold text-[#292524] text-lg">
                {loadingKey
                  ? 'Connecting to Google Maps Platform...'
                  : mapAuthError
                  ? 'Google Maps Authentication Error'
                  : 'Google Maps API Key Not Configured'}
              </p>
              <p className="text-sm leading-[1.65] text-[#57534E] max-w-md mt-1.5">
                {loadingKey
                  ? 'Loading Klang Valley geographic clusters...'
                  : mapAuthError ||
                    mapConfigMessage ||
                    'Set VITE_GOOGLE_MAPS_API_KEY in .env (or GOOGLE_MAPS_API_KEY on the server) to display the interactive map.'}
              </p>
              {!loadingKey && (
                <p className="text-xs text-[#78716C] max-w-md mt-2">
                  You can still browse all district demographic clusters using the district quick bar below and the sidebar on the right.
                </p>
              )}
            </div>
          )}

          {/* District Quick Bar Overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 overflow-x-auto pb-1 z-10 pointer-events-auto">
            {filteredClusters.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelectedClusterKey(c.key)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap shadow-studio border transition-all cursor-pointer ${
                  selectedCluster?.key === c.key
                    ? 'bg-[#292524] text-white border-[#292524]'
                    : 'bg-white/95 text-[#292524] border-[#EAE6DF] hover:bg-[#F7F5F0]'
                }`}
              >
                {c.displayName}: {c.records.length}
              </button>
            ))}
          </div>
        </div>

        {/* Right Sidebar: Demographic Details of Selected District */}
        <div className="p-4 sm:p-5 flex flex-col justify-between bg-[#F7F5F0] h-[420px] lg:h-[540px] overflow-y-auto">
          {selectedCluster ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold uppercase tracking-wider text-[#6B5306] bg-[#FEFBEB] border border-[#F7D147]/60 px-3 py-0.5 rounded-full">
                    Selected District
                  </span>
                  <span className="text-[13px] text-[#78716C] font-mono tabular-nums">
                    {selectedCluster.lat.toFixed(4)}, {selectedCluster.lng.toFixed(4)}
                  </span>
                </div>
                <h4 className="font-heading text-xl font-bold text-[#292524] tracking-[-0.02em] mt-2">
                  {selectedCluster.displayName}
                </h4>
                <p className="text-base leading-[1.65] text-[#57534E] mt-1">
                  {selectedCluster.records.length} interview participants residing or interviewed here.
                </p>
              </div>

              {/* District Demographic Breakdown */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white p-3.5 rounded-2xl border border-[#EAE6DF]">
                  <div className="text-[#78716C] text-[13px]">Mummies</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-[#292524] mt-0.5">
                    {
                      selectedCluster.records.filter((r) => {
                        const role = (r.adkotmDecode?.demographic?.familyRole || '').toLowerCase();
                        return role.includes('mum') || role.includes('mother');
                      }).length
                    }
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-[#EAE6DF]">
                  <div className="text-[#78716C] text-[13px]">Elderly / Grandparents</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-[#292524] mt-0.5">
                    {
                      selectedCluster.records.filter((r) => {
                        const role = (r.adkotmDecode?.demographic?.familyRole || '').toLowerCase();
                        return role.includes('elderly') || role.includes('grand');
                      }).length
                    }
                  </div>
                </div>
              </div>

              {/* Participants in this cluster */}
              <div>
                <div className="text-[13px] font-bold text-[#57534E] uppercase tracking-wider mb-2">
                  Participants ({selectedCluster.records.length})
                </div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {selectedCluster.records.map((r) => {
                    const dec = r.adkotmDecode;
                    const demo = dec?.demographic;
                    const age = demo?.age || (demo?.familyRole === 'Elderly' ? '60+' : '30-40');
                    const edu = demo?.educationLevel || 'Secondary / Degree';
                    const aw = dec?.knowledge?.awarenessLevel || 'Aware';
                    const spending = r.spendingPower?.spendingPowerTier || 'Medium';

                    return (
                      <div
                        key={r.id}
                        className="bg-white p-3.5 rounded-2xl border border-[#EAE6DF] text-base space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-heading font-bold text-base text-[#292524] truncate max-w-[150px]">{r.fileName}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[13px] font-bold whitespace-nowrap ${
                              spending === 'High'
                                ? 'bg-[#F2FBF8] text-[#1E4D42] border border-[#96D6C7]'
                                : spending === 'Medium-High'
                                ? 'bg-[#F2F7FC] text-[#234B78] border border-[#528BCA]/40'
                                : 'bg-[#F7F5F0] text-[#57534E] border border-[#EAE6DF]'
                            }`}
                          >
                            {spending} Spending
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[13px] text-[#57534E]">
                          <div>
                            <span className="text-[#78716C]">Role:</span> {demo?.familyRole || 'Mum'}
                          </div>
                          <div>
                            <span className="text-[#78716C]">Age:</span> {age}
                          </div>
                          <div className="col-span-2">
                            <span className="text-[#78716C]">Education:</span> {edu}
                          </div>
                        </div>
                        <div className="pt-1.5 border-t border-[#EAE6DF] text-[13px] flex items-center justify-between">
                          <span className="text-[#78716C]">Gut Awareness:</span>
                          <span
                            className={`font-semibold ${
                              aw === 'Aware' ? 'text-[#1E4D42]' : 'text-[#6B5306]'
                            }`}
                          >
                            {aw}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MapPin className="w-8 h-8 text-[#78716C] mb-2" />
              <p className="font-heading text-lg font-semibold text-[#292524]">Select a Location Marker</p>
              <p className="text-base leading-[1.65] text-[#78716C] mt-1">
                Click any marker on the map to view district demographic breakdown.
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-[#EAE6DF] text-[13px] text-[#78716C] flex items-center justify-between gap-2">
            <span>Center: Klang Valley (KL/Selangor)</span>
            <span className="text-[#78716C]">SDK: @vis.gl/react-google-maps</span>
          </div>
        </div>
      </div>
    </div>
  );
};
