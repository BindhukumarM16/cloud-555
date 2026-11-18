import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Camera,
  Check,
  CheckCircle2,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Upload,
  VideoOff,
} from 'lucide-react';
import { DEFAULT_THRESHOLDS, evaluateRisk } from '../lib/riskEngine';
import { generateScenarioImages, TEST_SCENARIOS } from '../lib/testScenarios';
import {
  AnalysisMode,
  BiometricSignals,
  RiskThresholds,
  TestCaseScenario,
  VerificationResult,
} from '../types/verification';
import { VerdictCard } from './VerdictCard';

export interface VerificationHistoryEntry {
  id: string;
  label: string;
  timestamp: string;
  mode: AnalysisMode;
  requireLiveness: boolean;
  signals: BiometricSignals;
  rawPayload: Record<string, unknown>;
  scenarioId?: TestCaseScenario['id'] | null;
}

interface VerificationLabProps {
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  idImage: string | null;
  selfieImage: string | null;
  onIdImageChange: (img: string | null) => void;
  onSelfieImageChange: (img: string | null) => void;
  consentConfirmed: boolean;
  onConsentChange: (checked: boolean) => void;
  requireLiveness: boolean;
  onRequireLivenessChange: (required: boolean) => void;
  thresholds: RiskThresholds;
  onThresholdsChange: (next: RiskThresholds) => void;
  activeScenarioId: TestCaseScenario['id'] | null;
  onActiveScenarioChange: (id: TestCaseScenario['id'] | null) => void;
  lastSignals: {
    runId: string;
    signals: BiometricSignals;
    mode: AnalysisMode;
    rawPayload: Record<string, unknown>;
    scenarioId?: TestCaseScenario['id'] | null;
  } | null;
  onLastSignalsChange: (
    next: {
      runId: string;
      signals: BiometricSignals;
      mode: AnalysisMode;
      rawPayload: Record<string, unknown>;
      scenarioId?: TestCaseScenario['id'] | null;
    } | null
  ) => void;
}

