import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function stripDataUrlPrefix(input: string): { mimeType: string; data: string } {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(input.trim());
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: 'image/jpeg', data: input.trim() };
}

interface EphemeralLivenessSession {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  challenges: string[];
  region: string;
}

// Ephemeral in-memory session registry; no biometric images are stored.
const livenessSessions = new Map<string, EphemeralLivenessSession>();

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of livenessSessions.entries()) {
    if (session.expiresAt < now) {
      livenessSessions.delete(id);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      aiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
    });
  });

  app.post('/api/verify', async (req: Request, res: Response) => {
    try {
      const { idImage, selfieImage, consentConfirmed, requireLiveness } = req.body as {
        idImage?: string;
        selfieImage?: string;
        consentConfirmed?: boolean;
        requireLiveness?: boolean;
      };

      if (!consentConfirmed) {
        res.status(400).json({ error: 'Biometric processing consent is required before analysis.' });
        return;
      }

      if (!idImage || !selfieImage) {
        res.status(400).json({ error: 'Both a reference ID photo and a selfie image are required.' });
        return;
      }

      const idPartData = stripDataUrlPrefix(idImage);
      const selfiePartData = stripDataUrlPrefix(selfieImage);

      const ai = getAiClient();

      const promptText = `You are a forensic identity verification and anti-spoofing analyst simulating an Amazon Rekognition CompareFaces + DetectFaces + FaceLiveness pipeline.
Analyze the TWO provided images strictly:
- Image 1: Reference ID-style photo.
- Image 2: Live selfie or probe capture.

Evaluate carefully and return accurate numeric metrics:
1. faceDetectedInId: true if a clear human or illustrated portrait face is visible in Image 1, false if blank/wall/hand/no face.
2. faceDetectedInSelfie: true if a clear human or illustrated portrait face is visible in Image 2, false if blank/wall/hand/no face.
3. similarity (0 to 100): Facial identity match likelihood between Image 1 and Image 2. If either has no face, return 0. If clearly the same person, 90-99. If clearly a different person (different structure, glasses/features mismatch), 10-45.
4. sharpness (0 to 100): Visual crispness/focus of Image 2 (under 40 means blurry/out of focus).
5. brightness (0 to 100): Exposure luminance of Image 2 (under 30 is dark/underexposed, over 90 is washed out/overexposed, 40-80 is ideal).
6. pose: Estimated head orientation in degrees for Image 2: yaw (-90 to +90 left/right turn), pitch (-90 to +90 up/down), roll (-90 to +90 tilt).
7. livenessConfidence (0 to 100): Likelihood that Image 2 is a genuine live capture rather than a spoof (photo of a photo, phone/monitor screen replay, bezel edges, moire, specular screen glare, or synthetic artifacts).
8. livenessPassed (boolean): true if Image 2 appears to be a direct capture with no replay/spoof artifacts and a face is detected.
9. spoofIndicators: Array of specific visual spoof/replay cues observed in Image 2 (e.g., "Screen bezel frame visible", "Moire pixel interference", "Specular screen glare", "Printed paper edge"). Empty array [] if none.
10. observations: 2 to 4 concise factual findings explaining the similarity, quality, pose, and spoof/liveness cues.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { inlineData: { mimeType: idPartData.mimeType, data: idPartData.data } },
            { inlineData: { mimeType: selfiePartData.mimeType, data: selfiePartData.data } },
            { text: promptText },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              faceDetectedInId: { type: Type.BOOLEAN },
              faceDetectedInSelfie: { type: Type.BOOLEAN },
              similarity: { type: Type.NUMBER },
              sharpness: { type: Type.NUMBER },
              brightness: { type: Type.NUMBER },
              pose: {
                type: Type.OBJECT,
                properties: {
                  yaw: { type: Type.NUMBER },
                  pitch: { type: Type.NUMBER },
                  roll: { type: Type.NUMBER },
                },
                required: ['yaw', 'pitch', 'roll'],
              },
              livenessConfidence: { type: Type.NUMBER },
              livenessPassed: { type: Type.BOOLEAN },
              spoofIndicators: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              observations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'faceDetectedInId',
              'faceDetectedInSelfie',
              'similarity',
              'sharpness',
              'brightness',
              'pose',
              'livenessConfidence',
              'livenessPassed',
              'spoofIndicators',
              'observations',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());

      const signals = {
        faceDetectedInId: Boolean(parsed.faceDetectedInId),
        faceDetectedInSelfie: Boolean(parsed.faceDetectedInSelfie),
        similarity: Math.max(0, Math.min(100, Number(parsed.similarity ?? 0))),
        sharpness: Math.max(0, Math.min(100, Number(parsed.sharpness ?? 0))),
        brightness: Math.max(0, Math.min(100, Number(parsed.brightness ?? 0))),
        pose: {
          yaw: Number(parsed.pose?.yaw ?? 0),
          pitch: Number(parsed.pose?.pitch ?? 0),
          roll: Number(parsed.pose?.roll ?? 0),
        },
        livenessConfidence: Math.max(0, Math.min(100, Number(parsed.livenessConfidence ?? 0))),
        livenessPassed: Boolean(parsed.livenessPassed),
        spoofIndicators: Array.isArray(parsed.spoofIndicators)
          ? parsed.spoofIndicators.map(String)
          : [],
        observations: Array.isArray(parsed.observations)
          ? parsed.observations.map(String)
          : [],
      };

      const rawPayload = {
        Engine: 'Gemini Vision Biometric Analyzer (gemini-4-hydrogen)',
        PipelineEquivalent: requireLiveness
          ? ['CreateFaceLivenessSession', 'GetFaceLivenessSessionResults', 'CompareFaces', 'DetectFaces']
          : ['CompareFaces', 'DetectFaces'],
        CompareFaces: {
          FaceMatches:
            signals.faceDetectedInId && signals.faceDetectedInSelfie
              ? [{ Similarity: Number(signals.similarity.toFixed(2)) }]
              : [],
        },
        DetectFaces: {
          FaceDetails: signals.faceDetectedInSelfie
            ? [
                {
                  Quality: {
                    Brightness: Number(signals.brightness.toFixed(2)),
                    Sharpness: Number(signals.sharpness.toFixed(2)),
                  },
                  Pose: {
                    Yaw: Number(signals.pose.yaw.toFixed(2)),
                    Pitch: Number(signals.pose.pitch.toFixed(2)),
                    Roll: Number(signals.pose.roll.toFixed(2)),
                  },
                },
              ]
            : [],
        },
        LivenessEvaluation: requireLiveness
          ? {
              Status: signals.livenessPassed ? 'SUCCEEDED' : 'FAILED',
              Confidence: Number((signals.livenessConfidence ?? 0).toFixed(2)),
              SpoofIndicators: signals.spoofIndicators,
            }
          : null,
        PrivacyNote: 'Images processed strictly in-memory and discarded immediately.',
      };

      res.json({ signals, rawPayload });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected server error during verification.';
      const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/liveness/session', (_req: Request, res: Response) => {
    pruneExpiredSessions();
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const session: EphemeralLivenessSession = {
      sessionId,
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000,
      challenges: [
        'Center your face inside the oval frame',
        'Turn your head slightly left (~15 degrees)',
        'Look straight ahead in even lighting',
      ],
      region: 'ap-south-1',
    };
    livenessSessions.set(sessionId, session);
    res.json({
      sessionId: session.sessionId,
      createdAt: new Date(session.createdAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      challenges: session.challenges,
      region: session.region,
    });
  });

  app.post('/api/liveness/verify', async (req: Request, res: Response) => {
    try {
      const { sessionId, frames, idImage, consentConfirmed } = req.body as {
        sessionId?: string;
        frames?: string[];
        idImage?: string;
        consentConfirmed?: boolean;
      };

      if (!consentConfirmed) {
        res.status(400).json({ error: 'Biometric processing consent is required.' });
        return;
      }

      if (!sessionId || !livenessSessions.has(sessionId)) {
        res.status(400).json({ error: 'Invalid or expired liveness session ID.' });
        return;
      }

      if (!Array.isArray(frames) || frames.length < 2) {
        res.status(400).json({ error: 'At least 2 challenge frames are required for liveness analysis.' });
        return;
      }

      const ai = getAiClient();
      const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

      frames.slice(0, 3).forEach((frame) => {
        const parsedFrame = stripDataUrlPrefix(frame);
        parts.push({
          inlineData: { mimeType: parsedFrame.mimeType, data: parsedFrame.data },
        });
      });

      const hasId = Boolean(idImage);
      if (idImage) {
        const parsedId = stripDataUrlPrefix(idImage);
        parts.push({
          inlineData: { mimeType: parsedId.mimeType, data: parsedId.data },
        });
      }

      parts.push({
        text: `You are evaluating a multi-frame Face Liveness challenge (${frames.length} sequential webcam frames${hasId ? ', followed by 1 Reference ID photo as the final image' : ''}).
Assess:
1. Whether a real live human is present across the sequential frames with natural 3D head-pose parallax and consistent lighting.
2. Whether any replay/spoofing attack cues appear (static frozen face across frames, phone/monitor bezel, moire pixel grid, specular glass glare, or printed paper edge).
3. ${hasId ? 'Compare the final reference frame against the Reference ID photo for facial similarity (0-100) and report quality metrics (sharpness, brightness, pose).' : 'Report quality metrics (sharpness, brightness, pose) for the final frame and set idSimilarity to 0.'}`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING, enum: ['SUCCEEDED', 'FAILED'] },
              confidence: { type: Type.NUMBER },
              faceDetectedInReference: { type: Type.BOOLEAN },
              spoofIndicators: { type: Type.ARRAY, items: { type: Type.STRING } },
              observations: { type: Type.ARRAY, items: { type: Type.STRING } },
              idSimilarity: { type: Type.NUMBER },
              sharpness: { type: Type.NUMBER },
              brightness: { type: Type.NUMBER },
              yaw: { type: Type.NUMBER },
              pitch: { type: Type.NUMBER },
              roll: { type: Type.NUMBER },
            },
            required: [
              'status',
              'confidence',
              'faceDetectedInReference',
              'spoofIndicators',
              'observations',
              'idSimilarity',
              'sharpness',
              'brightness',
              'yaw',
              'pitch',
              'roll',
            ],
          },
        },
      });

      livenessSessions.delete(sessionId);
      const parsed = JSON.parse((response.text ?? '{}').trim());

      res.json({
        sessionId,
        status: parsed.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
        confidence: Math.max(0, Math.min(100, Number(parsed.confidence ?? 0))),
        faceDetectedInReference: Boolean(parsed.faceDetectedInReference),
        spoofIndicators: Array.isArray(parsed.spoofIndicators)
          ? parsed.spoofIndicators.map(String)
          : [],
        observations: Array.isArray(parsed.observations)
          ? parsed.observations.map(String)
          : [],
        idSimilarity: hasId ? Math.max(0, Math.min(100, Number(parsed.idSimilarity ?? 0))) : null,
        quality: {
          sharpness: Math.max(0, Math.min(100, Number(parsed.sharpness ?? 0))),
          brightness: Math.max(0, Math.min(100, Number(parsed.brightness ?? 0))),
          pose: {
            yaw: Number(parsed.yaw ?? 0),
            pitch: Number(parsed.pitch ?? 0),
            roll: Number(parsed.roll ?? 0),
          },
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected server error during liveness check.';
      const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DeepGuard server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
