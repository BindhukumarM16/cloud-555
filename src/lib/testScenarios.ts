import { TestCaseScenario } from '../types/verification';

export const TEST_SCENARIOS: TestCaseScenario[] = [
  {
    id: 'genuine',
    title: 'Genuine user',
    testCaseLabel: 'Your live selfie vs your own ID-style photo',
    expectedVerdict: 'Genuine',
    expectedLevel: 'genuine',
    notes: 'Good light, face straight to camera',
    optionNote: 'Passes both Option A (compare-only) and Option B (liveness).',
    simulatedSignals: {
      faceDetectedInId: true,
      faceDetectedInSelfie: true,
      similarity: 97.4,
      sharpness: 82.0,
      brightness: 61.0,
      pose: { yaw: 3.0, pitch: 2.0, roll: -1.0 },
      livenessConfidence: 96.0,
      livenessPassed: true,
      spoofIndicators: [],
      observations: [
        'Frontal facial geometry, eye spacing, and jawline proportions align closely.',
        'Even ambient illumination with sharp iris and skin detail.',
      ],
    },
  },
  {
    id: 'mismatch',
    title: 'Different person',
    testCaseLabel: "Friend's selfie vs your ID photo",
    expectedVerdict: 'Likely Fake',
    expectedLevel: 'fake',
    notes: 'Shows identity mismatch',
    optionNote: 'Rejected immediately by CompareFaces similarity threshold (< 70%).',
    simulatedSignals: {
      faceDetectedInId: true,
      faceDetectedInSelfie: true,
      similarity: 23.1,
      sharpness: 78.0,
      brightness: 58.0,
      pose: { yaw: 5.0, pitch: 1.0, roll: 0.0 },
      livenessConfidence: 94.0,
      livenessPassed: true,
      spoofIndicators: [],
      observations: [
        'Live person detected with good image quality, but facial landmarks do not match the ID photo.',
        'Inter-ocular ratio and nasal bridge structure diverge significantly.',
      ],
    },
  },
  {
    id: 'dark_blur',
    title: 'Dark / blurry capture',
    testCaseLabel: 'Your selfie in a dark room or blurred',
    expectedVerdict: 'Suspicious',
    expectedLevel: 'suspicious',
    notes: 'Quality flags explain why',
    optionNote: 'Routed to human review due to low brightness (12) and low sharpness (18).',
    simulatedSignals: {
      faceDetectedInId: true,
      faceDetectedInSelfie: true,
      similarity: 81.2,
      sharpness: 18.0,
      brightness: 12.0,
      pose: { yaw: 6.0, pitch: 3.0, roll: 2.0 },
      livenessConfidence: 90.0,
      livenessPassed: true,
      spoofIndicators: [],
      observations: [
        'Severe underexposure and motion blur reduce facial feature confidence.',
        'Subject face appears partially shadowed; manual reviewer confirmation recommended.',
      ],
    },
  },
  {
    id: 'no_face',
    title: 'No face in frame',
    testCaseLabel: 'No face in frame (hand, wall)',
    expectedVerdict: 'Likely Fake',
    expectedLevel: 'fake',
    notes: 'DetectFaces returns no face',
    optionNote: 'Blocked automatically because no biometric face bounding box exists.',
    simulatedSignals: {
      faceDetectedInId: true,
      faceDetectedInSelfie: false,
      similarity: 0.0,
      sharpness: 0.0,
      brightness: 0.0,
      pose: { yaw: 0, pitch: 0, roll: 0 },
      livenessConfidence: 3.0,
      livenessPassed: false,
      spoofIndicators: ['No face bounding box detected'],
      observations: [
        'Frame contains background surface or occlusion with zero detectable facial landmarks.',
      ],
    },
  },
  {
    id: 'photo_replay',
    title: 'Spoof: photo of a photo',
    testCaseLabel: 'Photo of your photo held to the camera',
    expectedVerdict: 'Option A passes · Option B fails',
    expectedLevel: 'fake',
    notes: 'This is the reason liveness is needed',
    optionNote:
      'Compare-only mode sees a high facial match (94.0%), while Liveness fails (confidence 8.0%).',
    simulatedSignals: {
      faceDetectedInId: true,
      faceDetectedInSelfie: true,
      similarity: 94.0,
      sharpness: 55.0,
      brightness: 52.0,
      pose: { yaw: 2.0, pitch: 0.0, roll: 0.0 },
      livenessConfidence: 8.0,
      livenessPassed: false,
      spoofIndicators: [
        'Rectangular screen bezel edges detected',
        'LCD pixel moiré interference',
        'Specular screen glare across forehead',
      ],
      observations: [
        'Face visually matches the reference ID (94.0%), demonstrating why CompareFaces alone can be fooled.',
        'Liveness inspection detected flat-plane replay artifacts and screen reflection.',
      ],
    },
  },
];

