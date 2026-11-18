/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AppTab, Header } from './components/Header';
import { GuideArchitectureView } from './components/GuideArchitectureView';
import { LivenessStudio } from './components/LivenessStudio';
import { TestPlanView } from './components/TestPlanView';
import { VerificationLab } from './components/VerificationLab';
import { DEFAULT_THRESHOLDS } from './lib/riskEngine';
import { generateScenarioImages } from './lib/testScenarios';
import {
  AnalysisMode,
  BiometricSignals,
  RiskThresholds,
  TestCaseScenario,
} from './types/verification';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('lab');
  const [mode, setMode] = useState<AnalysisMode>('live');
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [requireLiveness, setRequireLiveness] = useState(true);
  const [thresholds, setThresholds] = useState<RiskThresholds>(DEFAULT_THRESHOLDS);
  const [activeScenarioId, setActiveScenarioId] = useState<
    TestCaseScenario['id'] | null
  >(null);
  const [lastSignals, setLastSignals] = useState<{
    runId: string;
    signals: BiometricSignals;
    mode: AnalysisMode;
    rawPayload: Record<string, unknown>;
    scenarioId?: TestCaseScenario['id'] | null;
  } | null>(null);

  const handleNewCheck = () => {
    setIdImage(null);
    setSelfieImage(null);
    setActiveScenarioId(null);
    setLastSignals(null);
    setActiveTab('lab');
  };

  const handleLoadScenarioInLab = (scenarioId: TestCaseScenario['id']) => {
    const { idDataUrl, selfieDataUrl } = generateScenarioImages(scenarioId);
    setIdImage(idDataUrl);
    setSelfieImage(selfieDataUrl);
    setActiveScenarioId(scenarioId);
    setMode('demo');
    setConsentConfirmed(true);
    setLastSignals(null);
    setActiveTab('lab');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewCheck={handleNewCheck}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'lab' && (
          <VerificationLab
            mode={mode}
            onModeChange={setMode}
            idImage={idImage}
            selfieImage={selfieImage}
            onIdImageChange={setIdImage}
            onSelfieImageChange={setSelfieImage}
            consentConfirmed={consentConfirmed}
            onConsentChange={setConsentConfirmed}
            requireLiveness={requireLiveness}
            onRequireLivenessChange={setRequireLiveness}
            thresholds={thresholds}
            onThresholdsChange={setThresholds}
            activeScenarioId={activeScenarioId}
            onActiveScenarioChange={setActiveScenarioId}
            lastSignals={lastSignals}
            onLastSignalsChange={setLastSignals}
          />
        )}

        {activeTab === 'liveness' && (
          <LivenessStudio
            mode={mode}
            onModeChange={setMode}
            idImage={idImage}
            consentConfirmed={consentConfirmed}
            onConsentChange={setConsentConfirmed}
            thresholds={thresholds}
          />
        )}

        {activeTab === 'test-plan' && (
          <TestPlanView onLoadScenarioInLab={handleLoadScenarioInLab} />
        )}

        {activeTab === 'guide' && <GuideArchitectureView />}
      </main>

      <footer className="border-t border-slate-800 bg-slate-900/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            DeepGuard · AI-Powered Deepfake Detection &amp; Digital Identity Protection
          </span>
          <span className="font-medium text-slate-300">
            Risk indicator, not proof. Borderline cases go to a human reviewer.
          </span>
        </div>
      </footer>
    </div>
  );
}
