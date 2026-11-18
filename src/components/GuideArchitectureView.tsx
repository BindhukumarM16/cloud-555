import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Pause,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react';

const DEMO_SCRIPT_STEPS = [
  'State the problem in one line: deepfakes and spoofed faces break fake-proof KYC.',
  'Show the architecture pipeline and explain why CompareFaces alone cannot verify live presence.',
  'Run the Genuine case and point to the similarity score, quality metrics, and verdict.',
  'Run the Identity Mismatch case, then the Dark-Image case, and explain the Suspicious path to a human reviewer.',
  'Show the Option B Liveness step and explain why 3D challenge frames catch photos and screen replays.',
  'Close with limits: the score is a risk indicator, face data needs consent, and a person makes the final call.',
];

const VIVA_QUESTIONS = [
  {
    question: 'Where is the AI model?',
    answer:
      'In Amazon Rekognition on AWS (or server-side Gemini Vision in this interactive web sandbox). The app calls the vision service through the SDK; we did not train a custom model.',
  },
  {
    question: 'How is this different from simple face matching?',
    answer:
      'Face matching only checks whose face appears in two images. Liveness checks that a real, physically present human is in front of the camera right now rather than a printed photo or screen replay.',
  },
  {
    question: 'Can it be fooled?',
    answer:
      'Yes. No detector is 100% immune, which is why borderline scores and poor-quality captures route to a human reviewer and risk thresholds require periodic calibration on larger datasets.',
  },
  {
    question: 'What about privacy?',
    answer:
      'Explicit consent is required before analysis. Images are processed strictly in memory and discarded immediately; only risk scores and decisions are surfaced.',
  },
  {
    question: 'Why a cloud service?',
    answer:
      'Zero model training overhead, low-latency inference, automatic scaling across users, and pay-per-use pricing.',
  },
];

