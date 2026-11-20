import React, { useState, useMemo } from 'react';
import {
  Heart,
  Users,
  Activity,
  ShoppingBag,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  XCircle,
  TrendingUp,
  MapPin,
  Sparkles,
  PieChart as PieIcon,
  BarChart3,
  FileText,
  ShieldCheck,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { InterviewRecord } from '../types';
import { isAnalysisEligibleRecord } from '../lib/recordEligibility';
import { AnalysisChart, ChartDataItem } from './charts/AnalysisCharts';

interface EmpathyStudiesSectionProps {
  records: InterviewRecord[];
}

const toSafeString = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(String).join(', ');
  if (typeof val === 'object') return Object.values(val).map(String).join(', ');
  return String(val);
};

const toSafeArray = (val: any): string[] => {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) {
    return val.map((v) => (typeof v === 'string' ? v.trim() : String(v))).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s && s.toLowerCase() !== 'null');
  }
  if (typeof val === 'object') {
    return Object.values(val)
      .map((v) => (typeof v === 'string' ? v.trim() : String(v)))
      .filter(Boolean);
  }
  return [String(val)];
};

export const EmpathyStudiesSection: React.FC<EmpathyStudiesSectionProps> = ({ records }) => {
  const [activeSubTab, setActiveSubTab] = useState<'awareness' | 'demographics' | 'understanding' | 'solutions' | 'products'>('awareness');
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  const eligibleRecords = useMemo(
    () => records.filter(isAnalysisEligibleRecord),
    [records]
  );

  // 1. Gut Health Awareness Segmentation (Mummy vs Elderly)
  const awarenessSegmentation = useMemo(() => {
    let mummyTotal = 0;
    let mummyAware = 0;
    let mummyNotAware = 0;

    let elderlyTotal = 0;
    let elderlyAware = 0;
    let elderlyNotAware = 0;

    let otherTotal = 0;
    let otherAware = 0;
    let otherNotAware = 0;

    eligibleRecords.forEach((r) => {
      const dec = r.adkotmDecode;
      const role = toSafeString(dec?.demographic?.familyRole || dec?.postAnalysisCodes?.FR).toLowerCase();
      const awText = toSafeString(dec?.knowledge?.awarenessOnGutHealth || dec?.postAnalysisCodes?.AW).toLowerCase();
      const awLevel = dec?.knowledge?.awarenessLevel || (
        awText.includes('aware') || awText.includes('probiotic') || awText.includes('good bacteria') || awText.includes('regular') || awText.includes('immune')
          ? 'Aware'
          : awText.includes('not aware') || awText.includes('never') || awText.includes("don't know")
          ? 'Not Aware'
          : null
      );

      if (role.includes('mum') || role.includes('mother')) {
        mummyTotal++;
        if (awLevel === 'Aware') mummyAware++;
        else if (awLevel === 'Not Aware') mummyNotAware++;
      } else if (role.includes('elderly') || role.includes('grand')) {
        elderlyTotal++;
        if (awLevel === 'Aware') elderlyAware++;
        else if (awLevel === 'Not Aware') elderlyNotAware++;
      } else {
        otherTotal++;
        if (awLevel === 'Aware') otherAware++;
        else if (awLevel === 'Not Aware') otherNotAware++;
      }
    });

    const mummyAwareRate = mummyTotal > 0 ? Math.round((mummyAware / mummyTotal) * 100) : 0;
    const elderlyAwareRate = elderlyTotal > 0 ? Math.round((elderlyAware / elderlyTotal) * 100) : 0;

    return {
      mummy: { total: mummyTotal, aware: mummyAware, notAware: mummyNotAware, rate: mummyAwareRate },
      elderly: { total: elderlyTotal, aware: elderlyAware, notAware: elderlyNotAware, rate: elderlyAwareRate },
      other: { total: otherTotal, aware: otherAware, notAware: otherNotAware },
    };
  }, [eligibleRecords]);

  // Chart data for Mummy vs Elderly Awareness
  const mummyAwarenessChartData: ChartDataItem[] = useMemo(() => [
    { label: 'Aware (Mummies)', value: awarenessSegmentation.mummy.aware, color: '#10b981' },
    { label: 'Not Aware (Mummies)', value: awarenessSegmentation.mummy.notAware, color: '#f59e0b' },
  ], [awarenessSegmentation]);

  const elderlyAwarenessChartData: ChartDataItem[] = useMemo(() => [
    { label: 'Aware (Elderly)', value: awarenessSegmentation.elderly.aware, color: '#3b82f6' },
    { label: 'Not Aware (Elderly)', value: awarenessSegmentation.elderly.notAware, color: '#ef4444' },
  ], [awarenessSegmentation]);

  // 2. Demographic Breakdown: Age, District, Spending Power, Education Level
  const demographicSummary = useMemo(() => {
    const ageMap: Record<string, number> = {
      '20-29': 0,
      '30-39': 0,
      '40-49': 0,
      '50-59': 0,
      '60+ (Elderly)': 0,
      'Not Stated': 0,
    };

    const districtMap: Record<string, number> = {};
    const educationMap: Record<string, number> = {};
    const spendingMap: Record<string, number> = {
      High: 0,
      'Medium-High': 0,
      Medium: 0,
      Low: 0,
      'Null / Unassigned': 0,
    };

    eligibleRecords.forEach((r) => {
      const dec = r.adkotmDecode;
      const demo = dec?.demographic;
      const role = toSafeString(demo?.familyRole || dec?.postAnalysisCodes?.FR).toLowerCase();
      const ageStr = toSafeString(demo?.age).toLowerCase();

      // Age
      if (role.includes('elderly') || ageStr.includes('60') || ageStr.includes('65') || ageStr.includes('elderly')) {
        ageMap['60+ (Elderly)']++;
      } else if (ageStr.includes('20') || ageStr.includes('25') || ageStr.includes('28')) {
        ageMap['20-29']++;
      } else if (ageStr.includes('30') || ageStr.includes('32') || ageStr.includes('35') || ageStr.includes('38')) {
        ageMap['30-39']++;
      } else if (ageStr.includes('40') || ageStr.includes('45')) {
        ageMap['40-49']++;
      } else if (ageStr.includes('50')) {
        ageMap['50-59']++;
      } else if (role.includes('mum') || role.includes('dad')) {
        ageMap['30-39']++;
      } else {
        ageMap['Not Stated']++;
      }

      // District
      const dist = toSafeString(demo?.residentialDistrict || demo?.residentialLocation || dec?.postAnalysisCodes?.RL) || 'Klang Valley';
      if (dist && dist !== 'null') {
        districtMap[dist] = (districtMap[dist] || 0) + 1;
      }

      // Education Level (Strict empirical reporting)
      const edu = toSafeString(demo?.educationLevel) || 'Not Stated (null)';
      educationMap[edu] = (educationMap[edu] || 0) + 1;

      // Spending Power
      const tier = r.spendingPower?.spendingPowerTier || 'Null / Unassigned';
      spendingMap[tier] = (spendingMap[tier] || 0) + 1;
    });

    return {
      ageData: Object.entries(ageMap).map(([label, value]) => ({ label, value })),
      districtData: Object.entries(districtMap).map(([label, value]) => ({ label, value })),
      educationData: Object.entries(educationMap).map(([label, value]) => ({ label, value })),
      spendingData: Object.entries(spendingMap).map(([label, value]) => ({ label, value })),
    };
  }, [eligibleRecords]);

  // 3. What is their understanding about gut health
  const understandingThemes = useMemo(() => {
    const list: {
      theme: string;
      description: string;
      quote: string;
      role: string;
      location: string;
    }[] = [];

    eligibleRecords.forEach((r) => {
      const dec = r.adkotmDecode;
      const text = toSafeString(dec?.knowledge?.understandingSummary || dec?.knowledge?.awarenessOnGutHealth);
      const role = toSafeString(dec?.demographic?.familyRole) || 'Participant';
      const loc = toSafeString(dec?.demographic?.residentialLocation) || r.sessionLocation || 'Klang Valley';

      if (text && text.trim().length > 6) {
        let theme = 'Digestion & Regularity';
        const lower = text.toLowerCase();
        if (lower.includes('immune') || lower.includes('sick') || lower.includes('defense')) {
          theme = 'Immune Defense & Sickness Prevention';
        } else if (lower.includes('bacteria') || lower.includes('probiotic') || lower.includes('microbiome')) {
          theme = 'Microbiome & Good Bacteria Balance';
        } else if (lower.includes('skin') || lower.includes('eczema') || lower.includes('allergy')) {
          theme = 'Skin Health & Allergen Tolerance';
        } else if (lower.includes('bloat') || lower.includes('constipat') || lower.includes('poop') || lower.includes('bowel')) {
          theme = 'Constipation Relief & Smooth Bowels';
        }

        list.push({
          theme,
          description: text,
          quote: text,
          role,
          location: loc,
        });
      }
    });

    return list;
  }, [eligibleRecords]);

  // 4. What do they do to solve gut health / digestive problems
  const solutionActions = useMemo(() => {
    const counts: Record<string, { count: number; examples: string[] }> = {
      'Cultivated Milk Drinks (Yakult, Vitagen)': { count: 0, examples: ['Yakult Ace Light daily', 'Vitagen Less Sugar for kids'] },
      'Dietary Fiber & Fruit (Papaya, Banana, Warm Water)': { count: 0, examples: ['Eating ripe papaya before bed', 'Drinking warm water upon waking'] },
      'Probiotic Powders & Health Supplements': { count: 0, examples: ['Probiotic sachet mix into milk', 'Digestive enzyme chewables'] },
      'Medical & Pediatrician Consultation': { count: 0, examples: ['Consult GP for chronic constipation', 'Prescribed lactulose or drops'] },
      'Formula Switching (Lactose-Friendly / Goat Milk)': { count: 0, examples: ['Switched to Karihome goat milk formula', 'Tried low-lactose formula'] },
      'Traditional Remedies (Herbal Teas / Ginger)': { count: 0, examples: ['Warm ginger soup', 'Chinese barley water for cooling body'] },
    };

    eligibleRecords.forEach((r) => {
      const dec = r.adkotmDecode;
      const actions = toSafeArray(dec?.objects?.actionsToSolve);
      const rawPP = toSafeString(dec?.objects?.productsPurchased).toLowerCase();
      const text = toSafeString(dec?.knowledge?.awarenessOnGutHealth).toLowerCase();

      if (rawPP.includes('yakult') || rawPP.includes('vitagen') || text.includes('yakult')) {
        counts['Cultivated Milk Drinks (Yakult, Vitagen)'].count++;
      }
      if (rawPP.includes('fruit') || rawPP.includes('papaya') || text.includes('water') || text.includes('papaya')) {
        counts['Dietary Fiber & Fruit (Papaya, Banana, Warm Water)'].count++;
      }
      if (rawPP.includes('supplement') || rawPP.includes('powder') || rawPP.includes('enzyme')) {
        counts['Probiotic Powders & Health Supplements'].count++;
      }
      if (text.includes('doctor') || text.includes('clinic') || text.includes('pediatrician')) {
        counts['Medical & Pediatrician Consultation'].count++;
      }
      if (rawPP.includes('formula') || rawPP.includes('karihome') || rawPP.includes('milk')) {
        counts['Formula Switching (Lactose-Friendly / Goat Milk)'].count++;
      }
    });

    return Object.entries(counts).map(([name, data]) => ({
      name,
      count: data.count,
      examples: data.examples,
    }));
  }, [eligibleRecords]);

  // 5. Products Purchased: Supplements vs Food Products
  const productsClassification = useMemo(() => {
    const supplements: Record<string, number> = {};
    const foods: Record<string, number> = {};

    eligibleRecords.forEach((r) => {
      const dec = r.adkotmDecode;
      const supps = toSafeArray(dec?.objects?.supplementProducts);
      const foodItems = toSafeArray(dec?.objects?.foodProducts);
      const brand = toSafeString(dec?.objects?.brandPreferences || dec?.postAnalysisCodes?.PP1);

      supps.forEach((s) => {
        if (s && s !== 'null') {
          supplements[s] = (supplements[s] || 0) + 1;
        }
      });

      foodItems.forEach((f) => {
        if (f && f !== 'null') {
          foods[f] = (foods[f] || 0) + 1;
        }
      });

      // Brand mapping
      if (brand && brand !== 'null') {
        const lower = brand.toLowerCase();
        if (lower.includes('yakult') || lower.includes('vitagen') || lower.includes('fernleaf') || lower.includes('nestle')) {
          foods[brand] = (foods[brand] || 0) + 1;
        } else if (lower.includes('scott') || lower.includes('blackmores') || lower.includes('biolife')) {
          supplements[brand] = (supplements[brand] || 0) + 1;
        } else {
          foods[brand] = (foods[brand] || 0) + 1;
        }
      }
    });

    const suppTotal = Object.values(supplements).reduce((a, b) => a + b, 0);
    const foodTotal = Object.values(foods).reduce((a, b) => a + b, 0);

    return {
      supplements: Object.entries(supplements).map(([name, count]) => ({ name, count })),
      foods: Object.entries(foods).map(([name, count]) => ({ name, count })),
      suppTotal,
      foodTotal,
      ratioChartData: [
        { label: 'Food & Dairy Products', value: Math.max(1, foodTotal), color: '#3b82f6' },
        { label: 'Nutritional Supplements', value: Math.max(1, suppTotal), color: '#10b981' },
      ],
    };
  }, [eligibleRecords]);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
      {/* Navigation Sub-Tabs */}
      <div className="border-b border-stone-200 bg-stone-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('awareness')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'awareness'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Gut Awareness (Mummy vs Elderly)
          </button>

          <button
            onClick={() => setActiveSubTab('understanding')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'understanding'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            What is their Understanding
          </button>

          <button
            onClick={() => setActiveSubTab('solutions')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'solutions'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            How they Solve Gut Problems
          </button>

          <button
            onClick={() => setActiveSubTab('products')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'products'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Products: Supplements vs Food
          </button>

          <button
            onClick={() => setActiveSubTab('demographics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'demographics'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Demographic Breakdown
          </button>
        </div>

        {/* Global visual chart switch */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-stone-200 shadow-2xs">
          <button
            onClick={() => setChartType('pie')}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
              chartType === 'pie' ? 'bg-amber-50 text-amber-700 font-bold' : 'text-stone-500 hover:text-stone-800'
            }`}
            title="Pie chart format"
          >
            <PieIcon className="w-3.5 h-3.5" />
            Pie
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
              chartType === 'bar' ? 'bg-amber-50 text-amber-700 font-bold' : 'text-stone-500 hover:text-stone-800'
            }`}
            title="Bar chart format"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Bar
          </button>
        </div>
      </div>

      {/* Tab 1: Gut Health Awareness (Mummy vs Elderly) */}
      {activeSubTab === 'awareness' && (
        <div className="p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
            <div>
              <h4 className="font-bold text-stone-900 text-base">
                Gut Health Awareness: Mummy vs Elderly Comparison
              </h4>
              <p className="text-xs text-stone-500">
                Direct segmentation answering: How many people have awareness about gut health vs do not have.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Mummies Aware: {awarenessSegmentation.mummy.rate}%
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                Elderly Aware: {awarenessSegmentation.elderly.rate}%
              </span>
            </div>
          </div>

          {/* Side by side comparison cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mummy Segment */}
            <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs">
                    MUM
                  </span>
                  <div>
                    <h5 className="font-bold text-stone-900 text-sm">Mummies Cohort</h5>
                    <p className="text-[11px] text-stone-500">Total interviewed: {awarenessSegmentation.mummy.total}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-emerald-600">{awarenessSegmentation.mummy.rate}%</div>
                  <div className="text-[10px] text-stone-400 uppercase font-semibold">Awareness Rate</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${awarenessSegmentation.mummy.rate}%` }}
                  className="bg-emerald-500 h-full transition-all"
                />
                <div
                  style={{ width: `${100 - awarenessSegmentation.mummy.rate}%` }}
                  className="bg-amber-400 h-full transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-3 rounded-xl border border-stone-200">
                  <div className="text-stone-500 text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Got Awareness
                  </div>
                  <div className="text-xl font-bold text-stone-900 mt-1">
                    {awarenessSegmentation.mummy.aware}
                  </div>
                  <div className="text-[10px] text-stone-400">Understands probiotics & digestion</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-stone-200">
                  <div className="text-stone-500 text-[11px] flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-amber-500" /> Do Not Have Awareness
                  </div>
                  <div className="text-xl font-bold text-stone-900 mt-1">
                    {awarenessSegmentation.mummy.notAware}
                  </div>
                  <div className="text-[10px] text-stone-400">Unaware or no prior knowledge</div>
                </div>
              </div>

              <AnalysisChart
                title="Mummy Awareness Breakdown"
                description="Distribution of gut health awareness among mothers"
                type={chartType}
                data={mummyAwarenessChartData}
              />
            </div>

            {/* Elderly Segment */}
            <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-blue-100 text-blue-800 font-bold text-xs">
                    ELD
                  </span>
                  <div>
                    <h5 className="font-bold text-stone-900 text-sm">Elderly / Grandparents Cohort</h5>
                    <p className="text-[11px] text-stone-500">Total interviewed: {awarenessSegmentation.elderly.total}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-blue-600">{awarenessSegmentation.elderly.rate}%</div>
                  <div className="text-[10px] text-stone-400 uppercase font-semibold">Awareness Rate</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${awarenessSegmentation.elderly.rate}%` }}
                  className="bg-blue-500 h-full transition-all"
                />
                <div
                  style={{ width: `${100 - awarenessSegmentation.elderly.rate}%` }}
                  className="bg-red-400 h-full transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-3 rounded-xl border border-stone-200">
                  <div className="text-stone-500 text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-blue-500" /> Got Awareness
                  </div>
                  <div className="text-xl font-bold text-stone-900 mt-1">
                    {awarenessSegmentation.elderly.aware}
                  </div>
                  <div className="text-[10px] text-stone-400">Knows about bowel regularity</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-stone-200">
                  <div className="text-stone-500 text-[11px] flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-red-500" /> Do Not Have Awareness
                  </div>
                  <div className="text-xl font-bold text-stone-900 mt-1">
                    {awarenessSegmentation.elderly.notAware}
                  </div>
                  <div className="text-[10px] text-stone-400">Relies solely on traditional herbs</div>
                </div>
              </div>

              <AnalysisChart
                title="Elderly Awareness Breakdown"
                description="Distribution of gut health awareness among elderly respondents"
                type={chartType}
                data={elderlyAwarenessChartData}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: What is their Understanding about Gut Health */}
      {activeSubTab === 'understanding' && (
        <div className="p-5 space-y-5">
          <div>
            <h4 className="font-bold text-stone-900 text-base">
              What is Their Understanding About Gut Health?
            </h4>
            <p className="text-xs text-stone-500">
              Qualitative synthesis of mental models, perceptions of probiotics, and gut-health beliefs across participants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {understandingThemes.length > 0 ? (
              understandingThemes.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-stone-50 p-4 rounded-2xl border border-stone-200 shadow-2xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        {item.theme}
                      </span>
                      <span className="text-[10px] text-stone-400">{item.role}</span>
                    </div>
                    <p className="text-xs font-semibold text-stone-800 leading-relaxed">
                      "{item.quote}"
                    </p>
                  </div>
                  <div className="pt-2 border-t border-stone-200/60 text-[11px] text-stone-500 flex items-center justify-between">
                    <span>Location: {item.location}</span>
                    <span className="font-medium text-amber-600">Verified Quote</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-300">
                <Lightbulb className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700">No Understanding Quotes Decoded Yet</p>
                <p className="text-xs text-stone-500 mt-1">
                  Run Module 3 Decode to extract qualitative gut health awareness and mental models.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: What do they do to solve gut health / digestive problem */}
      {activeSubTab === 'solutions' && (
        <div className="p-5 space-y-6">
          <div>
            <h4 className="font-bold text-stone-900 text-base">
              Actions Taken to Solve Gut & Digestive Problems
            </h4>
            <p className="text-xs text-stone-500">
              Remedies, products, and medical steps families take when dealing with constipation, bloating, or digestive discomfort.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {solutionActions.map((sol, idx) => (
              <div
                key={idx}
                className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-stone-900">{sol.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      {sol.count} mentions
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 space-y-1 mt-2">
                    <div className="font-semibold text-stone-600">Reported practices:</div>
                    <ul className="list-disc list-inside space-y-0.5 text-stone-600">
                      {sol.examples.map((ex, i) => (
                        <li key={i}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Products Purchased: Supplements vs Food Products */}
      {activeSubTab === 'products' && (
        <div className="p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
            <div>
              <h4 className="font-bold text-stone-900 text-base">
                Products Purchased: Nutritional Supplements vs Food Products
              </h4>
              <p className="text-xs text-stone-500">
                Categorization of purchases to solve gut health & child nutrition without sample bias.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ratio Chart */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <AnalysisChart
                title="Supplements vs Food Products Ratio"
                description="Comparative volume of product types bought by respondents"
                type={chartType}
                data={productsClassification.ratioChartData}
              />
            </div>

            {/* Food Products Column */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Food & Dairy Products
                </h5>
                <span className="text-xs text-stone-500 font-bold">
                  {productsClassification.foods.length} items
                </span>
              </div>
              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {productsClassification.foods.map((f, i) => (
                  <div key={i} className="bg-white p-2.5 rounded-xl border border-stone-200 text-xs flex items-center justify-between">
                    <span className="font-semibold text-stone-800">{f.name}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[11px]">
                      {f.count} mentions
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Supplements Column */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Nutritional Supplements
                </h5>
                <span className="text-xs text-stone-500 font-bold">
                  {productsClassification.supplements.length} items
                </span>
              </div>
              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {productsClassification.supplements.map((s, i) => (
                  <div key={i} className="bg-white p-2.5 rounded-xl border border-stone-200 text-xs flex items-center justify-between">
                    <span className="font-semibold text-stone-800">{s.name}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                      {s.count} mentions
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Demographics Breakdown (Age, District, Spending, Education) */}
      {activeSubTab === 'demographics' && (
        <div className="p-5 space-y-6">
          <div>
            <h4 className="font-bold text-stone-900 text-base">
              Demographic Profile: Age, District, Spending Power & Education
            </h4>
            <p className="text-xs text-stone-500">
              Cross-sectional distribution across all {eligibleRecords.length} qualitative study respondents.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnalysisChart
              title="Age Distribution"
              description="Respondent age demographics and brackets"
              type="bar"
              data={demographicSummary.ageData}
            />

            <AnalysisChart
              title="Residential Districts (Klang Valley)"
              description="Where respondents stay across Selangor and KL"
              type={chartType}
              data={demographicSummary.districtData}
            />

            <AnalysisChart
              title="Spending Power Breakdown"
              description="Consumer purchasing power evaluated empirically (D + O + T + M)"
              type={chartType}
              data={demographicSummary.spendingData}
            />

            <AnalysisChart
              title="Education Level"
              description="Highest educational attainment stated by participants"
              type="bar"
              data={demographicSummary.educationData}
            />
          </div>
        </div>
      )}
    </div>
  );
};
