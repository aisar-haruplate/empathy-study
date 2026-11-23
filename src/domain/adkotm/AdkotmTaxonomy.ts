import type { ADKOTMDimensionKey } from '../../types';
import { ADKOTM_PARAMETER_CATALOG } from '../../lib/adkotmCopilot';
import {
  classifyMacroCategory,
  KNOWN_BRANDS,
  MACRO_CATEGORIES,
} from '../../lib/taxonomyCategories';

export interface DimensionTheme {
  readonly key: ADKOTMDimensionKey;
  readonly label: string;
  readonly shortLabel: string;
  readonly accentHex: string;
  readonly tintHex: string;
  readonly inkHex: string;
  readonly highlightClass: string;
}

const DIMENSION_THEMES: Record<ADKOTMDimensionKey, DimensionTheme> = {
  A: {
    key: 'A',
    label: 'Activities',
    shortLabel: 'Activities (A)',
    accentHex: '#96D6C7',
    tintHex: '#F2FBF8',
    inkHex: '#1E4D42',
    highlightClass: 'adkotm-highlight adkotm-highlight--A',
  },
  D: {
    key: 'D',
    label: 'Demographics',
    shortLabel: 'Demographics (D)',
    accentHex: '#528BCA',
    tintHex: '#F2F7FC',
    inkHex: '#234B78',
    highlightClass: 'adkotm-highlight adkotm-highlight--D',
  },
  K: {
    key: 'K',
    label: 'Knowledge',
    shortLabel: 'Knowledge (K)',
    accentHex: '#F7D147',
    tintHex: '#FEFBEB',
    inkHex: '#6B5306',
    highlightClass: 'adkotm-highlight adkotm-highlight--K',
  },
  O: {
    key: 'O',
    label: 'Objects',
    shortLabel: 'Objects (O)',
    accentHex: '#F6BEBA',
    tintHex: '#FDF4F3',
    inkHex: '#7A3A36',
    highlightClass: 'adkotm-highlight adkotm-highlight--O',
  },
  T: {
    key: 'T',
    label: 'Time',
    shortLabel: 'Time (T)',
    accentHex: '#7C8CE0',
    tintHex: '#F3F5FD',
    inkHex: '#33418A',
    highlightClass: 'adkotm-highlight adkotm-highlight--T',
  },
  M: {
    key: 'M',
    label: 'Metadata',
    shortLabel: 'Metadata (M)',
    accentHex: '#EAE6DF',
    tintHex: '#F7F5F0',
    inkHex: '#57534E',
    highlightClass: 'adkotm-highlight adkotm-highlight--M',
  },
};

export const ADKOTM_DIMENSION_ORDER: readonly ADKOTMDimensionKey[] = ['A', 'D', 'K', 'O', 'T', 'M'];

/**
 * Domain service encapsulating ADKOTM dimension labels, color tokens,
 * parameter catalog queries, and product macro-category classification.
 */
export class AdkotmTaxonomy {
  getDimensionTheme(key: ADKOTMDimensionKey): DimensionTheme {
    return DIMENSION_THEMES[key];
  }

  getAllDimensions(): readonly DimensionTheme[] {
    return ADKOTM_DIMENSION_ORDER.map((k) => DIMENSION_THEMES[k]);
  }

  getParametersForDimension(key: ADKOTMDimensionKey) {
    return ADKOTM_PARAMETER_CATALOG.filter((p) => p.dimension === key);
  }

  classifyProduct(rawLabel: string) {
    return classifyMacroCategory(rawLabel);
  }

  getMacroCategories() {
    return MACRO_CATEGORIES;
  }

  getKnownBrands() {
    return KNOWN_BRANDS;
  }
}

export const defaultAdkotmTaxonomy = new AdkotmTaxonomy();
