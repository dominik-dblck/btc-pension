'use client';

import React from 'react';
import { Input } from '@/app/components/atoms/input';
import { Button } from '@/app/components/atoms/button';
import LabelWithInfo from './LabelWithInfo';
import { InputDef } from './StandaloneTimeseriesChart';

interface InputsRendererProps {
  inputs: InputDef[];
  className?: string;
  gridCols?: string;
}

export function InputsRenderer({
  inputs,
  className,
  gridCols,
}: InputsRendererProps) {
  const defaultClassName =
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3';
  const gridClassName = gridCols
    ? gridCols
    : className
      ? className
      : defaultClassName;

  return (
    <div className={gridClassName}>
      {inputs.map(inp => {
        const baseCls =
          'w-full rounded-md bg-slate-900/70 border border-slate-700 text-slate-100 text-sm px-2 py-1';

        return (
          <div key={inp.id} className="space-y-1">
            <LabelWithInfo text={inp.label} tip={inp.tooltip} />

            {inp.type === 'number' && (
              <Input
                type="number"
                className={baseCls}
                value={inp.value ?? ''}
                placeholder={inp.placeholder}
                min={inp.min}
                max={inp.max}
                step={inp.step}
                onChange={e =>
                  inp.onChange(
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
              />
            )}

            {inp.type === 'text' && (
              <Input
                type="text"
                className={baseCls}
                value={inp.value ?? ''}
                placeholder={inp.placeholder}
                onChange={e => inp.onChange(e.target.value)}
              />
            )}

            {inp.type === 'select' && (
              <select
                className={baseCls}
                value={inp.value}
                onChange={e => inp.onChange(e.target.value)}
              >
                {(inp.options ?? []).map(opt => (
                  <option key={`${inp.id}-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {inp.type === 'toggle' && (
              <Button
                type="button"
                className={`w-full ${inp.value ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                onClick={() => inp.onChange(!inp.value)}
              >
                {inp.value ? 'ON' : 'OFF'}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
