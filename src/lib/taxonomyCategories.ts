export interface MacroCategoryMeta {
  id: string;
  name: string;
  color: string;
  description: string;
  keywords: string[];
}

export interface BrandMeta {
  brand: string;
  normalizedBrand: string;
  categoryId: string;
  categoryName: string;
  productType: string;
}

export const MACRO_CATEGORIES: MacroCategoryMeta[] = [
  {
    id: 'probiotics',
    name: 'probiotics',
    color: '#528BCA',
    description: 'probiotic products, supplements, yogurt, and their brands',
    keywords: [
      'probiotic', 'probiotics', 'bio gaia', 'yakult', 'vitagen', 'cultured milk',
      'lactobacillus', 'bifidobacterium', 'good bacteria', 'gut bacteria', 'kefir',
      'yogurt', 'yoghurt', 'greek yogurt', 'sunglo', 'emmi', 'farmers union',
      'chobani', 'marigold', 'nestle greek', 'supplement', 'fish oil', 'epicode',
      'episodo', 'amway', 'nutrilite', 'omega', 'multivitamin', 'vitamin', 'enzyme',
      'calcium', 'blackmores', 'swisse', 'scotts',
    ],
  },
  {
    id: 'fruits_vegetables',
    name: 'fruits & vegetables',
    color: '#96D6C7',
    description: 'fruits and vegetables, grouped without further breakdown',
    keywords: [
      'vegetable', 'vegetables', 'sayur', 'sayur-sayuran', 'sayuran', 'carrot',
      'broccoli', 'spinach', 'bayam', 'kangkung', 'sawi', 'salad', 'greens',
      'cucumber', 'tomato', 'cabbage', 'fruit', 'fruits', 'buah', 'buah-buahan',
      'apple', 'banana', 'pisang', 'papaya', 'betik', 'orange', 'prune', 'kiwi', 'berry',
    ],
  },
  {
    id: 'grains_staples',
    name: 'grains & carbohydrates',
    color: '#F7D147',
    description: 'grains and carbohydrates, grouped without further breakdown',
    keywords: [
      'oat', 'oats', 'oatmeal', 'rice', 'nasi', 'pasta', 'noodle', 'noodles',
      'bread', 'roti', 'porridge', 'congee', 'bubur', 'cereal',
    ],
  },
];

export const KNOWN_BRANDS: BrandMeta[] = [
  { brand: 'Bio Gaia', normalizedBrand: 'bio gaia', categoryId: 'probiotics', categoryName: 'probiotic', productType: 'Probiotic drops / chewable tablets' },
  { brand: 'Yakult', normalizedBrand: 'yakult', categoryId: 'probiotics', categoryName: 'probiotic', productType: 'Cultured probiotic milk drink' },
  { brand: 'Vitagen', normalizedBrand: 'vitagen', categoryId: 'probiotics', categoryName: 'probiotic', productType: 'Cultured milk drink with live probiotic cultures' },
  { brand: 'Nutrilite Probiotic', normalizedBrand: 'nutrilite probiotic', categoryId: 'probiotics', categoryName: 'probiotic', productType: 'Probiotic sachets' },
  { brand: 'Life-Space', normalizedBrand: 'life-space', categoryId: 'probiotics', categoryName: 'probiotic', productType: 'Probiotic capsules' },
  { brand: 'Sunglo', normalizedBrand: 'sunglo', categoryId: 'probiotics', categoryName: 'yogurt', productType: 'Cultured fresh yogurt' },
  { brand: 'Emmi', normalizedBrand: 'emmi', categoryId: 'probiotics', categoryName: 'yogurt', productType: 'Greek and fruit yogurt' },
  { brand: 'Farmers Union', normalizedBrand: 'farmers union', categoryId: 'probiotics', categoryName: 'yogurt', productType: 'Greek style yogurt' },
  { brand: 'Chobani', normalizedBrand: 'chobani', categoryId: 'probiotics', categoryName: 'yogurt', productType: 'Greek yogurt' },
  { brand: 'Marigold', normalizedBrand: 'marigold', categoryId: 'probiotics', categoryName: 'yogurt', productType: 'Yogurt and yogurt drinks' },
  { brand: 'Nestle Greek', normalizedBrand: 'nestle greek', categoryId: 'probiotics', categoryName: 'yogurt', productType: 'Greek yogurt' },
  { brand: 'Amway / Nutrilite', normalizedBrand: 'amway', categoryId: 'probiotics', categoryName: 'supplement', productType: 'Dietary supplement' },
  { brand: 'Nutrilite', normalizedBrand: 'nutrilite', categoryId: 'probiotics', categoryName: 'supplement', productType: 'Nutritional supplement' },
  { brand: 'Epicode Fish Oil', normalizedBrand: 'epicode', categoryId: 'probiotics', categoryName: 'supplement', productType: 'Fish oil supplement' },
  { brand: 'Episodo', normalizedBrand: 'episodo', categoryId: 'probiotics', categoryName: 'supplement', productType: 'Fish oil supplement' },
  { brand: 'Blackmores', normalizedBrand: 'blackmores', categoryId: 'probiotics', categoryName: 'supplement', productType: 'Dietary supplement' },
  { brand: 'Swisse', normalizedBrand: 'swisse', categoryId: 'probiotics', categoryName: 'supplement', productType: 'Vitamin and enzyme supplement' },
  { brand: "Scott's", normalizedBrand: 'scotts', categoryId: 'probiotics', categoryName: 'supplement', productType: 'Cod liver oil supplement' },
];

