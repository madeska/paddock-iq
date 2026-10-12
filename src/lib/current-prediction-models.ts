export const CURRENT_DRIVER_MODEL='xpts-driver-baseline75-component25-prelock-v3 + price-probability-v0.4-bounded';
export const CURRENT_CONSTRUCTOR_MODEL='xpts-constructor-baseline75-component25-prelock-v5 + price-probability-v0.4-bounded';
export const MAIN_MODELS=[
  CURRENT_DRIVER_MODEL,
  CURRENT_CONSTRUCTOR_MODEL,
  'xpts-driver-baseline75-component25-practice-v2 + price-probability-v0.4-bounded',
  'xpts-driver-baseline75-component25-v2 + price-probability-v0.4-bounded',
  'xpts-constructor-baseline75-component25-v4 + price-probability-v0.4-bounded',
 'xpts-constructor-baseline75-component25-v3 + price-probability-v0.4-bounded',
  'xpts-constructor-baseline75-component25-v2 + price-probability-v0.4-bounded',
  'xpts-driver-baseline75-component25-practice-v1 + price-probability-v0.4-bounded',
  'xpts-driver-baseline75-component25-v1 + price-probability-v0.4-bounded',
  'xpts-constructor-baseline75-component25-v1 + price-probability-v0.4-bounded',
  'xpts-driver-ridge50-ewma50-practice-v2 + price-probability-v0.3-floor-aware',
  'xpts-driver-ridge50-ewma50-v2 + price-probability-v0.3-floor-aware',
  'xpts-constructor-ewma50-mean3-50-v2 + price-probability-v0.3-floor-aware',
  // Legacy fallbacks keep the market populated until the next projection refresh.
  'xpts-driver-ridge3-practice-v1 + price-probability-v0.3-floor-aware',
  'xpts-driver-ridge3-v1 + price-probability-v0.3-floor-aware',
  'xpts-constructor-hybrid-v1 + price-probability-v0.3-floor-aware',
];

export const BOOST_MODELS=[
  'xpts-driver-ridge50-boost-practice-v1',
  'xpts-driver-ridge50-boost-v1',
];

export const CURRENT_MODELS=[...MAIN_MODELS,...BOOST_MODELS];