export const VerificationLab: React.FC<VerificationLabProps> = ({
  mode,
  onModeChange,
  idImage,
  selfieImage,
  onIdImageChange,
  onSelfieImageChange,
  consentConfirmed,
  onConsentChange,
  requireLiveness,
  onRequireLivenessChange,
  thresholds,
  onThresholdsChange,
  activeScenarioId,
  onActiveScenarioChange,
  lastSignals,
  onLastSignalsChange,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);
  const [history, setHistory] = useState<VerificationHistoryEntry[]>([]);
  const [dragTarget, setDragTarget] = useState<'selfie' | 'id' | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Webcam API is unavailable in this browser context. Use the file upload fallback.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Camera permission was denied or no webcam was found.';
      setCameraError(
        `${msg} Ensure HTTPS or localhost and allow camera access, or upload a photo file.`
      );
    }
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onSelfieImageChange(dataUrl);
    onActiveScenarioChange(null);
    stopCamera();
  };

  const loadFileIntoTarget = (file: File, target: 'id' | 'selfie') => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (target === 'id') {
          onIdImageChange(reader.result);
        } else {
          onSelfieImageChange(reader.result);
          stopCamera();
        }
        onActiveScenarioChange(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'id' | 'selfie'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      loadFileIntoTarget(file, target);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent, target: 'id' | 'selfie') => {
    e.preventDefault();
    setDragTarget(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      loadFileIntoTarget(file, target);
    }
  };

  const handleLoadScenario = (scenarioId: TestCaseScenario['id']) => {
    stopCamera();
    const { idDataUrl, selfieDataUrl } = generateScenarioImages(scenarioId);
    onIdImageChange(idDataUrl);
    onSelfieImageChange(selfieDataUrl);
    onActiveScenarioChange(scenarioId);
    setApiError(null);
  };

  const pushHistory = (entry: Omit<VerificationHistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: VerificationHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
    setHistory((prev) => [newEntry, ...prev].slice(0, 5));
  };

  const handleRunCheck = async () => {
    setApiError(null);
    if (!consentConfirmed) {
      setApiError('Tick the consent box to enable analysis.');
      return;
    }

    if (mode === 'demo') {
      const scenario =
        TEST_SCENARIOS.find((s) => s.id === activeScenarioId) ?? TEST_SCENARIOS[0];
      if (!activeScenarioId) {
        onActiveScenarioChange(scenario.id);
      }
      if (!idImage || !selfieImage) {
        const generated = generateScenarioImages(scenario.id);
        onIdImageChange(generated.idDataUrl);
        onSelfieImageChange(generated.selfieDataUrl);
      }
      const signals = scenario.simulatedSignals;
      const rawPayload = {
        SIMULATED: true,
        scenario: scenario.title,
        similarity: signals.similarity,
        face_found: signals.faceDetectedInSelfie,
        CompareFaces: {
          FaceMatches:
            signals.faceDetectedInId && signals.faceDetectedInSelfie
              ? [{ Similarity: signals.similarity }]
              : [],
        },
        DetectFaces: {
          FaceDetails: signals.faceDetectedInSelfie
            ? [
                {
                  Quality: {
                    Brightness: signals.brightness,
                    Sharpness: signals.sharpness,
                  },
                  Pose: {
                    Yaw: signals.pose.yaw,
                    Pitch: signals.pose.pitch,
                    Roll: signals.pose.roll,
                  },
                },
              ]
            : [],
        },
        LivenessEvaluation: requireLiveness
          ? {
              Status: signals.livenessPassed ? 'SUCCEEDED' : 'FAILED',
              Confidence: signals.livenessConfidence,
              SpoofIndicators: signals.spoofIndicators,
            }
          : null,
      };
      const runId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      onLastSignalsChange({
        runId,
        signals,
        mode: 'demo',
        scenarioId: scenario.id,
        rawPayload,
      });
      pushHistory({
        label: scenario.title,
        mode: 'demo',
        requireLiveness,
        signals,
        rawPayload,
        scenarioId: scenario.id,
      });
      return;
    }

    if (!idImage || !selfieImage) {
      setApiError('Provide both a live selfie and an ID-style photo.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idImage,
          selfieImage,
          consentConfirmed,
          requireLiveness,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Verification request failed (${response.status})`);
      }
      const runId = `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      onLastSignalsChange({
        runId,
        signals: data.signals,
        mode: 'live',
        scenarioId: null,
        rawPayload: data.rawPayload,
      });
      pushHistory({
        label: 'Live Check',
        mode: 'live',
        requireLiveness,
        signals: data.signals,
        rawPayload: data.rawPayload,
        scenarioId: null,
      });
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : 'Unable to complete verification check.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const thresholdWarning =
    thresholds.suspiciousSimilarityMin >= thresholds.genuineSimilarityMin;

  const liveResult: VerificationResult | null = lastSignals
    ? {
        id: lastSignals.runId,
        timestamp: new Date().toISOString(),
        mode: lastSignals.mode,
        requireLiveness,
        signals: lastSignals.signals,
        evaluation: evaluateRisk(lastSignals.signals, thresholds, requireLiveness),
        rawPayload: lastSignals.rawPayload,
      }
    : null;

  const imagesReady = mode === 'demo' || (Boolean(idImage) && Boolean(selfieImage));

  return (
    <div className="space-y-6">
      {/* Studio Sub-Header & Workspace Controls */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl text-balance">
            Deepfake Detection and Identity Check
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-400 leading-relaxed">
            An image is not trusted just because it looks real. Verify live presence, compare a selfie against an ID-style photo, inspect capture quality, and audit an explainable verdict.
          </p>
        </div>

        {/* Workspace toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="Analysis engine mode"
            className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1"
          >
            <button
              type="button"
              onClick={() => onModeChange('live')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'live'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Live AI Vision
            </button>
            <button
              type="button"
              onClick={() => onModeChange('demo')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'demo'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Demo Mode (Simulated)
            </button>
          </div>

          <button
            type="button"
            onClick={() => onRequireLivenessChange(!requireLiveness)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              requireLiveness
                ? 'border-sky-700/70 bg-sky-950/60 text-sky-300'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {requireLiveness ? 'Option B: Liveness Enforced' : 'Option A: Compare-Only'}
          </button>

          <button
            type="button"
            onClick={() => setThresholdsOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              thresholdsOpen
                ? 'border-sky-500 bg-sky-600 text-white'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tune Thresholds</span>
          </button>
        </div>
      </div>

      {/* 3-Step Workflow Strip + Quick Sample Presets */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                imagesReady
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {imagesReady ? <Check className="h-3 w-3" aria-hidden="true" /> : '1'}
            </span>
            <span className="font-semibold text-slate-200">Capture / Load Pair</span>
          </div>
          <span className="text-slate-600" aria-hidden="true">/</span>
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                consentConfirmed
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {consentConfirmed ? <Check className="h-3 w-3" aria-hidden="true" /> : '2'}
            </span>
            <span className="font-semibold text-slate-200">Biometric Consent</span>
          </div>
          <span className="text-slate-600" aria-hidden="true">/</span>
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                liveResult
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {liveResult ? <Check className="h-3 w-3" aria-hidden="true" /> : '3'}
            </span>
            <span className="font-semibold text-slate-200">Explainable Verdict</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-400">Presets:</span>
          {TEST_SCENARIOS.map((sc) => {
            const isSelected = activeScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleLoadScenario(sc.id)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'border-sky-500 bg-sky-950/70 text-sky-300'
                    : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {sc.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Live Threshold Calibration Panel */}
      {thresholdsOpen && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Risk Engine Threshold Calibration
              </h2>
              <p className="text-xs text-slate-400">
                Adjust parameters below to re-evaluate the active verdict in real time. These are starting points; real systems tune on larger test sets.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onThresholdsChange(DEFAULT_THRESHOLDS)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Reset Defaults</span>
            </button>
          </div>

          {thresholdWarning && (
            <div className="mt-3 rounded-lg border border-amber-700/60 bg-amber-950/60 p-2.5 text-xs text-amber-200">
              The &apos;Likely Fake&apos; threshold should be lower than the &apos;Genuine&apos; threshold.
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div>
              <div className="flex justify-between font-medium text-slate-300">
                <span>Genuine if similarity ≥</span>
                <span className="font-mono tabular-nums text-slate-100">{thresholds.genuineSimilarityMin}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                value={thresholds.genuineSimilarityMin}
                onChange={(e) =>
                  onThresholdsChange({
                    ...thresholds,
                    genuineSimilarityMin: Number(e.target.value),
                  })
                }
                className="mt-1.5 w-full accent-sky-500"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-300">
                <span>Likely Fake if similarity &lt;</span>
                <span className="font-mono tabular-nums text-slate-100">{thresholds.suspiciousSimilarityMin}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={99}
                value={thresholds.suspiciousSimilarityMin}
                onChange={(e) =>
                  onThresholdsChange({
                    ...thresholds,
                    suspiciousSimilarityMin: Number(e.target.value),
                  })
                }
                className="mt-1.5 w-full accent-sky-500"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-300">
                <span>Min sharpness</span>
                <span className="font-mono tabular-nums text-slate-100">{thresholds.sharpnessMin}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={thresholds.sharpnessMin}
                onChange={(e) =>
                  onThresholdsChange({
                    ...thresholds,
                    sharpnessMin: Number(e.target.value),
                  })
                }
                className="mt-1.5 w-full accent-sky-500"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-300">
                <span>Min liveness confidence</span>
                <span className="font-mono tabular-nums text-slate-100">{thresholds.livenessConfidenceMin}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={99}
                value={thresholds.livenessConfidenceMin}
                onChange={(e) =>
                  onThresholdsChange({
                    ...thresholds,
                    livenessConfidenceMin: Number(e.target.value),
                  })
                }
                className="mt-1.5 w-full accent-sky-500"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-300">
                <span>Brightness min</span>
                <span className="font-mono tabular-nums text-slate-100">{thresholds.brightnessMin}</span>
              </div>
              <input
                type="range"
                min={0}
                max={95}
                value={thresholds.brightnessMin}
                onChange={(e) =>
                  onThresholdsChange({
                    ...thresholds,
                    brightnessMin: Number(e.target.value),
                  })
                }
                className="mt-1.5 w-full accent-sky-500"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-300">
                <span>Brightness max</span>
                <span className="font-mono tabular-nums text-slate-100">{thresholds.brightnessMax}</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={thresholds.brightnessMax}
                onChange={(e) =>
                  onThresholdsChange({
                    ...thresholds,
                    brightnessMax: Number(e.target.value),
                  })
                }
                className="mt-1.5 w-full accent-sky-500"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-300">
                <span>Max |yaw| (degrees)</span>
                <span className="font-mono tabular-nums text-slate-100">±{thresholds.maxAbsYaw}°</span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                value={thresholds.maxAbsYaw}
                onChange={(e) =>
                  onThresholdsChange({
                    ...thresholds,
                    maxAbsYaw: Number(e.target.value),
                  })
                }
                className="mt-1.5 w-full accent-sky-500"
              />
            </div>
          </div>
        </section>
      )}

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Side-by-Side Comparison Deck + Consent + Run */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-5">
            {/* Side-by-Side Biometric Pair */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {/* Probe Selfie */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-slate-100">
                    01. Live Selfie
                  </h2>
                  <div className="flex items-center gap-2">
                    {!cameraActive ? (
                      <button
                        type="button"
                        onClick={startCamera}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Camera</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-100 cursor-pointer"
                      >
                        <VideoOff className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Stop</span>
                      </button>
                    )}
                    {selfieImage && !cameraActive && (
                      <button
                        type="button"
                        onClick={() => onSelfieImageChange(null)}
                        aria-label="Clear selfie image"
                        className="text-slate-400 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {cameraActive ? (
                  <div className="space-y-2">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full object-cover -scale-x-100"
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        <div className="h-28 w-22 rounded-[50%] border border-dashed border-sky-400/75" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={captureFromCamera}
                      className="w-full rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 cursor-pointer"
                    >
                      Capture Snapshot
                    </button>
                  </div>
                ) : selfieImage ? (
                  <div className="aspect-[4/3] overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                    <img
                      src={selfieImage}
                      alt="Selfie capture preview"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragTarget('selfie');
                    }}
                    onDragLeave={() => setDragTarget(null)}
                    onDrop={(e) => handleDrop(e, 'selfie')}
                    className={`flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 text-center transition-colors ${
                      dragTarget === 'selfie'
                        ? 'border-sky-400 bg-sky-950/50'
                        : 'border-slate-700 bg-slate-950/60 hover:border-sky-500 hover:bg-slate-800/50'
                    }`}
                  >
                    <Upload className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span className="mt-1.5 text-xs font-semibold text-slate-200">
                      Drop or Upload
                    </span>
                    <span className="mt-0.5 text-[11px] text-slate-400">
                      JPEG or PNG
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleFileUpload(e, 'selfie')}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>

              {/* Reference ID Photo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-slate-100">
                    02. ID-Style Photo
                  </h2>
                  {idImage && (
                    <button
                      type="button"
                      onClick={() => onIdImageChange(null)}
                      aria-label="Clear reference ID image"
                      className="text-slate-400 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {idImage ? (
                  <div className="aspect-[4/3] overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                    <img
                      src={idImage}
                      alt="Reference ID preview"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragTarget('id');
                    }}
                    onDragLeave={() => setDragTarget(null)}
                    onDrop={(e) => handleDrop(e, 'id')}
                    className={`flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 text-center transition-colors ${
                      dragTarget === 'id'
                        ? 'border-sky-400 bg-sky-950/50'
                        : 'border-slate-700 bg-slate-950/60 hover:border-sky-500 hover:bg-slate-800/50'
                    }`}
                  >
                    <Upload className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span className="mt-1.5 text-xs font-semibold text-slate-200">
                      Drop or Upload
                    </span>
                    <span className="mt-0.5 text-[11px] text-slate-400">
                      Sample ID only
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleFileUpload(e, 'id')}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
            </div>

            {cameraError && (
              <div className="rounded-lg border border-amber-700/60 bg-amber-950/60 p-3 text-xs text-amber-200">
                {cameraError}
              </div>
            )}

            {/* Consent & Primary Action */}
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentConfirmed}
                  onChange={(e) => onConsentChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-sky-500 accent-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs leading-relaxed text-slate-300">
                  I consent to my face image(s) being analysed for this demo. Images are processed strictly in memory and are never saved.
                </span>
              </label>

              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleRunCheck}
                className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isAnalyzing
                  ? 'Analysing Biometrics...'
                  : mode === 'demo'
                  ? 'Run Simulated Check'
                  : 'Run Identity Check'}
              </button>
            </div>
          </div>

          {/* In-memory Session Audit Log */}
          {history.length > 0 && (
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-100">
                  Recent Session Checks (In-Memory)
                </h3>
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Clear Log
                </button>
              </div>
              <div className="mt-2.5 divide-y divide-slate-800">
                {history.map((item) => {
                  const evalSummary = evaluateRisk(
                    item.signals,
                    thresholds,
                    item.requireLiveness
                  );
                  const color =
                    evalSummary.verdict === 'genuine'
                      ? 'text-emerald-400'
                      : evalSummary.verdict === 'suspicious'
                      ? 'text-amber-400'
                      : 'text-red-400';

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onLastSignalsChange({
                          runId: item.id,
                          signals: item.signals,
                          mode: item.mode,
                          rawPayload: item.rawPayload,
                          scenarioId: item.scenarioId,
                        });
                        onRequireLivenessChange(item.requireLiveness);
                      }}
                      className="flex w-full items-center justify-between gap-2 py-2 text-left text-xs hover:bg-slate-800/60 rounded px-1.5 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-200">
                          {item.label}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {item.timestamp} · {item.mode === 'demo' ? 'SIM' : 'LIVE'}
                        </div>
                      </div>
                      <span className={`font-semibold shrink-0 ${color}`}>
                        {evalSummary.verdictLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Verdict Output */}
        <div className={`lg:col-span-7 ${isAnalyzing ? 'animate-pulse' : ''}`}>
          {apiError && (
            <div className="mb-4 rounded-xl border border-red-700/60 bg-red-950/60 p-4 text-sm text-red-100">
              <div className="font-semibold">Analysis Notice</div>
              <p className="mt-1">{apiError}</p>
            </div>
          )}

          {isAnalyzing ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              aria-busy="true"
              aria-label="Analysing biometric signals"
              className="space-y-4"
            >
              {/* Verdict Banner Skeleton */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="mt-0.5 h-10 w-10 shrink-0 rounded-lg bg-slate-800" />
                    <div className="flex-1 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-20 rounded bg-slate-800" />
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span className="text-xs font-medium text-slate-400">
                          Analysing facial similarity, quality, and liveness...
                        </span>
                      </div>
                      <div className="h-6 w-48 rounded-md bg-slate-800" />
                      <div className="h-4 w-5/6 rounded bg-slate-800/70" />
                    </div>
                  </div>
                  <div className="h-8 w-36 shrink-0 rounded-lg bg-slate-800" />
                </div>
              </div>

              {/* 4 Biometric Telemetry Gauge Skeletons */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {['Face Similarity', 'Image Sharpness', 'Brightness', 'Head Pose (Yaw)'].map(
                  (metricLabel) => (
                    <div
                      key={metricLabel}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-semibold text-slate-400">
                          {metricLabel}
                        </span>
                        <div className="h-6 w-14 rounded bg-slate-800" />
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-slate-800" />
                      <div className="mt-2 flex justify-between">
                        <div className="h-3 w-16 rounded bg-slate-800/70" />
                        <div className="h-3 w-20 rounded bg-slate-800/70" />
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Liveness Strip Skeleton */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-36 rounded bg-slate-800" />
                  <div className="h-3.5 w-28 rounded bg-slate-800/70" />
                </div>
                <div className="h-4 w-3/4 rounded bg-slate-800/70" />
              </div>

              {/* Explainable Reasons Skeleton */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
                <div className="h-4 w-32 rounded bg-slate-800" />
                <div className="divide-y divide-slate-800">
                  {[0, 1, 2, 3].map((rowIdx) => (
                    <div key={rowIdx} className="flex items-center gap-3 py-2.5">
                      <div className="h-4 w-4 shrink-0 rounded-full bg-slate-800" />
                      <div
                        className="h-3.5 rounded bg-slate-800/70"
                        style={{ width: `${78 - rowIdx * 8}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : liveResult ? (
            <motion.section
              key={liveResult.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Results summary"
            >
              <VerdictCard
                result={liveResult}
                thresholds={thresholds}
                scenarioId={lastSignals?.scenarioId ?? activeScenarioId}
              />
            </motion.section>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8">
              <h2 className="text-lg font-semibold text-slate-100">
                Ready for Identity &amp; Deepfake Inspection
              </h2>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Select a preset above or capture/drop a selfie and ID-style photo on the left. Once analysed, you will see visual threshold gauges for face similarity, sharpness, brightness, head pose, and a composite biometric scorecard.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-800 pt-6 sm:grid-cols-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Genuine · Allow</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Similarity ≥ {thresholds.genuineSimilarityMin}%, sharpness ≥ {thresholds.sharpnessMin}, brightness {thresholds.brightnessMin}–{thresholds.brightnessMax}, frontal pose.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Suspicious · Review</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Similarity {thresholds.suspiciousSimilarityMin}–{thresholds.genuineSimilarityMin}%, dark/blurry frame, or head turned away.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Likely Fake · Block</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Similarity &lt; {thresholds.suspiciousSimilarityMin}%, no face detected, or liveness spoof detected.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
