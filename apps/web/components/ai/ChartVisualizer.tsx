"use client";
import { useState } from "react";
import { PieChart, BarChart3, LineChart, LayoutGrid, GitMerge, Download, RotateCcw } from "lucide-react";

export interface ChartDataPoint {
  label: string;
  value: number;
  unit?: string;
  color?: string;
  description?: string;
}

export interface ChartSpec {
  chart_type: "pie" | "bar" | "line" | "metric_grid" | "diagram";
  title: string;
  description?: string;
  data: ChartDataPoint[];
}

const DEFAULT_PALETTE = [
  "#22c55e", // Green
  "#0ea5e9", // Blue
  "#eab308", // Yellow
  "#f97316", // Orange
  "#ef4444", // Red
  "#a855f7", // Purple
  "#14b8a6", // Teal
  "#64748b", // Slate
];

export function ChartVisualizer({
  chart,
  onReset,
}: {
  chart: ChartSpec;
  onReset?: () => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = chart.data.reduce((sum, d) => sum + (d.value || 0), 0);
  const maxVal = Math.max(...chart.data.map(d => d.value || 0), 1);

  // Download chart data as JSON
  function downloadData() {
    const blob = new Blob([JSON.stringify(chart, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chart.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="vahan-chart-container" role="region" aria-label={chart.title}>
      <div className="vahan-chart-header">
        <div>
          <div className="vahan-chart-badge">
            {chart.chart_type === "pie" && <PieChart size={13} />}
            {chart.chart_type === "bar" && <BarChart3 size={13} />}
            {chart.chart_type === "line" && <LineChart size={13} />}
            {chart.chart_type === "metric_grid" && <LayoutGrid size={13} />}
            {chart.chart_type === "diagram" && <GitMerge size={13} />}
            <span>{chart.chart_type.toUpperCase()} VISUALIZATION</span>
          </div>
          <h2 className="vahan-chart-title">{chart.title}</h2>
          {chart.description && <p className="vahan-chart-desc">{chart.description}</p>}
        </div>
        <div className="vahan-chart-actions">
          <button className="vahan-btn-subtle" onClick={downloadData} title="Export data JSON">
            <Download size={13} />
            <span>Export</span>
          </button>
          {onReset && (
            <button className="vahan-btn-subtle" onClick={onReset} title="Clear chart">
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      <div className="vahan-chart-stage">
        {chart.chart_type === "pie" && (
          <PieRenderer data={chart.data} total={total} hoveredIdx={hoveredIdx} onHover={setHoveredIdx} />
        )}

        {chart.chart_type === "bar" && (
          <BarRenderer data={chart.data} maxVal={maxVal} hoveredIdx={hoveredIdx} onHover={setHoveredIdx} />
        )}

        {chart.chart_type === "line" && (
          <LineRenderer data={chart.data} maxVal={maxVal} hoveredIdx={hoveredIdx} onHover={setHoveredIdx} />
        )}

        {chart.chart_type === "metric_grid" && (
          <MetricGridRenderer data={chart.data} />
        )}

        {chart.chart_type === "diagram" && (
          <DiagramRenderer data={chart.data} />
        )}
      </div>

      <div className="vahan-chart-legend">
        {chart.data.map((d, i) => {
          const color = d.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
          return (
            <div
              key={d.label + i}
              className={`vahan-legend-item ${hoveredIdx === i ? "is-hovered" : ""}`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <span className="vahan-legend-swatch" style={{ backgroundColor: color }} />
              <span className="vahan-legend-label">{d.label}</span>
              <strong className="vahan-legend-val">
                {d.value.toLocaleString("en-IN")} {d.unit || ""}
              </strong>
              {chart.chart_type === "pie" && (
                <span className="vahan-legend-pct">({pct}%)</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Pie / Donut Renderer ──────────────────────────────────────────────────────────
function PieRenderer({
  data,
  total,
  hoveredIdx,
  onHover,
}: {
  data: ChartDataPoint[];
  total: number;
  hoveredIdx: number | null;
  onHover: (i: number | null) => void;
}) {
  const size = 260;
  const strokeWidth = 42;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  return (
    <div className="vahan-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="vahan-donut-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ref-border, #e2e8f0)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        {data.map((d, i) => {
          const color = d.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
          const ratio = total > 0 ? d.value / total : 0;
          const strokeDash = ratio * circumference;
          const strokeOffset = -accumulated * circumference;
          accumulated += ratio;
          const isHovered = hoveredIdx === i;

          return (
            <circle
              key={d.label + i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
              strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
              strokeDashoffset={strokeOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{
                transition: "stroke-width 0.2s ease, opacity 0.2s ease",
                opacity: hoveredIdx !== null && !isHovered ? 0.45 : 1,
                cursor: "pointer",
              }}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
            />
          );
        })}
      </svg>
      <div className="vahan-donut-center">
        {hoveredIdx !== null && data[hoveredIdx] ? (
          <>
            <span className="vahan-donut-hover-label">{data[hoveredIdx].label}</span>
            <strong className="vahan-donut-hover-val">
              {data[hoveredIdx].value.toLocaleString("en-IN")} {data[hoveredIdx].unit || ""}
            </strong>
            <small className="vahan-donut-hover-sub">
              {total > 0 ? `${((data[hoveredIdx].value / total) * 100).toFixed(1)}%` : ""}
            </small>
          </>
        ) : (
          <>
            <span className="vahan-donut-total-label">Total</span>
            <strong className="vahan-donut-total-val">{total.toLocaleString("en-IN")}</strong>
            <small className="vahan-donut-total-sub">{data.length} categories</small>
          </>
        )}
      </div>
    </div>
  );
}

// ── Bar Chart Renderer ────────────────────────────────────────────────────────────
function BarRenderer({
  data,
  maxVal,
  hoveredIdx,
  onHover,
}: {
  data: ChartDataPoint[];
  maxVal: number;
  hoveredIdx: number | null;
  onHover: (i: number | null) => void;
}) {
  return (
    <div className="vahan-bars-wrap">
      {data.map((d, i) => {
        const color = d.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
        const pct = Math.min(100, Math.max(4, (d.value / maxVal) * 100));
        const isHovered = hoveredIdx === i;

        return (
          <div
            key={d.label + i}
            className={`vahan-bar-row ${isHovered ? "is-hovered" : ""}`}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="vahan-bar-meta">
              <span className="vahan-bar-label">{d.label}</span>
              <strong className="vahan-bar-num">
                {d.value.toLocaleString("en-IN")} {d.unit || ""}
              </strong>
            </div>
            <div className="vahan-bar-track">
              <div
                className="vahan-bar-fill"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  boxShadow: isHovered ? `0 0 12px ${color}88` : "none",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Line Chart Renderer ───────────────────────────────────────────────────────────
function LineRenderer({
  data,
  maxVal,
  hoveredIdx,
  onHover,
}: {
  data: ChartDataPoint[];
  maxVal: number;
  hoveredIdx: number | null;
  onHover: (i: number | null) => void;
}) {
  const width = 640;
  const height = 200;
  const paddingX = 40;
  const paddingY = 30;

  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;

  const points = data.map((d, i) => {
    const x = paddingX + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
    const y = height - paddingY - (d.value / maxVal) * innerH;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, "");
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height - paddingY} L ${points[0].x.toFixed(1)} ${height - paddingY} Z`;

  return (
    <div className="vahan-line-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="vahan-line-svg">
        <defs>
          <linearGradient id="vahanLineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((ratio) => {
          const y = height - paddingY - ratio * innerH;
          return (
            <line
              key={ratio}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="var(--ref-border, #e2e8f0)"
              strokeDasharray="4 4"
              opacity={0.5}
            />
          );
        })}

        {/* Shaded Area */}
        <path d={areaD} fill="url(#vahanLineGrad)" />

        {/* Line Stroke */}
        <path d={pathD} fill="none" stroke="#22c55e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {points.map((p, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <g key={p.label + i} onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 7 : 4.5}
                fill="#22c55e"
                stroke="var(--bg-surface, #fff)"
                strokeWidth={2}
                style={{ cursor: "pointer", transition: "r 0.15s ease" }}
              />
              <text
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-muted, #94a3b8)"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className="vahan-line-tooltip"
          style={{
            left: `${(points[hoveredIdx].x / width) * 100}%`,
            top: `${(points[hoveredIdx].y / height) * 100}%`,
          }}
        >
          <strong>{points[hoveredIdx].label}</strong>
          <span>
            {points[hoveredIdx].value.toLocaleString("en-IN")} {points[hoveredIdx].unit || ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Metric Grid Renderer ──────────────────────────────────────────────────────────
function MetricGridRenderer({ data }: { data: ChartDataPoint[] }) {
  return (
    <div className="vahan-grid-cards">
      {data.map((d, i) => {
        const color = d.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
        return (
          <div key={d.label + i} className="vahan-metric-card" style={{ borderTopColor: color }}>
            <span className="vahan-metric-label">{d.label}</span>
            <strong className="vahan-metric-val" style={{ color }}>
              {d.value.toLocaleString("en-IN")}
              {d.unit && <small className="vahan-metric-unit"> {d.unit}</small>}
            </strong>
            {d.description && <p className="vahan-metric-desc">{d.description}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ── Diagram / Workflow Steps Renderer ─────────────────────────────────────────────
function DiagramRenderer({ data }: { data: ChartDataPoint[] }) {
  return (
    <div className="vahan-diagram-flow">
      {data.map((step, i) => {
        const isLast = i === data.length - 1;
        const color = step.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
        return (
          <div key={step.label + i} className="vahan-flow-step">
            <div className="vahan-step-node" style={{ borderColor: color }}>
              <span className="vahan-step-idx" style={{ backgroundColor: color }}>
                {i + 1}
              </span>
              <strong className="vahan-step-title">{step.label}</strong>
              <span className="vahan-step-val">
                {step.value.toLocaleString("en-IN")} {step.unit || ""}
              </span>
              {step.description && <p className="vahan-step-desc">{step.description}</p>}
            </div>
            {!isLast && (
              <div className="vahan-step-arrow" aria-hidden="true">
                →
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
