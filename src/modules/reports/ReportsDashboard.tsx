import { useState, useEffect, type CSSProperties } from "react";
import { EmptyState, Message, Options } from "../../shared/ui";
import { getSupabase } from "../../shared/supabase/client";
import { SalesHistory } from "./SalesHistory";
import { useBranch } from "../../shared/branch/BranchContext";
import { toSalesReportLines, buildSalesReport, type SalesReportRow } from "./salesReport";
import { dailyBars, percentOf } from "./reportCharts";
import { formatMoney } from "../pos/money";
import { formatDay } from "../../shared/format/date";

type Range = "7" | "30" | "90";
const bar = (percent: number) => ({ "--v": `${percent}%` }) as CSSProperties;

/**
 * Reportes (RF-61 a RF-64): ventas por día, los más vendidos y la demanda por rubro y por
 * etiqueta del rango elegido, de la sucursal elegida. Gráficos dibujados con CSS: una serie,
 * sin acento, cada barra con su valor en `title` y una tabla equivalente para lectores de pantalla.
 */
export function ReportsDashboard() {
  const [report, setReport] = useState(() => buildSalesReport([]));
  const [range, setRange] = useState<Range>("7");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { filterId: branchFilter, label: branchLabel } = useBranch();

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setLoading(true);
      setError(null);
      try {
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - (Number(range) - 1));

        const { data, error: queryError } = await getSupabase()
          .from("sale_items")
          .select(`
            quantity,
            unit_price,
            sale:sales!inner(occurred_at, status),
            presentation:product_presentations!inner(
              product:products!inner(id, name, category_id, category:categories(name), product_labels(label:labels(id, name)))
            )
          `)
          .gte("sales.occurred_at", startDate.toISOString())
          .eq("sales.status", "closed")
          // RF-70: reportes de la sucursal elegida; sin filtro = todas.
          .match(branchFilter ? { "sales.branch_id": branchFilter } : {});

        if (queryError) throw queryError;
        const nextReport = buildSalesReport(toSalesReportLines((data ?? []) as unknown as SalesReportRow[]));
        if (!cancelled) setReport(nextReport);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los reportes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReports();
    return () => { cancelled = true; };
  }, [range, branchFilter]);

  const days = Number(range);
  const { bars, ticks } = dailyBars(report.salesByDay, days);
  const dense = bars.length > 14;
  const topRevenue = report.productRanking[0]?.revenue ?? 0;

  return (
    <>
      <div className="fila reportes__cabecera">
        <p className="meta">{branchLabel} · total del rango <span className="cifra">{formatMoney(report.totalRevenue)}</span></p>
        <Options name="rango" legend="Rango de tiempo" variant="segmento" value={range} onChange={setRange}
          options={[{ value: "7", label: "7 días" }, { value: "30", label: "30 días" }, { value: "90", label: "90 días" }]} />
      </div>

      {error && <Message tone="error">{error}</Message>}

      <div className="reja-3-1" aria-busy={loading}>
        <section className="carta pila" aria-labelledby="ventas-dia">
          <h3 className="titulo-seccion" id="ventas-dia">Ventas diarias</h3>
          {report.totalRevenue === 0 && !loading ? (
            <EmptyState title="Sin ventas en este rango" icon="bar_chart" />
          ) : (
            <>
              <div className="barras" aria-hidden="true">
                <div className="barras__eje">
                  {ticks.map((t) => <span key={t.percent} style={{ bottom: `${t.percent}%` }}>{t.label}</span>)}
                </div>
                <div className="barras__area" style={dense ? { gap: 2 } : undefined}>
                  {ticks.filter((t) => t.percent > 0).map((t) => <span key={t.percent} className="barras__guia" style={{ bottom: `${t.percent}%` }} />)}
                  {bars.map((b) => (
                    <div key={b.day}
                      className={["barras__barra", b.highlight ? "barras__barra--destacada" : "", b.today ? "barras__barra--parcial" : ""].filter(Boolean).join(" ")}
                      style={bar(b.percent)} title={`${b.weekday} ${b.dayOfMonth}: ${formatMoney(b.total)}`}>
                      {b.highlight && !b.today && !dense ? <span className="barras__valor">{formatMoney(b.total)}</span> : null}
                      {b.today && !dense ? <span className="barras__valor">en curso</span> : null}
                    </div>
                  ))}
                </div>
                <div className="barras__dias" style={dense ? { gap: 2 } : undefined}>
                  {bars.map((b, i) => (
                    <span key={b.day}>{!dense || i % 7 === bars.length % 7 || b.today ? <>{b.weekday}<br /><span className="cifra">{b.dayOfMonth}</span></> : null}</span>
                  ))}
                </div>
              </div>
              {/* La tabla va dentro de un div .sr: una tabla no se deja achicar y desbordaba la página. */}
              <div className="sr">
                <table>
                  <caption>Ventas diarias</caption>
                  <tbody>{bars.map((b) => <tr key={b.day}><td>{formatDay(b.day)}</td><td>{formatMoney(b.total)}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="carta pila" aria-labelledby="top-10">
          <h3 className="titulo-seccion" id="top-10">Top 10 más vendidos</h3>
          {report.productRanking.length === 0 ? <p className="meta">Sin ventas en este rango.</p> : (
            <ol className="ranking">
              {report.productRanking.map((p, i) => (
                <li key={p.name}>
                  <span className="ranking__n">{i + 1}</span>
                  <span>{p.name}</span>
                  <span className="cifra">{formatMoney(p.revenue)}</span>
                  <span className="medidor" style={bar(percentOf(p.revenue, topRevenue))} aria-hidden="true"><span /></span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="reja-2">
        <section className="carta pila" aria-labelledby="demanda-rubro">
          <div className="fila fila--entre"><h3 className="titulo-seccion" id="demanda-rubro">Demanda por rubro</h3><span className="meta">% de las ventas</span></div>
          {report.categoryDemand.length === 0 ? <p className="meta">Sin ventas con rubro en este rango.</p> : (
            <ul className="barras-h">
              {report.categoryDemand.map((c) => {
                const share = percentOf(c.value, report.totalRevenue);
                return <li key={c.categoryId}><span>{c.name}</span><span className="pista"><span style={bar(share)} /></span><span className="cifra">{share} %</span></li>;
              })}
            </ul>
          )}
        </section>
        <section className="carta pila" aria-labelledby="demanda-etiqueta">
          <div className="fila fila--entre"><h3 className="titulo-seccion" id="demanda-etiqueta">Demanda por etiqueta</h3><span className="meta">una venta puede sumar a varias</span></div>
          {report.labelDemand.length === 0 ? <p className="meta">No hubo ventas de productos con etiquetas en este rango.</p> : (
            <ul className="barras-h">
              {report.labelDemand.map((l) => {
                const share = Math.round(l.share * 100);
                return <li key={l.labelId}><span>{l.name}</span><span className="pista"><span style={bar(share)} /></span><span className="cifra">{share} %</span></li>;
              })}
            </ul>
          )}
        </section>
      </div>

      <SalesHistory />
    </>
  );
}
