'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StandaloneTimeseriesChart,
  StandaloneTimeseriesChartProps,
} from './StandaloneTimeseriesChart';

export interface FullscreenChartWrapperProps<T extends Record<string, any>> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  chartProps: Omit<StandaloneTimeseriesChartProps<T>, 'onFullscreenClick'>;
}

export function FullscreenChartWrapper<T extends Record<string, any>>({
  isOpen,
  onClose,
  title,
  chartProps,
}: FullscreenChartWrapperProps<T>) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full h-full max-w-7xl max-h-[90vh] m-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              title="Close fullscreen"
            >
              <svg
                className="w-5 h-5 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Chart */}
            <StandaloneTimeseriesChart
              {...chartProps}
              height={600}
              className="h-full"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
