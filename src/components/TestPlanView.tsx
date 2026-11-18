import React, { useState } from 'react';
import { ArrowRight, CheckSquare, Square } from 'lucide-react';
import { TEST_SCENARIOS } from '../lib/testScenarios';
import { TestCaseScenario } from '../types/verification';

interface TestPlanViewProps {
  onLoadScenarioInLab: (scenarioId: TestCaseScenario['id']) => void;
}

export const TestPlanView: React.FC<TestPlanViewProps> = ({ onLoadScenarioInLab }) => {
  const [completedIds, setCompletedIds] = useState<Record<string, boolean>>({});

  const toggleCompleted = (id: string) => {
    setCompletedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const completedCount = Object.values(completedIds).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl text-balance">
            5-Case Verification Test Plan
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-400 leading-relaxed">
            Run all five required scenarios from Section 5 of the Demo Build Guide. Load any case directly into the Verification Lab to inspect Option A (compare-only) vs Option B (liveness) behavior.
          </p>
        </div>
        <div className="font-mono text-xs font-semibold tabular-nums text-sky-400 shrink-0">
          {completedCount} / {TEST_SCENARIOS.length} Cases Verified
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950/60 text-xs font-semibold text-slate-300">
              <tr>
                <th scope="col" className="px-4 py-3.5 w-12">Done</th>
                <th scope="col" className="px-4 py-3.5">Test Case</th>
                <th scope="col" className="px-4 py-3.5">Expected Verdict</th>
                <th scope="col" className="px-4 py-3.5">Why It Matters</th>
                <th scope="col" className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {TEST_SCENARIOS.map((sc) => {
                const isDone = Boolean(completedIds[sc.id]);
                const verdictTextColor =
                  sc.expectedLevel === 'genuine'
                    ? 'text-emerald-400'
                    : sc.expectedLevel === 'suspicious'
                    ? 'text-amber-400'
                    : 'text-red-400';

                return (
                  <tr key={sc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-4 align-top">
                      <button
                        type="button"
                        onClick={() => toggleCompleted(sc.id)}
                        aria-label={`Mark ${sc.title} as verified`}
                        className="text-slate-400 hover:text-sky-400 cursor-pointer"
                      >
                        {isDone ? (
                          <CheckSquare className="h-4 w-4 text-sky-400" aria-hidden="true" />
                        ) : (
                          <Square className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-slate-100">{sc.testCaseLabel}</div>
                      <div className="mt-1 text-xs text-slate-400">{sc.notes}</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`font-semibold ${verdictTextColor}`}>
                        {sc.expectedVerdict}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-xs leading-relaxed text-slate-300 max-w-sm">
                      {sc.optionNote}
                    </td>
                    <td className="px-4 py-4 align-top text-right">
                      <button
                        type="button"
                        onClick={() => onLoadScenarioInLab(sc.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-sky-500 hover:text-sky-300 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Load into Lab</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Engine Threshold Summary Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-100">
          Illustrative Risk Engine Decision Matrix (Section 4)
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="py-2 pr-4 font-semibold">Verdict</th>
                <th className="py-2 px-4 font-semibold">Rule</th>
                <th className="py-2 pl-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-300">
              <tr>
                <td className="py-2.5 pr-4 font-semibold text-emerald-400">Genuine</td>
                <td className="py-2.5 px-4">
                  Similarity 90 or above, quality OK (sharpness ≥ 40, brightness 30–90, |yaw| ≤ 25°), and liveness passed (if used)
                </td>
                <td className="py-2.5 pl-4 font-medium text-slate-100">Allow</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-semibold text-amber-400">Suspicious</td>
                <td className="py-2.5 px-4">
                  Similarity 70 to 90, or poor quality (dark, blurry, face turned away)
                </td>
                <td className="py-2.5 pl-4 font-medium text-slate-100">Human review</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-semibold text-red-400">Likely Fake / Spoofed</td>
                <td className="py-2.5 px-4">
                  Similarity below 70, no face found, or liveness failed
                </td>
                <td className="py-2.5 pl-4 font-medium text-slate-100">Block and alert</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
