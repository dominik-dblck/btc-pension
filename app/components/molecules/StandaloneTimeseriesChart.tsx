'use client';

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { InputsRenderer } from './InputsRenderer';

/* =========================
 * Typy publicznego API
 * =======================*/

export type SeriesType = 'monotone' | 'linear' | 'basis' | 'step' | 'natural';

export type AxisId = 'left' | 'right';

export interface SeriesConfig {
  /** unikalne ID serii */
  id: string;
  /** etykieta w legendzie/tooltipie */
  name: string;
  /** klucz w data, np. "revenue" */
  dataKey: string;
  /** kolor linii (CSS color) */
  color?: string;
  /** oś Y: left (domyślnie) lub right */
  yAxisId?: AxisId;
  /** styl przerywanej linii, np. "4 2" */
  strokeDasharray?: string;
  /** typ interpolacji */
  type?: SeriesType;
  /** widoczność startowa (domyślnie true) */
  visible?: boolean;
  /** pokazywać kropki? (domyślnie false) */
  dot?: boolean;
}

export type InputKind = 'number' | 'text' | 'select' | 'toggle';

export interface InputOption {
  label: string;
  value: string | number;
}

export interface InputDef {
  id: string;
  label: string;
  type: InputKind;
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: InputOption[]; // dla select
  tooltip?: string;
}

export interface StandaloneTimeseriesChartProps<T extends Record<string, any>> {
  /** tytuł */
  title: string;
  /** podtytuł/opis nad wykresem (opcjonalnie) */
  description?: string;
  /** wysokość w px (domyślnie 360) */
  height?: number;
  /** dane: tablica punktów (x i metryki) */
  data: T[];
  /** klucz dla osi X (np. "month" / "date" / "label") */
  xKey: keyof T & string;
  /** definicje serii */
  series: SeriesConfig[];
  /** definicje inputów (opcjonalnie) */
  inputs?: InputDef[];
  /** włącz/wyłącz legendę (domyślnie false, bo są toggles niżej) */
  showLegend?: boolean;
  /** callback dla fullscreen */
  onFullscreenClick?: () => void;

  /** formattery (opcjonalne) */
  xTickFormatter?: (x: any) => string;
  leftTickFormatter?: (y: number) => string;
  rightTickFormatter?: (y: number) => string;
  tooltipFormatter?: (value: any, name: string) => [string | number, string];

  /** styl root-containera */
  className?: string;
}

/* =========================
 * Komponent
 * =======================*/

const DEFAULT_PALETTE = [
  '#f59e0b', // amber-500
  '#22c55e', // emerald-500
  '#06b6d4', // cyan-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
  '#f472b6', // pink-400
  '#10b981', // green-500
  '#3b82f6', // blue-500
];

const defaultNumFmt = (n: number) =>
  typeof n === 'number' ? n.toLocaleString('en-US') : String(n);

export function StandaloneTimeseriesChart<T extends Record<string, any>>(
  props: StandaloneTimeseriesChartProps<T>
) {
  const {
    title,
    description,
    height = 360,
    data,
    xKey,
    series,
    inputs = [],
    xTickFormatter = (v: any) => String(v),
    leftTickFormatter = defaultNumFmt,
    rightTickFormatter = defaultNumFmt,
    tooltipFormatter,
    showLegend = false,
    onFullscreenClick,
    className,
  } = props;

  // Początkowa widoczność na podstawie "visible" lub true
  const initiallyVisible = useMemo(
    () => new Set(series.filter(s => s.visible !== false).map(s => s.id)),
    [series]
  );
  const [visible, setVisible] = useState<Set<string>>(initiallyVisible);

  const hasRightAxis = useMemo(
    () => series.some(s => (s.yAxisId ?? 'left') === 'right'),
    [series]
  );

  const showAll = () => setVisible(new Set(series.map(s => s.id)));
  const hideAll = () => setVisible(new Set());
  const toggleSeries = (id: string) =>
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      className={`w-full rounded-2xl border border-slate-700 bg-slate-900/60 backdrop-blur p-4 md:p-6 shadow-xl ${className ?? ''}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description ? (
            <p className="text-xs text-slate-300 mt-1">{description}</p>
          ) : null}
        </div>
        {onFullscreenClick && (
          <button
            onClick={onFullscreenClick}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
            title="Open fullscreen"
          >
            <svg
              className="w-4 h-4 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Inputs (opcjonalnie) */}
      {inputs.length > 0 && (
        <div className="mb-4">
          <InputsRenderer inputs={inputs} />
        </div>
      )}

      {/* Chart */}
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: '#cbd5e1' }}
              tickFormatter={xTickFormatter}
              stroke="#64748b"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: '#cbd5e1' }}
              tickFormatter={leftTickFormatter}
              stroke="#64748b"
            />
            {hasRightAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: '#cbd5e1' }}
                tickFormatter={rightTickFormatter}
                stroke="#64748b"
              />
            )}
            <RechartsTooltip
              formatter={(v: any, name: string) =>
                tooltipFormatter
                  ? tooltipFormatter(v, name)
                  : [defaultNumFmt(Number(v)), name]
              }
              contentStyle={{
                background: '#0b1220',
                color: '#e5e7eb',
                borderRadius: 8,
                border: '1px solid #334155',
                boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
              }}
            />
            {showLegend && (
              <Legend wrapperStyle={{ fontSize: 12, color: '#e5e7eb' }} />
            )}

            {series.map((s, i) =>
              visible.has(s.id) ? (
                <Line
                  key={s.id}
                  yAxisId={s.yAxisId ?? 'left'}
                  type={s.type ?? 'monotone'}
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={
                    s.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]
                  }
                  strokeWidth={2}
                  strokeDasharray={s.strokeDasharray}
                  dot={s.dot ?? false}
                  activeDot={{ r: 4 }}
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Toggles pod wykresem */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="px-3 py-1.5 text-xs rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700"
          onClick={showAll}
        >
          Show all
        </button>
        <button
          type="button"
          className="px-3 py-1.5 text-xs rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700"
          onClick={hideAll}
        >
          Hide all
        </button>

        {series.map((s, i) => {
          const isOn = visible.has(s.id);
          const color = s.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
          return (
            <button
              key={`toggle-${s.id}`}
              type="button"
              onClick={() => toggleSeries(s.id)}
              className={`px-2.5 py-1.5 text-xs rounded-md border flex items-center gap-2
                ${isOn ? 'bg-slate-700 border-slate-600' : 'bg-slate-900 border-slate-800 opacity-70'}
              `}
              title={s.name}
            >
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: color }}
              />
              <span className="text-slate-200">{s.name}</span>
              <span className="text-[10px] text-slate-400">
                {s.yAxisId === 'right' ? 'R' : 'L'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
