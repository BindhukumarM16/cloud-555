import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  RiskThresholds,
  TestCaseScenario,
  VerificationResult,
} from '../types/verification';

interface VerdictCardProps {
  result: VerificationResult;
  thresholds: RiskThresholds;
  scenarioId?: TestCaseScenario['id'] | null;
}

export const VerdictCard: React.FC<VerdictCardProps> = ({
  result,
  thresholds,
  scenarioId,
}) => {
  const [copied, setCopied] = useState(false);

  const { evaluation, signals, mode, requireLiveness } = result;
  const faceFound = signals.faceDetectedInSelfie && signals.faceDetectedInId;

  const palette = {
    genuine: {
      border: 'border-emerald-700/60',
      bg: 'bg-emerald-950/50',
      iconBg: 'bg-emerald-600 text-white',
      title: 'text-emerald-100',
      sub: 'text-emerald-200/90',
      meta: 'text-emerald-300/80',
      actionBg: 'bg-emerald-600 text-white',
      Icon: ShieldCheck,
    },
    suspicious: {
      border: 'border-amber-700/60',
      bg: 'bg-amber-950/50',
      iconBg: 'bg-amber-600 text-white',
      title: 'text-amber-100',
      sub: 'text-amber-200/90',
      meta: 'text-amber-300/80',
      actionBg: 'bg-amber-600 text-white',
      Icon: AlertTriangle,
    },
    fake: {
      border: 'border-red-700/60',
      bg: 'bg-red-950/50',
      iconBg: 'bg-red-600 text-white',
      title: 'text-red-100',
      sub: 'text-red-200/90',
      meta: 'text-red-300/80',
      actionBg: 'bg-red-600 text-white',
      Icon: ShieldAlert,
    },
  }[evaluation.verdict];

  const VerdictIcon = palette.Icon;

  const simBarColor = !faceFound
    ? 'bg-slate-600'
    : signals.similarity >= thresholds.genuineSimilarityMin
    ? 'bg-emerald-500'
    : signals.similarity >= thresholds.suspiciousSimilarityMin
    ? 'bg-amber-500'
    : 'bg-red-500';

  const sharpBarColor = !faceFound
    ? 'bg-slate-600'
    : signals.sharpness >= thresholds.sharpnessMin
    ? 'bg-emerald-500'
    : 'bg-amber-500';

  const brightOk =
    faceFound &&
    signals.brightness >= thresholds.brightnessMin &&
    signals.brightness <= thresholds.brightnessMax;

  const yawOk = faceFound && Math.abs(signals.pose.yaw) <= thresholds.maxAbsYaw;

  const yawMarkerPct = Math.max(
    4,
    Math.min(96, ((signals.pose.yaw + 45) / 90) * 100)
  );
  const yawZoneLeftPct = Math.max(0, ((45 - thresholds.maxAbsYaw) / 90) * 100);
  const yawZoneWidthPct = Math.min(100, ((thresholds.maxAbsYaw * 2) / 90) * 100);

  const livenessScore = signals.livenessConfidence ?? 0;
  const livenessPassed =
    requireLiveness &&
    signals.livenessPassed !== false &&
    livenessScore >= thresholds.livenessConfidenceMin &&
    signals.spoofIndicators.length === 0;

  const simStatus: 'Nominal' | 'Borderline' | 'Failed' = !faceFound
    ? 'Failed'
    : signals.similarity >= thresholds.genuineSimilarityMin
    ? 'Nominal'
    : signals.similarity >= thresholds.suspiciousSimilarityMin
    ? 'Borderline'
    : 'Failed';

  const sharpStatus: 'Nominal' | 'Review' | 'Failed' = !faceFound
    ? 'Failed'
    : signals.sharpness >= thresholds.sharpnessMin
    ? 'Nominal'
    : 'Review';

  const brightStatus: 'Nominal' | 'Review' | 'Failed' = !faceFound
    ? 'Failed'
    : brightOk
    ? 'Nominal'
    : 'Review';

  const poseStatus: 'Nominal' | 'Review' | 'Failed' = !faceFound
    ? 'Failed'
    : yawOk
    ? 'Nominal'
    : 'Review';

  const livenessStatus: 'Nominal' | 'Failed' | 'Skipped' = !requireLiveness
    ? 'Skipped'
    : livenessPassed
    ? 'Nominal'
    : 'Failed';

  const qualitySubScore = faceFound
    ? Math.round(
        (Math.min(100, signals.sharpness) +
          (brightOk ? 100 : Math.max(20, 100 - Math.abs(signals.brightness - 60) * 1.4)) +
          (yawOk ? 100 : Math.max(15, 100 - Math.abs(signals.pose.yaw) * 1.5))) /
          3
      )
    : 0;

  const compositeScore = !faceFound
    ? 0
    : requireLiveness
    ? Math.round(
        signals.similarity * 0.45 + qualitySubScore * 0.2 + livenessScore * 0.35
      )
    : Math.round(signals.similarity * 0.7 + qualitySubScore * 0.3);

  const scorecardRows = [
    {
      name: 'Face Similarity',
      measured: faceFound ? `${signals.similarity.toFixed(1)}%` : 'n/a',
      rule: `≥ ${thresholds.genuineSimilarityMin}%`,
      status: simStatus,
    },
    {
      name: 'Image Sharpness',
      measured: faceFound ? signals.sharpness.toFixed(0) : 'n/a',
      rule: `≥ ${thresholds.sharpnessMin}`,
      status: sharpStatus,
    },
    {
      name: 'Exposure Brightness',
      measured: faceFound ? signals.brightness.toFixed(0) : 'n/a',
      rule: `${thresholds.brightnessMin}–${thresholds.brightnessMax}`,
      status: brightStatus,
    },
    {
      name: 'Frontal Head Pose',
      measured: faceFound
        ? `${signals.pose.yaw >= 0 ? '+' : ''}${signals.pose.yaw.toFixed(0)}°`
        : 'n/a',
      rule: `±${thresholds.maxAbsYaw}°`,
      status: poseStatus,
    },
    {
      name: 'Liveness & Anti-Spoof',
      measured: requireLiveness ? `${livenessScore.toFixed(0)}%` : 'Not run',
      rule: requireLiveness ? `≥ ${thresholds.livenessConfidenceMin}%` : 'Compare-only',
      status: livenessStatus,
    },
  ];

  const handleCopyAuditSummary = async () => {
    const lines = [
      `DeepGuard Verification Summary (${mode === 'demo' ? 'SIMULATED' : 'LIVE'})`,
      `Verdict: ${evaluation.verdictLabel} — ${evaluation.actionLabel}`,
      `Composite Score: ${compositeScore}/100`,
      ...scorecardRows.map(
        (r) => `- ${r.name}: ${r.measured} (Target ${r.rule}) [${r.status}]`
      ),
      'Reasons:',
      ...evaluation.reasons.map((r) => `* ${r.message}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored silently
    }
  };

  return (
    <div className="space-y-4">
      {/* Simulated mode disclosure */}
      {mode === 'demo' && (
        <div className="rounded-lg border border-amber-700/60 bg-amber-950/60 px-4 py-2.5 text-xs font-medium text-amber-200">
          SIMULATED OUTPUT — Demo mode is active. Scores below are simulated test values, not live cloud inference.
        </div>
      )}

      {/* Primary Verdict Banner */}
      <div className={`rounded-xl border ${palette.border} ${palette.bg} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`mt-0.5 rounded-lg p-2.5 ${palette.iconBg}`}>
              <VerdictIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className={`flex flex-wrap items-center gap-2 text-xs font-medium ${palette.meta}`}>
                <span>{mode === 'demo' ? 'SIMULATED' : 'Live Analysis'}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {requireLiveness
                    ? 'Option B (Compare + Liveness)'
                    : 'Option A (Compare-Only)'}
                </span>
              </div>
              <h2 className={`mt-1 text-xl font-bold tracking-tight ${palette.title}`}>
                {evaluation.verdictLabel}
              </h2>
              <p className={`mt-1 text-sm leading-relaxed ${palette.sub}`}>
                {evaluation.summary}
              </p>
            </div>
          </div>

          <div
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${palette.actionBg}`}
          >
            Recommended action: {evaluation.actionLabel}
          </div>
        </div>
      </div>

      {/* Option A spoof limitation callout */}
      {scenarioId === 'photo_replay' && !requireLiveness && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/50 p-4 text-sm text-amber-100">
          <strong>Limitation of Option A:</strong> The face matched (
          {signals.similarity.toFixed(1)}%), so a compare-only check passes the spoof.
          Switch on <strong>Option B: Liveness Enforced</strong> to see the replay
          attack caught.
        </div>
      )}

      {/* 4 Biometric Telemetry Gauges */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Similarity Gauge */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-300">Face Similarity</span>
            <span className="font-mono text-xl font-bold tabular-nums text-slate-50">
              {faceFound ? `${signals.similarity.toFixed(1)}%` : 'n/a'}
            </span>
          </div>
          <div className="relative mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${simBarColor}`}
              style={{ width: faceFound ? `${Math.min(100, signals.similarity)}%` : '0%' }}
            />
            <div
              title={`Genuine threshold ${thresholds.genuineSimilarityMin}%`}
              className="absolute top-0 bottom-0 w-0.5 bg-slate-200/80"
              style={{ left: `${thresholds.genuineSimilarityMin}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-slate-400">
            <span>Fake &lt; {thresholds.suspiciousSimilarityMin}%</span>
            <span>Genuine ≥ {thresholds.genuineSimilarityMin}%</span>
          </div>
        </div>

        {/* Sharpness Gauge */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-300">Image Sharpness</span>
            <span className="font-mono text-xl font-bold tabular-nums text-slate-50">
              {faceFound ? signals.sharpness.toFixed(0) : 'n/a'}
            </span>
          </div>
          <div className="relative mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${sharpBarColor}`}
              style={{ width: faceFound ? `${Math.min(100, signals.sharpness)}%` : '0%' }}
            />
            <div
              title={`Min sharpness ${thresholds.sharpnessMin}`}
              className="absolute top-0 bottom-0 w-0.5 bg-slate-200/80"
              style={{ left: `${thresholds.sharpnessMin}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-slate-400">
            <span>Blurry &lt; {thresholds.sharpnessMin}</span>
            <span>Nominal ≥ {thresholds.sharpnessMin}</span>
          </div>
        </div>

        {/* Brightness Window Gauge */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-300">Brightness</span>
            <span className="font-mono text-xl font-bold tabular-nums text-slate-50">
              {faceFound ? signals.brightness.toFixed(0) : 'n/a'}
            </span>
          </div>
          <div className="relative mt-3 h-2 w-full rounded-full bg-slate-800">
            <div
              className="absolute top-0 bottom-0 rounded-full bg-emerald-500/25"
              style={{
                left: `${thresholds.brightnessMin}%`,
                width: `${Math.max(0, thresholds.brightnessMax - thresholds.brightnessMin)}%`,
              }}
            />
            {faceFound && (
              <div
                className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 shadow-xs transition-all duration-200 ${
                  brightOk ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{ left: `${Math.max(2, Math.min(98, signals.brightness))}%` }}
              />
            )}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-slate-400">
            <span>Dark &lt; {thresholds.brightnessMin}</span>
            <span>Ideal {thresholds.brightnessMin}–{thresholds.brightnessMax}</span>
          </div>
        </div>

        {/* Head Pose Centered Gauge */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-slate-300">Head Pose (Yaw)</span>
            <span className="font-mono text-xl font-bold tabular-nums text-slate-50">
              {faceFound
                ? `${signals.pose.yaw >= 0 ? '+' : ''}${signals.pose.yaw.toFixed(0)}°`
                : 'n/a'}
            </span>
          </div>
          <div className="relative mt-3 h-2 w-full rounded-full bg-slate-800">
            <div
              className="absolute top-0 bottom-0 rounded-full bg-emerald-500/25"
              style={{
                left: `${yawZoneLeftPct}%`,
                width: `${yawZoneWidthPct}%`,
              }}
            />
            {faceFound && (
              <div
                className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 shadow-xs transition-all duration-200 ${
                  yawOk ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{ left: `${yawMarkerPct}%` }}
              />
            )}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-slate-400">
            <span>Frontal ±{thresholds.maxAbsYaw}°</span>
            <span>
              {faceFound
                ? `P ${signals.pose.pitch.toFixed(0)}° · R ${signals.pose.roll.toFixed(0)}°`
                : 'No face'}
            </span>
          </div>
        </div>
      </div>

      {/* Explainable Decision Reasons */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-sm font-semibold text-slate-100">
          Why this verdict
        </h3>
        <ul className="mt-3 divide-y divide-slate-800">
          {evaluation.reasons.map((reason) => {
            const Icon =
              reason.status === 'pass'
                ? Check
                : reason.status === 'warn'
                ? AlertTriangle
                : XCircle;
            const color =
              reason.status === 'pass'
                ? 'text-emerald-400'
                : reason.status === 'warn'
                ? 'text-amber-400'
                : 'text-red-400';

            return (
              <li key={reason.code} className="flex items-start gap-3 py-2.5 text-sm">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} aria-hidden="true" />
                <span className="text-slate-200">{reason.message}</span>
              </li>
            );
          })}
        </ul>

        {signals.spoofIndicators.length > 0 && (
          <div className="mt-4 border-t border-slate-800 pt-3.5">
            <div className="text-xs font-semibold text-red-400">
              Detected Replay / Spoof Indicators
            </div>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {signals.spoofIndicators.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {signals.observations.length > 0 && (
          <div className="mt-4 border-t border-slate-800 pt-3.5">
            <div className="text-xs font-semibold text-slate-400">
              Visual Forensic Notes
            </div>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {signals.observations.map((obs, idx) => (
                <li key={idx}>{obs}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Polished Biometric Score Display */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Biometric Score Summary
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Weighted signal scorecard comparing measured captures against active policy thresholds.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[11px] font-medium text-slate-400">
                Composite Score
              </div>
              <div className="font-mono text-2xl font-bold tabular-nums text-slate-50">
                {compositeScore}
                <span className="text-sm font-medium text-slate-500">/100</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyAuditSummary}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copied ? 'Copied' : 'Copy Summary'}</span>
            </button>
          </div>
        </div>

        {/* Composite Score Progress Bar */}
        <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              evaluation.verdict === 'genuine'
                ? 'bg-emerald-500'
                : evaluation.verdict === 'suspicious'
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${compositeScore}%` }}
          />
        </div>

        {/* Structured Scorecard Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="py-2 pr-4 font-semibold">Biometric Signal</th>
                <th className="py-2 px-4 font-semibold text-right">Measured</th>
                <th className="py-2 px-4 font-semibold text-right">Policy Rule</th>
                <th className="py-2 pl-4 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {scorecardRows.map((row) => {
                const statusColor =
                  row.status === 'Nominal'
                    ? 'text-emerald-400'
                    : row.status === 'Borderline' || row.status === 'Review'
                    ? 'text-amber-400'
                    : row.status === 'Skipped'
                    ? 'text-slate-400'
                    : 'text-red-400';

                return (
                  <tr key={row.name}>
                    <td className="py-2.5 pr-4 font-medium text-slate-200">
                      {row.name}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold tabular-nums text-right text-slate-50">
                      {row.measured}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-400">
                      {row.rule}
                    </td>
                    <td className={`py-2.5 pl-4 font-semibold text-right ${statusColor}`}>
                      {row.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
