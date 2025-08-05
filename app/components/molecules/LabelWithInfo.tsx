'use client';

import React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/atoms/tooltip';

/***********************************
 * Small UI helper: label with tooltip icon
 ***********************************/
interface LabelWithInfoProps {
  text: string;
  tip?: string;
}

const LabelWithInfo: React.FC<LabelWithInfoProps> = ({ text, tip }) => (
  <div className="flex items-center gap-1">
    <span className="text-xs font-semibold text-gray-300">{text}</span>
    {tip && (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Info: ${text}`}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-600 text-slate-300 hover:text-white bg-slate-800/80"
          >
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs bg-slate-900/95 text-slate-100 border border-slate-700 shadow-xl"
        >
          {tip}
        </TooltipContent>
      </Tooltip>
    )}
  </div>
);

export default LabelWithInfo;