export const TRANSLATION_MAP: Record<string, string> = {
  'sayur-sayuran': 'vegetables', sayur: 'vegetables', sayuran: 'vegetables',
  'buah-buahan': 'fruits', buah: 'fruits', 'air suam': 'warm water', 'air panas': 'warm water',
  susu: 'milk', 'susu kambing': 'goat milk', nasi: 'rice', ikan: 'fish', ayam: 'chicken',
  daging: 'meat', telur: 'eggs', roti: 'bread', kacang: 'beans', bubur: 'porridge',
  ubat: 'medicine', makan: 'eat', minum: 'drink', bayam: 'spinach', pisang: 'banana',
  betik: 'papaya', pedas: 'spicy food', tofu: 'tofu (bean curd)', doufu: 'tofu (bean curd)',
  toufu: 'tofu (bean curd)', tauhu: 'tofu (bean curd)', 'liang cha': 'herbal tea',
  liangcha: 'herbal tea', bao: 'steamed bun', congee: 'porridge',
};

export const normalizeQualitativeToken = (text: string): string => {
  if (!text) return '';
  let normalized = text.trim().toLowerCase().replace(/^['"\[]+|['"\]]+$/g, '');
  const entries = Object.entries(TRANSLATION_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [source, target] of entries) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), target);
  }
  return normalized.trim();
};

export const classifyBrandToCategory = (
  rawBrand: string
): { brandName: string; categoryId: string; categoryName: string; productType: string } => {
  const normalized = normalizeQualitativeToken(rawBrand);
  const known = KNOWN_BRANDS.find((brand) => normalized.includes(brand.normalizedBrand));
  if (known) {
    return { brandName: known.brand, categoryId: known.categoryId, categoryName: known.categoryName, productType: known.productType };
  }
  return { brandName: rawBrand, categoryId: '', categoryName: 'unclassified', productType: 'Unclassified brand' };
};

export const getBrandsForCategory = (categoryId: string): BrandMeta[] =>
  KNOWN_BRANDS.filter((brand) => brand.categoryId === categoryId);

export const classifyMacroCategory = (
  rawToken: string
): { macroId: string; macroName: string; specificItem: string } => {
  const normalized = normalizeQualitativeToken(rawToken);
  const knownBrand = KNOWN_BRANDS.find((brand) => normalized.includes(brand.normalizedBrand));
  if (knownBrand) {
    return { macroId: 'probiotics', macroName: 'probiotics', specificItem: normalized };
  }

  if (MACRO_CATEGORIES[1].keywords.some((keyword) => normalized.includes(keyword))) {
    return { macroId: 'fruits_vegetables', macroName: 'fruits & vegetables', specificItem: 'fruits & vegetables' };
  }
  if (MACRO_CATEGORIES[2].keywords.some((keyword) => normalized.includes(keyword))) {
    return { macroId: 'grains_staples', macroName: 'grains & carbohydrates', specificItem: 'grains & carbohydrates' };
  }
  if (MACRO_CATEGORIES[0].keywords.some((keyword) => normalized.includes(keyword))) {
    return { macroId: 'probiotics', macroName: 'probiotics', specificItem: normalized };
  }
  return { macroId: '', macroName: 'unclassified', specificItem: normalized };
};
