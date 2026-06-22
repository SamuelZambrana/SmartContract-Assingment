"use client";

import { useMemo } from "react";
import { useMarketsStream } from "../../context/MarketsStreamContext";
import { usePaperTrade } from "../../context/PaperTradeContext";
import { TOKEN_ICONS } from "./tokenIcons";

function fmtPrice(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n < 0.01) return n.toFixed(8);
  if (n < 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtSigned(n: number, digits = 2) {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

function PortfolioTokenIcon({ symbol }: { symbol: string }) {
  const src = TOKEN_ICONS[symbol];
  if (!src) {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: "rgba(61,255,160,0.1)", color: "#3dffa0" }}>
        {symbol.slice(0, 2)}
      </div>
    );
  }
  return <img src={src} alt={symbol} width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-contain" loading="lazy" />;
}

/**
 * Portfolio panel for the Markets page.
 *
 * Lists the user's open paper-trade positions (persisted in localStorage via
 * PaperTradeContext) and shows the unrealised PnL, which updates in real time
 * because the mark prices come from the live MarketsStream WebSocket feed.
 */
export function PortfolioPanel() {
  const { positions, closePosition } = usePaperTrade();
  const { overview, connected } = useMarketsStream();

  const markById = useMemo(() => {
    const map = new Map<string, number>();
    overview?.markets.forEach((m) => map.set(m.id, m.mark_price));
    return map;
  }, [overview]);

  const rows = useMemo(
    () =>
      positions.map((p) => {
        const mark = markById.get(p.marketId) ?? p.entryPrice;
        const pnl =
          p.side === "long"
            ? (mark - p.entryPrice) * p.sizeBase
            : (p.entryPrice - mark) * p.sizeBase;
        const entryNotional = p.entryPrice * p.sizeBase;
        const pnlPct = entryNotional > 0 ? (pnl / entryNotional) * 100 : 0;
        const quote = p.pair.split("-")[1] ?? "USDT";
        const base = p.pair.split("-")[0] ?? p.pair;
        return { ...p, mark, pnl, pnlPct, quote, base };
      }),
    [positions, markById],
  );

  const totalPnl = useMemo(() => rows.reduce((s, r) => s + r.pnl, 0), [rows]);

  const cellHead = "px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap";

  return (
    <div className="mb-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Portfolio</h2>
          <span className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
            style={{ background: "rgba(61,255,160,0.1)", color: "#3dffa0", border: "1px solid rgba(61,255,160,0.2)" }}>
            {rows.length} open
          </span>
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse" : ""}`}
              style={{ background: connected ? "#3dffa0" : "rgba(255,255,255,0.25)" }} />
            {connected ? "Live PnL" : "Reconnecting…"}
          </span>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Unrealised PnL</span>
            <span className="font-mono text-sm font-bold tabular-nums" style={{ color: totalPnl >= 0 ? "#3dffa0" : "#ef5350" }}>
              {fmtSigned(totalPnl)}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          No open paper positions yet. Place an order from a market&apos;s trade page to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                <th className={`${cellHead} text-left`} style={{ color: "rgba(255,255,255,0.45)" }}>Market</th>
                <th className={`${cellHead} text-left`} style={{ color: "rgba(255,255,255,0.45)" }}>Side</th>
                <th className={`${cellHead} text-right`} style={{ color: "rgba(255,255,255,0.45)" }}>Size</th>
                <th className={`${cellHead} text-right`} style={{ color: "rgba(255,255,255,0.45)" }}>Entry</th>
                <th className={`${cellHead} text-right`} style={{ color: "rgba(255,255,255,0.45)" }}>Mark</th>
                <th className={`${cellHead} text-right`} style={{ color: "rgba(255,255,255,0.45)" }}>Unreal. PnL</th>
                <th className={`${cellHead} text-right`} style={{ color: "rgba(255,255,255,0.45)" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <PortfolioTokenIcon symbol={r.base} />
                      <span className="text-sm font-semibold text-white">{r.pair}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md px-2 py-0.5 text-xs font-semibold capitalize"
                      style={
                        r.side === "long"
                          ? { background: "rgba(61,255,160,0.12)", color: "#3dffa0" }
                          : { background: "rgba(239,83,80,0.12)", color: "#ef5350" }
                      }>
                      {r.side}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {r.sizeBase.toLocaleString(undefined, { maximumFractionDigits: 4 })} {r.base}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {fmtPrice(r.entryPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-white">
                    {fmtPrice(r.mark)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums font-semibold"
                    style={{ color: r.pnl >= 0 ? "#3dffa0" : "#ef5350" }}>
                    {fmtSigned(r.pnl, 4)} {r.quote}
                    <span className="ml-1 text-xs font-normal" style={{ color: r.pnl >= 0 ? "rgba(61,255,160,0.7)" : "rgba(239,83,80,0.7)" }}>
                      ({fmtSigned(r.pnlPct)}%)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => closePosition(r.id, r.mark)}
                      className="rounded-md border bg-transparent px-2.5 py-1 text-xs font-medium transition-colors"
                      style={{ borderColor: "rgba(61,255,160,0.3)", color: "#3dffa0" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(61,255,160,0.12)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      Close
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
