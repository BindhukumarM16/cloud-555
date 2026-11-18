import {
  BiometricSignals,
  ReasonItem,
  RiskEvaluation,
  RiskThresholds,
} from '../types/verification';

export const DEFAULT_THRESHOLDS: RiskThresholds = {
  genuineSimilarityMin: 90,
  suspiciousSimilarityMin: 70,
  sharpnessMin: 40,
  brightnessMin: 30,
  brightnessMax: 90,
  maxAbsYaw: 25,
  livenessConfidenceMin: 80,
};

export function evaluateRisk(
  signals: BiometricSignals,
  thresholds: RiskThresholds,
  requireLiveness: boolean
): RiskEvaluation {
  const reasons: ReasonItem[] = [];
  let level: 0 | 1 | 2 = 0; // 0 = GENUINE, 1 = SUSPICIOUS, 2 = FAKE

  if (!signals.faceDetectedInId) {
    reasons.push({
      code: 'NO_ID_FACE',
      status: 'fail',
      message: 'No clear frontal face was detected in the reference ID photo.',
    });
    level = 2;
  }

  if (!signals.faceDetectedInSelfie) {
    reasons.push({
      code: 'NO_SELFIE_FACE',
      status: 'fail',
      message: 'No face was detected in the selfie.',
    });
    level = 2;
  } else if (signals.faceDetectedInId) {
    const absYaw = Math.abs(signals.pose.yaw);
    const similarity = Number(signals.similarity.toFixed(1));
    const sharpness = Number(signals.sharpness.toFixed(1));
    const brightness = Number(signals.brightness.toFixed(1));

    // Similarity evaluation
    if (similarity < thresholds.suspiciousSimilarityMin) {
      reasons.push({
        code: 'SIMILARITY_LOW',
        status: 'fail',
        message: `Similarity ${similarity}% is below ${thresholds.suspiciousSimilarityMin}%: the faces do not match.`,
      });
      level = 2;
    } else if (similarity < thresholds.genuineSimilarityMin) {
      reasons.push({
        code: 'SIMILARITY_BORDERLINE',
        status: 'warn',
        message: `Similarity ${similarity}% is between ${thresholds.suspiciousSimilarityMin}% and ${thresholds.genuineSimilarityMin}%: uncertain match.`,
      });
      if (level < 1) level = 1;
    } else {
      reasons.push({
        code: 'SIMILARITY_HIGH',
        status: 'pass',
        message: `Similarity ${similarity}% meets the ${thresholds.genuineSimilarityMin}% threshold.`,
      });
    }

    // Quality evaluation
    const qualityIssues: ReasonItem[] = [];
    if (sharpness < thresholds.sharpnessMin) {
      qualityIssues.push({
        code: 'SHARPNESS_LOW',
        status: 'warn',
        message: `Image is blurry (sharpness ${sharpness.toFixed(0)} < ${thresholds.sharpnessMin}).`,
      });
    }
    if (brightness < thresholds.brightnessMin) {
      qualityIssues.push({
        code: 'BRIGHTNESS_DARK',
        status: 'warn',
        message: `Image is too dark (brightness ${brightness.toFixed(0)} < ${thresholds.brightnessMin}).`,
      });
    }
    if (brightness > thresholds.brightnessMax) {
      qualityIssues.push({
        code: 'BRIGHTNESS_OVEREXPOSED',
        status: 'warn',
        message: `Image is overexposed (brightness ${brightness.toFixed(0)} > ${thresholds.brightnessMax}).`,
      });
    }
    if (absYaw > thresholds.maxAbsYaw) {
      qualityIssues.push({
        code: 'POSE_TURNED',
        status: 'warn',
        message: `Face is turned away (yaw ${signals.pose.yaw.toFixed(0)}° exceeds ±${thresholds.maxAbsYaw}°).`,
      });
    }

    if (qualityIssues.length > 0) {
      reasons.push(...qualityIssues);
      if (level < 1) level = 1;
    } else {
      reasons.push({
        code: 'QUALITY_OK',
        status: 'pass',
        message: 'Image quality is acceptable (sharpness, brightness and pose).',
      });
    }
  }

  // Liveness evaluation
  if (!requireLiveness) {
    reasons.push({
      code: 'COMPARE_ONLY_LIMIT',
      status: 'warn',
      message:
        'Liveness check not run: a compare-only check cannot tell a live face from a photo of a face.',
    });
  } else {
    const conf = signals.livenessConfidence ?? 0;
    const passed =
      signals.livenessPassed !== false &&
      conf >= thresholds.livenessConfidenceMin &&
      signals.spoofIndicators.length === 0;

    if (passed) {
      reasons.push({
        code: 'LIVENESS_PASS',
        status: 'pass',
        message: `Liveness passed: confidence ${conf.toFixed(0)}% (meets ${thresholds.livenessConfidenceMin}%+ threshold).`,
      });
    } else {
      const spoofDetail =
        signals.spoofIndicators.length > 0
          ? ` Indicators: ${signals.spoofIndicators.join(', ')}.`
          : '';
      reasons.push({
        code: 'LIVENESS_FAIL',
        status: 'fail',
        message: `Liveness FAILED: confidence ${conf.toFixed(0)}% (needs ${thresholds.livenessConfidenceMin}%+). Possible photo or screen-replay attack.${spoofDetail}`,
      });
      level = 2;
    }
  }

  if (level === 2) {
    return {
      verdict: 'fake',
      verdictLabel: 'Likely Fake / Spoofed',
      actionLabel: 'Block and alert',
      summary: !signals.faceDetectedInSelfie || !signals.faceDetectedInId
        ? 'Face detection failed on one or both input images.'
        : requireLiveness && (signals.livenessPassed === false || (signals.livenessConfidence ?? 0) < thresholds.livenessConfidenceMin)
        ? 'Liveness verification failed; suspected photo or screen-replay spoof.'
        : 'Face similarity fell below the minimum threshold; identity mismatch.',
      reasons,
    };
  }

  if (level === 1) {
    return {
      verdict: 'suspicious',
      verdictLabel: 'Suspicious',
      actionLabel: 'Send to human review',
      summary:
        'Similarity is in the uncertain band or capture quality/pose fell outside nominal thresholds.',
      reasons,
    };
  }

  return {
    verdict: 'genuine',
    verdictLabel: 'Genuine',
    actionLabel: 'Allow',
    summary: requireLiveness
      ? 'Live presence verified, identity matches reference ID, and capture quality meets all thresholds.'
      : 'Identity matches reference ID and capture quality meets all thresholds (compare-only mode).',
    reasons,
  };
}
