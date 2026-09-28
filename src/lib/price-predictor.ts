export type PriceSignal = {
  currentPrice: number;
  previousPrice?: number | null;
  expectedPoints?: number | null;
};

export type PricePrediction = {
  expectedDelta: number;
  probabilityRise: number;
  probabilityFlat: number;
  probabilityFall: number;
  confidence: number;
  rationale: string[];
  modelVersion: string;
};

const clamp = (n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

export function predictPrice(signal: PriceSignal): PricePrediction {
  const rationale:string[]=[];
  const previous = signal.previousPrice ?? signal.currentPrice;
  const lastDelta = signal.currentPrice - previous;
  const pts = signal.expectedPoints ?? 0;

  const trendScore = clamp(0.5 + lastDelta / 1.2, 0.05, 0.95);
  const pointsScore = clamp(0.5 + pts / 80, 0.05, 0.95);
  const riseRaw = clamp(0.45 * trendScore + 0.55 * pointsScore, 0.05, 0.9);
  const fallRaw = clamp(0.45 * (1 - trendScore) + 0.35 * (1 - pointsScore), 0.05, 0.8);
  const flatRaw = 0.35;
  const total = riseRaw + fallRaw + flatRaw;

  const probabilityRise = riseRaw / total;
  const probabilityFlat = flatRaw / total;
  const probabilityFall = fallRaw / total;
  const directional = probabilityRise - probabilityFall;
  const expectedDelta = Math.round((directional * 0.6 + lastDelta * 0.35) * 10) / 10;
  const confidence = clamp(Math.abs(directional) + Math.min(Math.abs(lastDelta), 0.6) / 2, 0.15, 0.85);

  if (Math.abs(lastDelta) >= 0.1) rationale.push(`Recent price move: ${lastDelta > 0 ? '+' : ''}${lastDelta.toFixed(1)}M`);
  if (signal.expectedPoints != null) rationale.push(`Expected fantasy points input: ${pts.toFixed(1)}`);
  rationale.push('Heuristic v0.1: combines recent price momentum and user/model expected points');
  rationale.push('Not an official F1 Fantasy price formula');

  return {expectedDelta, probabilityRise, probabilityFlat, probabilityFall, confidence, rationale, modelVersion:'heuristic-price-v0.1'};
}
