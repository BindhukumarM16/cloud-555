import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  VideoOff,
} from 'lucide-react';
import { evaluateRisk } from '../lib/riskEngine';
import {
  AnalysisMode,
  LivenessSessionInfo,
  RiskEvaluation,
  RiskThresholds,
} from '../types/verification';

interface LivenessStudioProps {
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  idImage: string | null;
  consentConfirmed: boolean;
  onConsentChange: (checked: boolean) => void;
  thresholds: RiskThresholds;
}

interface LivenessCheckOutput {
  sessionId: string;
  mode: AnalysisMode;
  status: 'SUCCEEDED' | 'FAILED';
  confidence: number;
  spoofIndicators: string[];
  observations: string[];
  idSimilarity: number | null;
  linkedEvaluation: RiskEvaluation | null;
  capturedFrames: string[];
}

export const LivenessStudio: React.FC<LivenessStudioProps> = ({
  mode,
  onModeChange,
  idImage,
  consentConfirmed,
  onConsentChange,
  thresholds,
}) => {
  const [session, setSession] = useState<LivenessSessionInfo | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [challengeStep, setChallengeStep] = useState<number>(-1);
  const [isVerifying, setIsVerifying] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [output, setOutput] = useState<LivenessCheckOutput | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const createSession = async () => {
    setApiError(null);
    setOutput(null);
    setChallengeStep(-1);

    try {
      const res = await fetch('/api/liveness/session', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create liveness session');
      }
      setSession(data);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to start liveness session.');
    }
  };

  const startCameraAndSession = async () => {
    setCameraError(null);
    setApiError(null);
    if (!consentConfirmed) {
      setApiError('Confirm the biometric consent checkbox before starting the liveness check.');
      return;
    }

    await createSession();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Webcam API unavailable in this browser. Switch to Demo Mode (Simulated) to walk through the Option B liveness sequence.'
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
      const msg = err instanceof Error ? err.message : 'Camera access denied.';
      setCameraError(
        `${msg} Ensure HTTPS or localhost and camera permission allowed, or test with Demo Mode.`
      );
    }
  };

  const captureSingleFrame = (): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const runChallengeCapture = async () => {
    if (!session) return;
    setApiError(null);
    setOutput(null);

    const frames: string[] = [];
    for (let i = 0; i < session.challenges.length; i++) {
      setChallengeStep(i);
      await new Promise((r) => setTimeout(r, 1100));
      const frame = captureSingleFrame();
      if (frame) {
        frames.push(frame);
      }
    }
    setChallengeStep(-1);
    stopCamera();

    if (frames.length < 2) {
      setApiError('Could not capture enough webcam frames. Ensure your camera feed is active.');
      return;
    }

    await verifyFrames(frames, session.sessionId);
  };

  const verifyFrames = async (frames: string[], sessionId: string) => {
    setIsVerifying(true);
    setApiError(null);
    try {
      const res = await fetch('/api/liveness/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          frames,
          idImage: idImage ?? undefined,
          consentConfirmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Liveness verification failed.');
      }

      const linkedEvaluation =
        idImage && data.idSimilarity !== null
          ? evaluateRisk(
              {
                faceDetectedInId: true,
                faceDetectedInSelfie: Boolean(data.faceDetectedInReference),
                similarity: data.idSimilarity,
                sharpness: data.quality.sharpness,
                brightness: data.quality.brightness,
                pose: data.quality.pose,
                livenessConfidence: data.confidence,
                livenessPassed: data.status === 'SUCCEEDED',
                spoofIndicators: data.spoofIndicators,
                observations: data.observations,
              },
              thresholds,
              true
            )
          : null;

      setOutput({
        sessionId: data.sessionId,
        mode: 'live',
        status: data.status,
        confidence: data.confidence,
        spoofIndicators: data.spoofIndicators,
        observations: data.observations,
        idSimilarity: data.idSimilarity,
        linkedEvaluation,
        capturedFrames: frames,
      });
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : 'Unable to evaluate liveness challenge frames.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const runSimulatedLiveness = (outcome: 'pass' | 'spoof') => {
    if (!consentConfirmed) {
      setApiError('Confirm the biometric consent checkbox before running a simulated check.');
      return;
    }
    setApiError(null);
    const simId = `sim-${Math.random().toString(36).slice(2, 10)}`;
    const isPass = outcome === 'pass';

    const linkedEvaluation = idImage
      ? evaluateRisk(
          {
            faceDetectedInId: true,
            faceDetectedInSelfie: true,
            similarity: isPass ? 95.8 : 92.4,
            sharpness: 82.0,
            brightness: 66.0,
            pose: { yaw: 1.8, pitch: -0.5, roll: 0.4 },
            livenessConfidence: isPass ? 96.4 : 19.2,
            livenessPassed: isPass,
            spoofIndicators: isPass
              ? []
              : [
                  'Static frame parallax across challenge intervals',
                  'Screen bezel border and LCD moiré interference',
                ],
            observations: isPass
              ? [
                  'Consistent 3D head parallax observed across the 3 challenge frames.',
                  'Natural skin reflectance with zero replay artifacts.',
                ]
              : [
                  'Reference frame visually resembles the ID photo (92.4%), but zero 3D parallax was detected.',
                  'Screen replay reflection detected — demonstrating why Option B Liveness blocks photo attacks.',
                ],
          },
          thresholds,
          true
        )
      : null;

    setOutput({
      sessionId: simId,
      mode: 'demo',
      status: isPass ? 'SUCCEEDED' : 'FAILED',
      confidence: isPass ? 96.4 : 19.2,
      spoofIndicators: isPass
        ? []
        : [
            'Static frame parallax across challenge intervals',
            'Screen bezel border and LCD moiré interference',
          ],
      observations: isPass
        ? [
            'Consistent 3D head parallax observed across the 3 challenge frames.',
            'Natural skin reflectance with zero replay artifacts.',
          ]
        : [
            'Reference frame visually resembles the ID photo (92.4%), but zero 3D parallax was detected.',
            'Screen replay reflection detected — demonstrating why Option B Liveness blocks photo attacks.',
          ],
      idSimilarity: idImage ? (isPass ? 95.8 : 92.4) : null,
      linkedEvaluation,
      capturedFrames: [],
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl text-balance">
            Option B: Multi-Frame Liveness Challenge
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-400 leading-relaxed">
            Matching alone only checks whose face it is. Liveness checks that a live human is physically present right now, catching photos-of-photos and screen replay attacks before linking the reference frame to CompareFaces.
          </p>
        </div>

        <div
          role="group"
          aria-label="Liveness mode"
          className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1 self-start shrink-0"
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
            Live Camera Challenge
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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left: Capture & Challenge Sequence */}
        <div className="space-y-5 lg:col-span-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                01. Biometric Liveness Session
              </h2>
              {session && (
                <span className="font-mono text-xs text-slate-400">
                  Region: {session.region}
                </span>
              )}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={(e) => onConsentChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-sky-500 accent-sky-500 focus:ring-sky-500"
              />
              <span className="text-xs leading-relaxed text-slate-300">
                I consent to live multi-frame liveness processing. Frames remain strictly in memory and are discarded after scoring.
              </span>
            </label>

            {mode === 'live' ? (
              <div className="space-y-4">
                {cameraError && (
                  <div className="rounded-lg border border-amber-700/60 bg-amber-950/60 p-3 text-xs text-amber-200">
                    {cameraError}
                  </div>
                )}

                <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 aspect-[4/3] flex items-center justify-center">
                  {cameraActive ? (
                    <>
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
                        <div className="h-56 w-44 rounded-[50%] border-2 border-dashed border-sky-400/80" />
                      </div>
                      {challengeStep >= 0 && session && (
                        <div className="absolute inset-x-4 bottom-4 rounded-lg bg-slate-950/90 px-4 py-3 text-center text-white border border-slate-800">
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-1.5">
                            <span>Step {challengeStep + 1} of {session.challenges.length}</span>
                            <span>{Math.round(((challengeStep + 1) / session.challenges.length) * 100)}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mb-2">
                            <div
                              className="h-full bg-sky-500 transition-all duration-300"
                              style={{ width: `${((challengeStep + 1) / session.challenges.length) * 100}%` }}
                            />
                          </div>
                          <div className="text-sm font-semibold">
                            {session.challenges[challengeStep]}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-6 text-center text-slate-300">
                      <Camera className="mx-auto h-8 w-8 text-slate-500" aria-hidden="true" />
                      <p className="mt-2 text-sm font-medium text-slate-200">
                        Camera Ready for Liveness Session
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Captures 3 sequential challenge frames (center, slight head turn, frontal) to detect 3D parallax vs flat replay.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {!cameraActive ? (
                    <button
                      type="button"
                      onClick={startCameraAndSession}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 cursor-pointer"
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                      <span>Start Liveness Camera</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={challengeStep >= 0 || isVerifying}
                        onClick={runChallengeCapture}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 cursor-pointer"
                      >
                        <Play className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {challengeStep >= 0
                            ? 'Capturing Challenge Sequence...'
                            : isVerifying
                            ? 'Evaluating Liveness...'
                            : 'Begin 3-Step Capture'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                      >
                        <VideoOff className="h-4 w-4" aria-hidden="true" />
                        <span>Stop</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 border-t border-slate-800 pt-4">
                <p className="text-xs text-slate-400">
                  Simulate the Option B liveness session outcomes directly for live classroom or stakeholder demos:
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => runSimulatedLiveness('pass')}
                    className="rounded-lg border border-emerald-700/60 bg-emerald-950/60 px-4 py-2.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/60 cursor-pointer"
                  >
                    Simulate Live Human (Pass)
                  </button>
                  <button
                    type="button"
                    onClick={() => runSimulatedLiveness('spoof')}
                    className="rounded-lg border border-red-700/60 bg-red-950/60 px-4 py-2.5 text-xs font-semibold text-red-200 hover:bg-red-900/60 cursor-pointer"
                  >
                    Simulate Screen Replay (Spoof)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Linked ID Photo status */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="text-sm font-semibold text-slate-100">
              02. Linked Reference ID Check
            </h3>
            {idImage ? (
              <div className="mt-3 flex items-center gap-4">
                <img
                  src={idImage}
                  alt="Linked reference ID"
                  className="h-16 w-20 rounded-md border border-slate-700 object-cover bg-slate-950"
                />
                <p className="text-xs text-slate-300 leading-relaxed">
                  Reference ID photo from the Verification Lab is linked. After liveness completes, the Reference Frame is automatically passed to face matching.
                </p>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-slate-400">
                Optional: Load or upload a Reference ID photo in the Verification Lab tab to automatically link the liveness ReferenceImage to CompareFaces.
              </p>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div className={`lg:col-span-6 ${isVerifying ? 'animate-pulse' : ''}`}>
          {apiError && (
            <div className="mb-4 rounded-xl border border-red-700/60 bg-red-950/60 p-4 text-sm text-red-100">
              {apiError}
            </div>
          )}

          {isVerifying ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
              <div className="h-20 rounded-lg bg-slate-800" />
              <div className="h-28 rounded-lg bg-slate-800/70" />
            </div>
          ) : output ? (
            <div className="space-y-4">
              {output.mode === 'demo' && (
                <div className="rounded-lg border border-amber-700/60 bg-amber-950/60 px-4 py-2.5 text-xs font-medium text-amber-200">
                  SIMULATED OUTPUT — Demo mode liveness result for presentation walkthrough.
                </div>
              )}

              <div
                className={`rounded-xl border p-5 ${
                  output.status === 'SUCCEEDED'
                    ? 'border-emerald-700/60 bg-emerald-950/50'
                    : 'border-red-700/60 bg-red-950/50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 rounded-lg p-2 ${
                        output.status === 'SUCCEEDED'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {output.status === 'SUCCEEDED' ? (
                        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <div className="font-mono text-xs text-slate-300">
                        Session {output.sessionId.slice(0, 12)} · Status: {output.status}
                      </div>
                      <h2
                        className={`mt-1 text-xl font-bold ${
                          output.status === 'SUCCEEDED'
                            ? 'text-emerald-100'
                            : 'text-red-100'
                        }`}
                      >
                        {output.status === 'SUCCEEDED'
                          ? 'Live Person Verified'
                          : 'Spoof / Replay Detected'}
                      </h2>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-medium text-slate-300">Confidence</div>
                    <div className="font-mono text-2xl font-bold tabular-nums text-slate-50">
                      {output.confidence.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {output.capturedFrames.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <h3 className="text-sm font-semibold text-slate-100">
                    In-Memory Audit Frames ({output.capturedFrames.length})
                  </h3>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {output.capturedFrames.map((src, idx) => (
                      <div key={idx} className="space-y-1">
                        <img
                          src={src}
                          alt={`Liveness challenge frame ${idx + 1}`}
                          className="h-24 w-full rounded-lg border border-slate-700 object-cover"
                        />
                        <div className="font-mono text-[11px] text-slate-400 text-center">
                          Frame 0{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-100">
                  Liveness Observations
                </h3>
                {output.spoofIndicators.length > 0 && (
                  <div className="rounded-lg border border-red-700/60 bg-red-950/60 p-3 text-xs text-red-100">
                    <div className="font-semibold">Spoof Cues Flagged:</div>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {output.spoofIndicators.map((cue, idx) => (
                        <li key={idx}>{cue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <ul className="space-y-2 text-sm text-slate-200">
                  {output.observations.map((obs, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      {output.status === 'SUCCEEDED' ? (
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                          aria-hidden="true"
                        />
                      ) : (
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
                          aria-hidden="true"
                        />
                      )}
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {output.linkedEvaluation && output.idSimilarity !== null && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-100">
                      Linked ReferenceImage → CompareFaces Verdict
                    </h3>
                    <span className="font-mono text-sm font-semibold tabular-nums text-slate-50">
                      {output.idSimilarity.toFixed(1)}% Similarity
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Combined Verdict:{' '}
                    <strong className="text-slate-50">
                      {output.linkedEvaluation.verdictLabel}
                    </strong>{' '}
                    ({output.linkedEvaluation.actionLabel}) — {output.linkedEvaluation.summary}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <RefreshCw className="h-4 w-4 text-sky-400" aria-hidden="true" />
                <span>How Option B Streaming Liveness Works</span>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-slate-300 list-decimal pl-5">
                <li>
                  Backend creates an ephemeral liveness session (`CreateFaceLivenessSession`) and returns a `SessionId`.
                </li>
                <li>
                  The browser widget guides the user through a brief 3-step capture inside the face oval to test natural 3D parallax and lighting consistency.
                </li>
                <li>
                  `GetFaceLivenessSessionResults` returns `Status`, `Confidence` (0–100), and a clean `ReferenceImage`.
                </li>
                <li>
                  If an ID photo is provided, the `ReferenceImage` is passed to `CompareFaces`, linking liveness and identity into one combined verdict.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