const MINIMAL_IAM_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:CompareFaces",
        "rekognition:DetectFaces",
        "rekognition:CreateFaceLivenessSession",
        "rekognition:GetFaceLivenessSessionResults"
      ],
      "Resource": "*"
    }
  ]
}`;

const TROUBLESHOOTING_ROWS = [
  {
    problem: 'AccessDeniedException',
    fix: 'IAM policy missing an action or wrong IAM user. Verify CompareFaces, DetectFaces, and Liveness permissions.',
  },
  {
    problem: 'InvalidParameterException / no face',
    fix: 'Image too small, no clear face, or unsupported format. Use JPEG or PNG with a clear frontal face.',
  },
  {
    problem: 'Liveness not available',
    fix: 'Region is unsupported. Switch to us-east-1, us-west-2, eu-west-1, ap-northeast-1, or ap-south-1.',
  },
  {
    problem: 'Credentials error',
    fix: 'Run aws configure again or verify environment variables without hardcoding access keys in source code.',
  },
  {
    problem: 'Camera not opening',
    fix: 'Browser requires HTTPS or localhost and explicit camera permission enabled.',
  },
];

export const GuideArchitectureView: React.FC = () => {
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [openViva, setOpenViva] = useState<number | null>(0);
  const [copiedPolicy, setCopiedPolicy] = useState(false);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCopyPolicy = async () => {
    try {
      await navigator.clipboard.writeText(MINIMAL_IAM_POLICY);
      setCopiedPolicy(true);
      setTimeout(() => setCopiedPolicy(false), 1800);
    } catch {
      // Clipboard ignored
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl text-balance">
          Architecture, 4-Minute Demo Script &amp; Viva Guide
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-400 leading-relaxed">
          Complete reference companion for presenting the Deepfake Detection and Digital Identity Protection case study, AWS Rekognition setup, privacy guardrails, and viva defense.
        </p>
      </div>

      {/* 4-Minute Demo Script & Timer */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              01. 4-Minute Demo Script &amp; Presenter Stopwatch
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Target duration: 3:00 – 4:00 minutes covering Genuine, Mismatch, Dark/Blurry, and Liveness checks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`font-mono text-xl font-bold tabular-nums ${
                secondsElapsed > 240 ? 'text-amber-400' : 'text-slate-100'
              }`}
            >
              {formatTimer(secondsElapsed)}
            </span>
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 cursor-pointer"
            >
              {timerRunning ? (
                <>
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Start</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setSecondsElapsed(0);
              }}
              aria-label="Reset demo timer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* 4-minute target pacing bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>
              {Object.values(checkedSteps).filter(Boolean).length} / {DEMO_SCRIPT_STEPS.length} talking points covered
            </span>
            <span>Target: 04:00</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                secondsElapsed > 240 ? 'bg-amber-500' : 'bg-sky-500'
              }`}
              style={{ width: `${Math.min(100, (secondsElapsed / 240) * 100)}%` }}
            />
          </div>
        </div>

        <ol className="mt-4 divide-y divide-slate-800">
          {DEMO_SCRIPT_STEPS.map((step, idx) => {
            const checked = Boolean(checkedSteps[idx]);
            return (
              <li key={idx} className="py-3">
                <button
                  type="button"
                  onClick={() =>
                    setCheckedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }))
                  }
                  className="flex w-full items-start gap-3 text-left cursor-pointer"
                >
                  {checked ? (
                    <CheckSquare
                      className="mt-0.5 h-4 w-4 shrink-0 text-sky-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <Square
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`text-sm leading-relaxed ${
                      checked ? 'text-slate-500 line-through' : 'text-slate-200'
                    }`}
                  >
                    <strong className="font-mono text-xs text-slate-400 mr-2">
                      0{idx + 1}.
                    </strong>
                    {step}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Option A vs Option B Comparison */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-base font-semibold text-slate-100">
          02. Choosing the Demo Architecture (Option A vs Option B)
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950/60 text-xs font-semibold text-slate-300">
              <tr>
                <th className="px-4 py-3">Dimension</th>
                <th className="px-4 py-3">Option A: Compare + Quality (Recommended)</th>
                <th className="px-4 py-3">Option B: Full Streaming Liveness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs sm:text-sm text-slate-300">
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-100">Stack</td>
                <td className="px-4 py-3">
                  Streamlit + boto3 calling CompareFaces and DetectFaces
                </td>
                <td className="px-4 py-3">
                  React page with Amplify FaceLivenessDetector + Python/Lambda backend
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-100">Detects</td>
                <td className="px-4 py-3">Face mismatch, poor image quality, off-angle pose</td>
                <td className="px-4 py-3">All of Option A, plus photo spoofing &amp; screen replay attacks</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-100">Effort</td>
                <td className="px-4 py-3">1 to 2 hours</td>
                <td className="px-4 py-3">Half a day or more</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-100">Key Limitation</td>
                <td className="px-4 py-3">
                  A compare-only check cannot tell a live face from a photo of a face. State this openly.
                </td>
                <td className="px-4 py-3">
                  Requires Cognito identity pool credentials &amp; supported AWS region (e.g., us-east-1, ap-south-1).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Minimal IAM Policy + Privacy & Cost */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-100">
              03. Minimal AWS IAM Policy
            </h2>
            <button
              type="button"
              onClick={handleCopyPolicy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copiedPolicy ? 'Copied' : 'Copy Policy'}</span>
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Least-privilege policy for Rekognition demo user. Keep access keys out of code and GitHub; delete keys after demo.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-sky-200">
            {MINIMAL_IAM_POLICY}
          </pre>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-100">
            04. Cost, Privacy &amp; Safety Checklist
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-300 list-disc pl-5">
            <li>
              Set a budget alert (e.g., USD 5) in AWS Budgets before starting. Rekognition bills per API call (`CompareFaces` + `DetectFaces` = 2 calls).
            </li>
            <li>
              Face Liveness is billed per check (approx. USD 0.015 per check in US East; confirm current AWS pricing).
            </li>
            <li>
              Include a privacy notice: Face Liveness may retain processed selfie video to improve AWS service unless opted out in data-privacy settings.
            </li>
            <li>
              Test only with your own face or consenting peers. Never upload another person&apos;s real government ID.
            </li>
            <li>
              Never hardcode AWS credentials or API keys in source repositories.
            </li>
          </ul>
        </section>
      </div>

      {/* Troubleshooting & Viva */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-base font-semibold text-slate-100">
            05. Common Problems &amp; Fixes
          </h2>
          <dl className="mt-4 divide-y divide-slate-800">
            {TROUBLESHOOTING_ROWS.map((row) => (
              <div key={row.problem} className="py-3">
                <dt className="font-mono text-xs font-semibold text-sky-300">
                  {row.problem}
                </dt>
                <dd className="mt-1 text-xs leading-relaxed text-slate-300">
                  {row.fix}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-base font-semibold text-slate-100">
            06. Likely Viva Questions
          </h2>
          <div className="mt-4 divide-y divide-slate-800">
            {VIVA_QUESTIONS.map((item, idx) => {
              const isOpen = openViva === idx;
              return (
                <div key={item.question} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenViva(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-slate-100 hover:text-sky-400 cursor-pointer"
                  >
                    <span>{item.question}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