function drawSyntheticPortrait(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: {
    variant: 'personA' | 'personB' | 'darkBlur' | 'noFace' | 'screenReplay';
    isIdCard?: boolean;
  }
) {
  if (opts.isIdCard) {
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 13px sans-serif';
    ctx.fillText('SAMPLE ID · DEMO CREDENTIAL', 18, 28);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 56, w - 20, h - 68);
  } else if (opts.variant === 'darkBlur') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(1, '#1E293B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (opts.variant === 'noFace') {
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    for (let y = 40; y < h; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#475569';
    ctx.font = '600 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Occluded Frame / Background Wall', w / 2, h / 2);
    return;
  } else if (opts.variant === 'screenReplay') {
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#090D16';
    ctx.fillRect(46, 26, w - 92, h - 52);
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 3;
    ctx.strokeRect(46, 26, w - 92, h - 52);
    ctx.fillStyle = '#DBEAFE';
    ctx.fillRect(62, 46, w - 124, h - 92);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#F1F5F9');
    grad.addColorStop(1, '#E2E8F0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  const cx = w / 2;
  const cy = opts.isIdCard ? h / 2 + 18 : h / 2;
  const scale = opts.isIdCard ? 0.84 : opts.variant === 'screenReplay' ? 0.72 : 1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  if (opts.variant === 'darkBlur') {
    ctx.globalAlpha = 0.42;
  }

  const isPersonB = opts.variant === 'personB';

  ctx.fillStyle = isPersonB ? '#0F766E' : '#1E40AF';
  ctx.beginPath();
  ctx.ellipse(0, 118, 86, 56, 0, Math.PI, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = isPersonB ? '#D99B78' : '#E6B89C';
  ctx.fillRect(-18, 42, 36, 36);

  ctx.fillStyle = isPersonB ? '#D99B78' : '#F0C6AA';
  ctx.beginPath();
  ctx.ellipse(0, -10, isPersonB ? 56 : 50, isPersonB ? 66 : 62, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isPersonB ? '#451A03' : '#1E293B';
  ctx.beginPath();
  if (isPersonB) {
    ctx.ellipse(0, -48, 60, 34, 0, Math.PI, 2 * Math.PI);
  } else {
    ctx.ellipse(0, -44, 53, 32, 0, Math.PI, 2 * Math.PI);
  }
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  const eyeOffset = isPersonB ? 22 : 19;
  ctx.beginPath();
  ctx.arc(-eyeOffset, -14, 4.5, 0, Math.PI * 2);
  ctx.arc(eyeOffset, -14, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isPersonB ? '#451A03' : '#1E293B';
  ctx.lineWidth = isPersonB ? 4 : 3;
  ctx.beginPath();
  ctx.moveTo(-eyeOffset - 10, -25);
  ctx.lineTo(-eyeOffset + 10, -27);
  ctx.moveTo(eyeOffset - 10, -27);
  ctx.lineTo(eyeOffset + 10, -25);
  ctx.stroke();

  ctx.strokeStyle = '#B48367';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(-4, 10);
  ctx.lineTo(4, 10);
  ctx.stroke();

  ctx.strokeStyle = '#9A5B4B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (isPersonB) {
    ctx.moveTo(-14, 27);
    ctx.lineTo(14, 27);
  } else {
    ctx.arc(0, 22, 14, 0.15 * Math.PI, 0.85 * Math.PI);
  }
  ctx.stroke();

  if (isPersonB) {
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-33, -24, 23, 18);
    ctx.strokeRect(10, -24, 23, 18);
    ctx.beginPath();
    ctx.moveTo(-10, -15);
    ctx.lineTo(10, -15);
    ctx.stroke();
  }

  ctx.restore();

  if (opts.variant === 'screenReplay') {
    ctx.strokeStyle = 'rgba(30, 64, 175, 0.18)';
    ctx.lineWidth = 1;
    for (let y = 48; y < h - 48; y += 5) {
      ctx.beginPath();
      ctx.moveTo(64, y);
      ctx.lineTo(w - 64, y);
      ctx.stroke();
    }
    const glare = ctx.createLinearGradient(60, 40, w - 60, h - 40);
    glare.addColorStop(0, 'rgba(255,255,255,0.45)');
    glare.addColorStop(0.4, 'rgba(255,255,255,0)');
    ctx.fillStyle = glare;
    ctx.fillRect(62, 46, w - 124, h - 92);
  }

  if (opts.variant === 'darkBlur') {
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '500 12px monospace';
    ctx.fillText('LOW LIGHT / MOTION BLUR SAMPLE', 16, h - 16);
  }

  if (opts.isIdCard) {
    ctx.fillStyle = '#334155';
    ctx.font = '500 11px monospace';
    ctx.fillText('REF-ID: DEMO-SUBJECT-01', 20, h - 22);
  }
}

export function generateScenarioImages(scenarioId: TestCaseScenario['id']): {
  idDataUrl: string;
  selfieDataUrl: string;
} {
  const createCanvasDataUrl = (
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      draw(ctx, canvas.width, canvas.height);
    }
    return canvas.toDataURL('image/png');
  };

  const idDataUrl = createCanvasDataUrl((ctx, w, h) =>
    drawSyntheticPortrait(ctx, w, h, { variant: 'personA', isIdCard: true })
  );

  const variantMap: Record<
    TestCaseScenario['id'],
    'personA' | 'personB' | 'darkBlur' | 'noFace' | 'screenReplay'
  > = {
    genuine: 'personA',
    mismatch: 'personB',
    dark_blur: 'darkBlur',
    no_face: 'noFace',
    photo_replay: 'screenReplay',
  };

  const selfieDataUrl = createCanvasDataUrl((ctx, w, h) =>
    drawSyntheticPortrait(ctx, w, h, { variant: variantMap[scenarioId] })
  );

  return { idDataUrl, selfieDataUrl };
}
