import { NextResponse } from "next/server";
import { getMarketEngine } from "../../../../../../lib/engines.js";
import { TIMEFRAME_SECONDS, parseCandleParams, resampleCandles } from "../../../../../../lib/candles.js";

export async function GET(req, { params }) {
  const id = params.id;
  const base = getMarketEngine().rawCandles(id);
  if (!base) return new NextResponse("not found", { status: 404 });

  const { searchParams } = new URL(req.url);
  const parsed = parseCandleParams(searchParams);
  if ("error" in parsed) return new NextResponse(parsed.error, { status: 400 });

  const { timeframe, limit } = parsed;
  const candles = resampleCandles(base, TIMEFRAME_SECONDS[timeframe]).slice(-limit);

  return NextResponse.json({ market_id: id, timeframe, candles });
}
