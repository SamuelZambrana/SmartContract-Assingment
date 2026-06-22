/**
 * OHLCV candle helpers for GET /api/v1/markets/:id/candles.
 *
 * The market engine stores a single base series per market (5-minute buckets).
 * This module validates the request params and resamples that base series into
 * the timeframe the caller asked for, keeping OHLCV integrity:
 *   - aggregation (target > base): merge consecutive base candles
 *   - subdivision (target < base): split each base candle into equal sub-candles
 */

/** Supported timeframes mapped to their length in seconds. */
export const TIMEFRAME_SECONDS = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
};

export const DEFAULT_TIMEFRAME = "5m";
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 500;

/**
 * Validate the query params for the candles endpoint.
 * @param {URLSearchParams} searchParams
 * @returns {{ timeframe: string, limit: number } | { error: string }}
 */
export function parseCandleParams(searchParams) {
  const tfRaw = searchParams.get("timeframe");
  const timeframe = (tfRaw ?? DEFAULT_TIMEFRAME).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(TIMEFRAME_SECONDS, timeframe)) {
    return {
      error: `invalid timeframe '${tfRaw}'; supported values: ${Object.keys(TIMEFRAME_SECONDS).join(", ")}`,
    };
  }

  const limitRaw = searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitRaw != null && limitRaw !== "") {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit <= 0) {
      return { error: "limit must be a positive integer" };
    }
    if (limit > MAX_LIMIT) {
      return { error: `limit must not exceed ${MAX_LIMIT}` };
    }
  }

  return { timeframe, limit };
}

/**
 * @param {{ t: number, o: number, h: number, l: number, c: number, v: number }} k
 */
function normalize(k) {
  return { t: k.t, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v };
}

/**
 * Merge consecutive base candles into coarser buckets (e.g. 5m → 15m / 1h).
 * @param {Array} base
 * @param {number} targetSec
 */
function aggregateUp(base, targetSec) {
  const out = [];
  let cur = null;
  for (const k of base) {
    const bucket = Math.floor(k.t / targetSec) * targetSec;
    if (!cur || cur.t !== bucket) {
      if (cur) out.push(cur);
      cur = { t: bucket, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v };
    } else {
      cur.h = Math.max(cur.h, k.h);
      cur.l = Math.min(cur.l, k.l);
      cur.c = k.c;
      cur.v += k.v;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Split each base candle into `baseSec / targetSec` finer candles (e.g. 5m → 1m).
 * The synthesised series preserves the parent's open, close, extremes and total
 * volume so the OHLCV stays internally consistent.
 * @param {Array} base
 * @param {number} targetSec
 * @param {number} baseSec
 */
function subdivideDown(base, targetSec, baseSec) {
  const n = Math.max(1, Math.round(baseSec / targetSec));
  if (n === 1) return base.map(normalize);

  const out = [];
  for (const k of base) {
    let prevClose = k.o;
    for (let i = 0; i < n; i++) {
      const o = prevClose;
      const c = k.o + (k.c - k.o) * ((i + 1) / n);
      let h = Math.max(o, c);
      let l = Math.min(o, c);
      // Surface the parent's high/low somewhere inside the sub-series.
      if (i === 1) h = Math.max(h, k.h);
      if (i === n - 2) l = Math.min(l, k.l);
      out.push({ t: k.t + i * targetSec, o, h, l, c, v: k.v / n });
      prevClose = c;
    }
  }
  return out;
}

/**
 * Resample a base candle series into the requested timeframe.
 * @param {Array} base   base candles ({ t, o, h, l, c, v }), ascending by t
 * @param {number} targetSec  requested timeframe length in seconds
 * @param {number} [baseSec]   base bucket length; inferred from data when omitted
 */
export function resampleCandles(base, targetSec, baseSec) {
  if (!Array.isArray(base) || base.length === 0) return [];
  const step =
    baseSec ?? (base.length >= 2 ? base[1].t - base[0].t : TIMEFRAME_SECONDS[DEFAULT_TIMEFRAME]);

  if (targetSec === step) return base.map(normalize);
  if (targetSec > step) return aggregateUp(base, targetSec);
  return subdivideDown(base, targetSec, step);
}
