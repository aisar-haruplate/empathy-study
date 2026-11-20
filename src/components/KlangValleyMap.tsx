import React, { useState, useEffect, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { MapPin, Users, ShoppingBag, ShieldCheck, HelpCircle, Filter, Sparkles, Navigation, Layers, ExternalLink } from 'lucide-react';
import { InterviewRecord } from '../types';
import { isAnalysisEligibleRecord } from '../lib/recordEligibility';

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
  const [selectedClusterKey, setSelectedClusterKey] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<'interviewVenue' | 'residence'>('interviewVenue');
  const [filterRole, setFilterRole] = useState<'all' | 'mummy' | 'elderly' | 'other'>('all');
  const [filterSpending, setFilterSpending] = useState<string>('all');

  // Fetch Maps API key from backend or env
  useEffect(() => {
    const envKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
    if (envKey && envKey.length > 5) {
      setApiKey(envKey);
      setLoadingKey(false);
      return;
    }

    fetch('/api/maps/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.apiKey) {
          setApiKey(data.apiKey);
        }
      })
      .catch((err) => console.warn('Could not load Maps config:', err))
      .finally(() => setLoadingKey(false));
  }, []);

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
          : 'bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col'
      }
    >
      {/* Top Map Header & Filters */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 to-stone-800 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <MapPin className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-base sm:text-lg text-white">
              Klang Valley Demographic Distribution Map
            </h3>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">
              Google Maps Platform
            </span>
          </div>
          <p className="text-xs text-stone-300">
            Geographic clustering of {eligibleRecords.length} study respondents across Kuala Lumpur, Kepong, Ampang, PJ & Subang.
          </p>
        </div>

        {/* Filter Controls & Location Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Location Mode Switcher (IL vs RL) */}
          <div className="flex items-center bg-stone-800/90 p-0.5 rounded-lg border border-stone-700 text-[11px]">
            <button
              type="button"
              onClick={() => setLocationMode('interviewVenue')}
              className={`px-2 py-1 rounded font-semibold cursor-pointer transition-all ${
                locationMode === 'interviewVenue'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Interview Venue (IL)
            </button>
            <button
              type="button"
              onClick={() => setLocationMode('residence')}
              className={`px-2 py-1 rounded font-semibold cursor-pointer transition-all ${
                locationMode === 'residence'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Residence (RL)
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-stone-800/90 border border-stone-700 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-stone-400 font-medium">Role:</span>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as any)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-stone-800 text-white">All Roles</option>
              <option value="mummy" className="bg-stone-800 text-white">Mummies Only</option>
              <option value="elderly" className="bg-stone-800 text-white">Elderly Only</option>
              <option value="other" className="bg-stone-800 text-white">Dads & Others</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-stone-800/90 border border-stone-700 rounded-lg px-2.5 py-1.5">
            <span className="text-stone-400 font-medium">Spending:</span>
            <select
              value={filterSpending}
              onChange={(e) => setFilterSpending(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-stone-800 text-white">All Tiers</option>
              <option value="High" className="bg-stone-800 text-white">High Tier</option>
              <option value="Medium-High" className="bg-stone-800 text-white">Medium-High</option>
              <option value="Medium" className="bg-stone-800 text-white">Medium</option>
              <option value="Low" className="bg-stone-800 text-white">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Map + District Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[500px]">
        {/* Google Map Viewport */}
        <div className="lg:col-span-2 relative h-[420px] lg:h-[540px] w-full bg-stone-100 border-b lg:border-b-0 lg:border-r border-stone-200">
          {apiKey ? (
            <APIProvider apiKey={apiKey}>
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
                  return (
                    <AdvancedMarker
                      key={cluster.key}
                      position={{ lat: cluster.lat, lng: cluster.lng }}
                      onClick={() => setSelectedClusterKey(cluster.key)}
                      title={`${cluster.displayName}: ${cluster.records.length} participants`}
                    >
                      <div
                        className={`group flex items-center gap-1 px-1.5 py-0.5 rounded-full shadow-md border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-300 ring-2 ring-amber-400/50 scale-105 z-30 shadow-amber-900/20'
                            : 'bg-stone-900/90 text-white border-stone-600 hover:bg-stone-900 hover:scale-105 z-10'
                        }`}
                      >
                        <MapPin className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                        <span className="font-bold text-[10px] tracking-tight truncate max-w-[55px]">
                          {cluster.displayName.split(' ')[0]}
                        </span>
                        <span className="min-w-3.5 h-3.5 px-0.5 rounded-full text-[9px] font-black bg-white text-stone-900 flex items-center justify-center shrink-0">
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
                    <div className="p-2 max-w-xs text-stone-800">
                      <div className="font-bold text-sm text-stone-900 mb-1 flex items-center justify-between">
                        <span>{selectedCluster.displayName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                          {selectedCluster.records.length} {selectedCluster.records.length === 1 ? 'person' : 'people'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mb-2">
                        Key respondents identified in this residential & venue zone.
                      </p>
                      <div className="space-y-1.5 border-t border-stone-200 pt-2 text-xs">
                        {selectedCluster.records.slice(0, 3).map((r) => {
                          const dec = r.adkotmDecode;
                          return (
                            <div key={r.id} className="bg-stone-50 p-1.5 rounded border border-stone-200">
                              <div className="font-medium text-stone-900 truncate">{r.fileName}</div>
                              <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-stone-50">
              <MapPin className="w-10 h-10 text-stone-400 mb-2 animate-bounce" />
              <p className="font-semibold text-stone-800 text-sm">
                {loadingKey ? 'Connecting to Google Maps Platform...' : 'Maps API is ready'}
              </p>
              <p className="text-xs text-stone-500 max-w-sm mt-1">
                Visualizing participant locations and shopping clusters across Klang Valley.
              </p>
            </div>
          )}

          {/* District Quick Bar Overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 overflow-x-auto pb-1 z-10 pointer-events-auto">
            {filteredClusters.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelectedClusterKey(c.key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm border transition-all ${
                  selectedCluster?.key === c.key
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-white/95 text-stone-700 border-stone-300 hover:bg-stone-100'
                }`}
              >
                {c.displayName}: {c.records.length}
              </button>
            ))}
          </div>
        </div>

        {/* Right Sidebar: Demographic Details of Selected District */}
        <div className="p-4 sm:p-5 flex flex-col justify-between bg-stone-50 h-[420px] lg:h-[540px] overflow-y-auto">
          {selectedCluster ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    Selected District
                  </span>
                  <span className="text-xs text-stone-500 font-mono">
                    {selectedCluster.lat.toFixed(4)}, {selectedCluster.lng.toFixed(4)}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-stone-900 mt-1">
                  {selectedCluster.displayName}
                </h4>
                <p className="text-xs text-stone-600 mt-0.5">
                  {selectedCluster.records.length} interview participants residing or interviewed here.
                </p>
              </div>

              {/* District Demographic Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                  <div className="text-stone-500 text-[11px]">Mummies</div>
                  <div className="text-base font-bold text-stone-800">
                    {
                      selectedCluster.records.filter((r) => {
                        const role = (r.adkotmDecode?.demographic?.familyRole || '').toLowerCase();
                        return role.includes('mum') || role.includes('mother');
                      }).length
                    }
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                  <div className="text-stone-500 text-[11px]">Elderly / Grandparents</div>
                  <div className="text-base font-bold text-stone-800">
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
                <div className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
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
                        className="bg-white p-3 rounded-xl border border-stone-200 text-xs shadow-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-900 truncate max-w-[140px]">{r.fileName}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              spending === 'High'
                                ? 'bg-emerald-100 text-emerald-800'
                                : spending === 'Medium-High'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {spending} Spending
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-stone-600">
                          <div>
                            <span className="text-stone-400">Role:</span> {demo?.familyRole || 'Mum'}
                          </div>
                          <div>
                            <span className="text-stone-400">Age:</span> {age}
                          </div>
                          <div className="col-span-2">
                            <span className="text-stone-400">Education:</span> {edu}
                          </div>
                        </div>
                        <div className="pt-1 border-t border-stone-100 text-[11px] flex items-center justify-between">
                          <span className="text-stone-500">Gut Awareness:</span>
                          <span
                            className={`font-semibold ${
                              aw === 'Aware' ? 'text-emerald-600' : 'text-amber-600'
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
              <MapPin className="w-8 h-8 text-stone-400 mb-2" />
              <p className="text-sm font-semibold text-stone-700">Select a Location Marker</p>
              <p className="text-xs text-stone-500 mt-1">
                Click any marker on the map to view district demographic breakdown.
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-stone-200 text-[11px] text-stone-500 flex items-center justify-between">
            <span>Center: Klang Valley (KL/Selangor)</span>
            <span className="text-stone-400">SDK: @vis.gl/react-google-maps</span>
          </div>
        </div>
      </div>
    </div>
  );
};
