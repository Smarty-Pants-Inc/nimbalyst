import React, { useState } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';
import OnboardingService from '../../services/OnboardingService';

export interface WelcomeModalProps {
  workspacePath: string;
  workspaceName: string;
  onComplete: () => void;
  onSkip: () => void;
}

type Step = 'welcome' | 'plans-location' | 'claude-code' | 'first-plan' | 'plan-view' | 'complete';

const steps: Step[] = ['welcome', 'plans-location', 'claude-code', 'first-plan', 'plan-view', 'complete'];

const stepTitles: Record<Step, string> = {
  welcome: 'Welcome to Nimbalyst',
  'plans-location': 'Configure Plans Location',
  'claude-code': 'Configure Claude Agent Integration',
  'first-plan': 'Create Your First Plan',
  'plan-view': 'Explore the Plan View',
  complete: 'All Set!',
};

const featureRows = [
  {
    icon: 'fact_check',
    title: 'Planning System',
    description: 'Organize features, bugs, and tasks with structured markdown plans',
  },
  {
    icon: 'auto_awesome',
    title: 'AI Integration',
    description: 'Work with Claude Agent and other AI assistants for enhanced productivity',
  },
  {
    icon: 'monitoring',
    title: 'Progress Tracking',
    description: 'Visual plan view to monitor status and progress across all work items',
  },
];

const planViewRows = [
  {
    icon: 'view_kanban',
    title: 'Status Overview',
    description: 'See all plans grouped by status (draft, in-progress, completed, etc.)',
  },
  {
    icon: 'filter_list',
    title: 'Filter & Sort',
    description: 'Filter by type, priority, or tags. Sort by date, progress, or priority.',
  },
  {
    icon: 'bar_chart',
    title: 'Progress Tracking',
    description: 'Visual progress bars show completion percentage for each plan',
  },
];

const secondaryButton =
  'welcome-modal-secondary-button inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-4 py-2 text-sm font-medium text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-60';
const primaryButton =
  'welcome-modal-primary-button inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border border-[var(--an-primary-color)] bg-[var(--an-primary-color)] px-4 py-2 text-sm font-medium text-[var(--an-background)] transition-[background-color,border-color] duration-150 ease-out hover:border-[var(--nim-primary-hover)] hover:bg-[var(--nim-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-60';
const optionCard =
  'agent-elements-welcome-modal-option flex cursor-pointer items-start gap-3 rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)] transition-[background-color,border-color] duration-150 ease-out hover:border-[var(--an-primary-color)] hover:bg-[var(--an-background-tertiary)]';
const contentCard =
  'agent-elements-welcome-modal-card rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]';
const stepRoot =
  'agent-elements-welcome-modal-step flex max-w-[600px] flex-col gap-[var(--an-spacing-xl)]';
const iconBox =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-primary-color)]';
const checkboxInput =
  'mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--an-primary-color)]';
const textInput =
  'w-full rounded-[var(--an-input-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] px-3 py-2 text-sm text-[var(--an-foreground)] outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-[var(--an-foreground-subtle)] focus:border-[var(--an-input-focus-outline)] focus:ring-2 focus:ring-[var(--an-input-focus-outline)]';
const codeChip =
  'rounded-[var(--an-input-border-radius)] bg-[var(--an-background-tertiary)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--an-foreground-muted)]';

const WelcomeModal: React.FC<WelcomeModalProps> = ({
  workspacePath,
  workspaceName,
  onComplete,
  onSkip,
}) => {
  // Skip rendering in Playwright tests
  const isPlaywright = window.PLAYWRIGHT || (window as any).PLAYWRIGHT;

  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [plansLocation, setPlansLocation] = useState<'nimbalyst-local/plans' | 'plans' | 'custom'>('nimbalyst-local/plans');
  const [customPlansLocation, setCustomPlansLocation] = useState('');
  const [checkInPlans, setCheckInPlans] = useState(false);
  const [commandsLocation, setCommandsLocation] = useState<'project' | 'global'>('project');
  const [enableClaudeCode, setEnableClaudeCode] = useState(false);
  const [installTrackCommand, setInstallTrackCommand] = useState(true);
  const [configureCLAUDEmd, setConfigureCLAUDEmd] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = async () => {
    setError(null);

    // Handle step-specific actions
    if (currentStep === 'plans-location') {
      setIsProcessing(true);
      try {
        // Save plans location configuration
        // Note: The nimbalyst-local directory and .gitignore are created as needed
        const config = await OnboardingService.loadConfig(workspacePath);
        const finalLocation = plansLocation === 'custom' ? customPlansLocation : plansLocation;
        config.plansLocation = finalLocation;
        config.checkInPlans = checkInPlans;
        await OnboardingService.saveConfig(workspacePath, config);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to configure plans location');
        setIsProcessing(false);
        return;
      }
      setIsProcessing(false);
    }

    if (currentStep === 'claude-code' && enableClaudeCode) {
      setIsProcessing(true);
      try {
        // Update config with commands location first
        const config = await OnboardingService.loadConfig(workspacePath);
        config.commandsLocation = commandsLocation;
        config.claudeCodeIntegration.enabled = true;
        await OnboardingService.saveConfig(workspacePath, config);

        // Install selected components
        if (installTrackCommand) {
          await OnboardingService.installTrackCommand(workspacePath);
        }
        if (configureCLAUDEmd) {
          await OnboardingService.configureCLAUDEmd(workspacePath);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to configure Claude Code');
        setIsProcessing(false);
        return;
      }
      setIsProcessing(false);
    }

    // Move to next step
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const handleSkip = async () => {
    try {
      await OnboardingService.completeOnboarding(workspacePath);
      onSkip();
    } catch (err) {
      console.error('Failed to save onboarding state:', err);
      onSkip();
    }
  };

  const handleComplete = async () => {
    setIsProcessing(true);
    try {
      await OnboardingService.completeOnboarding(workspacePath);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
    }
    setIsProcessing(false);
  };

  const handleCreateExamplePlan = async () => {
    setIsProcessing(true);
    try {
      const planPath = await OnboardingService.createExamplePlan(workspacePath);
      const result = await window.electronAPI.invoke('workspace:open-file', {
        workspacePath,
        filePath: planPath,
      });
      if (result && typeof result === 'object' && 'success' in result && !result.success) {
        throw new Error(result.error || 'Failed to open example plan');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create example plan');
    }
    setIsProcessing(false);
  };

  // Don't render in Playwright tests
  if (isPlaywright) {
    return null;
  }

  return (
    <div
      className="welcome-modal-overlay nim-overlay agent-elements-welcome-modal-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-[color-mix(in_srgb,var(--nim-text)_36%,transparent)] p-4 nim-animate-fade-in"
      data-testid="agent-elements-welcome-modal-backdrop"
      data-agent-elements-shell="welcome-modal-backdrop"
    >
      <div
        className="welcome-modal agent-elements-welcome-modal agent-elements-tool-card flex max-h-[85vh] w-[min(92vw,700px)] flex-col overflow-hidden rounded-[var(--an-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--nim-text)_18%,transparent)] nim-animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        data-testid="agent-elements-welcome-modal"
        data-component="WelcomeModal"
        data-agent-elements-shell="welcome-modal"
      >
        <div
          className="welcome-modal-progress agent-elements-welcome-modal-progress h-1 overflow-hidden bg-[var(--an-background-tertiary)]"
          data-testid="agent-elements-welcome-modal-progress"
          data-agent-elements-shell="welcome-modal-progress"
          data-progress-percent={Math.round(progress)}
        >
          <div
            className="welcome-modal-progress-bar h-full origin-left bg-[var(--an-primary-color)] transition-transform duration-200 ease-out"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>

        <div
          className="welcome-modal-header agent-elements-welcome-modal-header flex items-start justify-between gap-4 border-b border-[var(--an-border-color)] p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-welcome-modal-header"
          data-agent-elements-shell="welcome-modal-header"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="welcome-modal-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] text-[var(--an-primary-color)]"
              aria-hidden="true"
            >
              <MaterialSymbol icon="rocket_launch" size={19} />
            </span>
            <div className="min-w-0">
              <h2
                id="welcome-modal-title"
                className="m-0 text-sm font-medium leading-snug text-[var(--an-foreground)]"
              >
                {stepTitles[currentStep]}
              </h2>
              <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                Step {currentStepIndex + 1} of {steps.length}
              </p>
            </div>
          </div>
          <button
            className="welcome-modal-close inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--an-input-border-radius)] border border-transparent bg-transparent text-[var(--an-foreground-muted)] transition-[background-color,border-color,color] duration-150 ease-out hover:border-[var(--an-border-color)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]"
            onClick={handleSkip}
            title="Skip onboarding"
            aria-label="Skip onboarding"
          >
            <MaterialSymbol icon="close" size={18} />
          </button>
        </div>

        <div
          className="welcome-modal-content agent-elements-welcome-modal-content nim-scrollbar min-h-0 flex-1 overflow-y-auto p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-welcome-modal-content"
          data-agent-elements-shell="welcome-modal-content"
        >
          {error && (
            <div
              className="welcome-modal-error agent-elements-welcome-modal-error mb-[var(--an-spacing-xl)] rounded-[var(--an-tool-border-radius)] border border-[color-mix(in_srgb,var(--nim-error)_38%,var(--an-border-color))] bg-[color-mix(in_srgb,var(--nim-error)_10%,var(--an-background))] px-4 py-3 text-sm leading-relaxed text-[var(--nim-error)]"
              data-testid="agent-elements-welcome-modal-error"
              data-agent-elements-shell="welcome-modal-error"
            >
              <strong className="font-medium">Error:</strong> <span className="select-text">{error}</span>
            </div>
          )}

          {currentStep === 'welcome' && (
            <div
              className={`welcome-step ${stepRoot}`}
              data-testid="agent-elements-welcome-modal-step"
              data-agent-elements-shell="welcome-modal-step"
              data-step="welcome"
            >
              <div className="select-text">
                <h3 className="m-0 text-base font-medium leading-snug text-[var(--an-foreground)]">
                  Welcome to {workspaceName}
                </h3>
                <p className="m-0 mt-2 max-w-[64ch] text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                  Nimbalyst is a powerful editor with integrated planning, tracking, and AI features.
                  This quick setup will help you get started.
                </p>
              </div>
              <div className="welcome-features flex flex-col gap-[var(--an-spacing-md)]">
                {featureRows.map((feature) => (
                  <div
                    key={feature.title}
                    className={`welcome-feature ${contentCard} flex items-start gap-3`}
                    data-testid="agent-elements-welcome-modal-feature"
                    data-agent-elements-shell="welcome-modal-feature"
                  >
                    <span className={iconBox} aria-hidden="true">
                      <MaterialSymbol icon={feature.icon} size={18} />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <strong className="text-sm font-medium leading-snug text-[var(--an-foreground)]">
                        {feature.title}
                      </strong>
                      <span className="select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                        {feature.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'plans-location' && (
            <div
              className={`plans-location-step ${stepRoot}`}
              data-testid="agent-elements-welcome-modal-step"
              data-agent-elements-shell="welcome-modal-step"
              data-step="plans-location"
            >
              <p className="step-description m-0 max-w-[64ch] select-text text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                Where would you like to store your plan documents?
              </p>

              <div className="plan-location-options flex flex-col gap-[var(--an-spacing-md)]">
                <label className={`plan-location-option ${optionCard}`}>
                  <input
                    type="radio"
                    name="plansLocation"
                    value="nimbalyst-local/plans"
                    checked={plansLocation === 'nimbalyst-local/plans'}
                    onChange={() => {
                      setPlansLocation('nimbalyst-local/plans');
                      setCheckInPlans(false);
                    }}
                    className={checkboxInput}
                  />
                  <div className="plan-location-content flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-medium leading-snug text-[var(--an-foreground)]">
                      nimbalyst-local/plans <span className="text-xs text-[var(--an-foreground-muted)]">(Recommended)</span>
                    </span>
                    <span className="select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                      Private plans not checked into version control. Best for personal planning.
                    </span>
                  </div>
                </label>

                <label className={`plan-location-option ${optionCard}`}>
                  <input
                    type="radio"
                    name="plansLocation"
                    value="plans"
                    checked={plansLocation === 'plans'}
                    onChange={() => {
                      setPlansLocation('plans');
                      setCheckInPlans(true);
                    }}
                    className={checkboxInput}
                  />
                  <div className="plan-location-content flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-medium leading-snug text-[var(--an-foreground)]">plans/</span>
                    <span className="select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                      Shared plans checked into version control. Best for team collaboration.
                    </span>
                  </div>
                </label>

                <label className={`plan-location-option ${optionCard}`}>
                  <input
                    type="radio"
                    name="plansLocation"
                    value="custom"
                    checked={plansLocation === 'custom'}
                    onChange={() => setPlansLocation('custom')}
                    className={checkboxInput}
                  />
                  <div className="plan-location-content flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-medium leading-snug text-[var(--an-foreground)]">Custom location</span>
                    <span className="select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                      Specify your own directory path
                    </span>
                  </div>
                </label>

                {plansLocation === 'custom' && (
                  <div className="custom-location-input flex flex-col gap-[var(--an-spacing-md)] rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-lg)]">
                    <input
                      type="text"
                      placeholder="e.g., docs/plans or .local/plans"
                      value={customPlansLocation}
                      onChange={(e) => setCustomPlansLocation(e.target.value)}
                      className={textInput}
                    />
                    <label className="checkbox-label flex cursor-pointer items-start gap-2.5 rounded-[var(--an-input-border-radius)] p-2 transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)]">
                      <input
                        type="checkbox"
                        checked={checkInPlans}
                        onChange={(e) => setCheckInPlans(e.target.checked)}
                        className={checkboxInput}
                      />
                      <span className="select-text text-sm leading-normal text-[var(--an-foreground)]">Check into version control</span>
                    </label>
                  </div>
                )}
              </div>

              <div className={`plan-location-info ${contentCard}`}>
                <p className="m-0 mb-2 text-sm font-medium text-[var(--an-foreground)]">What happens:</p>
                <ul className="m-0 space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                  <li className="select-text">Plans directory will be created at the specified location</li>
                  {!checkInPlans && (
                    <li className="select-text">
                      The directory will be added to <code className={codeChip}>.gitignore</code> (not checked in)
                    </li>
                  )}
                  {checkInPlans && (
                    <li className="select-text">Plans will be included in your repository (team collaboration)</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {currentStep === 'claude-code' && (
            <div
              className={`claude-code-step ${stepRoot}`}
              data-testid="agent-elements-welcome-modal-step"
              data-agent-elements-shell="welcome-modal-step"
              data-step="claude-code"
            >
              <p className="step-description m-0 max-w-[64ch] select-text text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                Configure Claude Agent to understand Nimbalyst&apos;s extended markdown features for
                plans and tracking.
              </p>

              <div className="claude-code-option">
                <label className="checkbox-label flex cursor-pointer items-start gap-2.5 rounded-[var(--an-input-border-radius)] p-2 transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)]">
                  <input
                    type="checkbox"
                    checked={enableClaudeCode}
                    onChange={(e) => setEnableClaudeCode(e.target.checked)}
                    className={checkboxInput}
                  />
                  <span className="select-text text-sm leading-normal text-[var(--an-foreground)]">Enable Claude Agent integration</span>
                </label>
              </div>

              {enableClaudeCode && (
                <div className={`claude-code-options ${contentCard} flex flex-col gap-[var(--an-spacing-lg)]`}>
                  <p className="options-intro m-0 text-sm font-medium text-[var(--an-foreground)]">Where should commands be installed?</p>

                  <div className="commands-location-options flex flex-col gap-[var(--an-spacing-md)]">
                    <label className={`plan-location-option ${optionCard}`}>
                      <input
                        type="radio"
                        name="commandsLocation"
                        value="project"
                        checked={commandsLocation === 'project'}
                        onChange={() => setCommandsLocation('project')}
                        className={checkboxInput}
                      />
                      <div className="plan-location-content flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm font-medium leading-snug text-[var(--an-foreground)]">
                          Project (.claude/) <span className="text-xs text-[var(--an-foreground-muted)]">(Recommended)</span>
                        </span>
                        <span className="select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                          Commands stored in project directory, can be checked into version control for team sharing
                        </span>
                      </div>
                    </label>

                    <label className={`plan-location-option ${optionCard}`}>
                      <input
                        type="radio"
                        name="commandsLocation"
                        value="global"
                        checked={commandsLocation === 'global'}
                        onChange={() => setCommandsLocation('global')}
                        className={checkboxInput}
                      />
                      <div className="plan-location-content flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm font-medium leading-snug text-[var(--an-foreground)]">Global (~/.claude/)</span>
                        <span className="select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                          Commands stored in home directory, shared across all projects
                        </span>
                      </div>
                    </label>
                  </div>

                  <p className="options-intro m-0 text-sm font-medium text-[var(--an-foreground)]">Select components to install:</p>

                  <label className="checkbox-label flex cursor-pointer items-start gap-2.5 rounded-[var(--an-input-border-radius)] p-2 transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)]">
                    <input
                      type="checkbox"
                      checked={installTrackCommand}
                      onChange={(e) => setInstallTrackCommand(e.target.checked)}
                      className={checkboxInput}
                    />
                    <span className="select-text text-sm leading-normal text-[var(--an-foreground)]">
                      <strong className="block font-medium">/track command</strong>
                      <span className="text-[var(--an-foreground-muted)]">Create tracking items (bugs, tasks, ideas)</span>
                    </span>
                  </label>

                  <label className="checkbox-label flex cursor-pointer items-start gap-2.5 rounded-[var(--an-input-border-radius)] p-2 transition-colors duration-150 ease-out hover:bg-[var(--an-background-tertiary)]">
                    <input
                      type="checkbox"
                      checked={configureCLAUDEmd}
                      onChange={(e) => setConfigureCLAUDEmd(e.target.checked)}
                      className={checkboxInput}
                    />
                    <span className="select-text text-sm leading-normal text-[var(--an-foreground)]">
                      <strong className="block font-medium">CLAUDE.md</strong>
                      <span className="text-[var(--an-foreground-muted)]">Add Nimbalyst-specific instructions</span>
                    </span>
                  </label>

                  <div className="config-info border-t border-[var(--an-border-color)] pt-[var(--an-spacing-lg)]">
                    <p className="m-0 mb-2 text-sm font-medium text-[var(--an-foreground)]">What gets installed:</p>
                    <ul className="m-0 space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                      <li className="select-text">
                        <code className={codeChip}>{commandsLocation === 'project' ? '.claude' : '~/.claude'}/commands/track.md</code> - Tracking command
                      </li>
                      <li className="select-text">
                        <code className={codeChip}>CLAUDE.md</code> - Planning system documentation
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {!enableClaudeCode && (
                <div className={`skip-info ${contentCard}`}>
                  <p className="m-0 select-text text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                    You can enable Claude Agent integration later from project settings.
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === 'first-plan' && (
            <div
              className={`first-plan-step ${stepRoot}`}
              data-testid="agent-elements-welcome-modal-step"
              data-agent-elements-shell="welcome-modal-step"
              data-step="first-plan"
            >
              <p className="step-description m-0 max-w-[64ch] select-text text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                Let&apos;s create your first plan document to get familiar with the system.
              </p>

              <div className="plan-options flex flex-col gap-[var(--an-spacing-md)]">
                <button
                  className={`plan-option-button ${optionCard} w-full text-left focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)]`}
                  onClick={handleCreateExamplePlan}
                >
                  <span className={iconBox} aria-hidden="true">
                    <MaterialSymbol icon="note_add" size={18} />
                  </span>
                  <span className="plan-option-content flex min-w-0 flex-1 flex-col gap-1">
                    <strong className="text-sm font-medium leading-snug text-[var(--an-foreground)]">Create Example Plan</strong>
                    <span className="select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                      Start with a pre-filled example that shows the plan structure
                    </span>
                  </span>
                </button>

                <div className="plan-option-info rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] px-4 py-3 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                  <span className="select-text">
                    Plans are stored in the <code className={codeChip}>plans/</code> directory as markdown files with
                    frontmatter metadata.
                  </span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'plan-view' && (
            <div
              className={`plan-view-step ${stepRoot}`}
              data-testid="agent-elements-welcome-modal-step"
              data-agent-elements-shell="welcome-modal-step"
              data-step="plan-view"
            >
              <p className="step-description m-0 max-w-[64ch] select-text text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                The plan view helps you track all your plans, their status, and progress.
              </p>

              <div className="plan-view-features flex flex-col gap-[var(--an-spacing-md)]">
                {planViewRows.map((row) => (
                  <div key={row.title} className={`plan-view-feature ${contentCard} flex items-start gap-3`}>
                    <span className={iconBox} aria-hidden="true">
                      <MaterialSymbol icon={row.icon} size={18} />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <strong className="text-sm font-medium leading-snug text-[var(--an-foreground)]">{row.title}</strong>
                      <span className="select-text text-xs leading-relaxed text-[var(--an-foreground-muted)]">
                        {row.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`plan-view-access ${contentCard}`}>
                <p className="m-0 mb-2 text-sm font-medium text-[var(--an-foreground)]">Access the plan view:</p>
                <ul className="m-0 space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                  <li className="select-text">View menu → Plans</li>
                  <li className="select-text">Keyboard shortcut (if configured)</li>
                  <li className="select-text">Click the plans icon in the sidebar</li>
                </ul>
              </div>
            </div>
          )}

          {currentStep === 'complete' && (
            <div
              className={`complete-step ${stepRoot}`}
              data-testid="agent-elements-welcome-modal-step"
              data-agent-elements-shell="welcome-modal-step"
              data-step="complete"
            >
              <div className="select-text">
                <h3 className="m-0 text-base font-medium leading-snug text-[var(--an-foreground)]">You&apos;re all set!</h3>
                <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--an-foreground-muted)]">Your workspace is configured and ready to use.</p>
              </div>

              <div className={`next-steps ${contentCard}`}>
                <h4 className="m-0 mb-2 text-sm font-medium text-[var(--an-foreground)]">Next steps:</h4>
                <ul className="m-0 space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                  <li className="select-text">Explore your example plan document</li>
                  <li className="select-text">Create your first real plan with File → New Plan</li>
                  <li className="select-text">Check out the plan view to see all your plans</li>
                  <li className="select-text">Start organizing your work with the tracking system</li>
                </ul>
              </div>

              <div className="help-links rounded-[var(--an-tool-border-radius)] border border-[var(--an-border-color)] bg-[var(--an-background-tertiary)] p-[var(--an-spacing-lg)]">
                <p className="m-0 mb-1 text-sm font-medium text-[var(--an-foreground)]">Need help?</p>
                <p className="m-0 select-text text-sm leading-relaxed text-[var(--an-foreground-muted)]">
                  Access documentation from the Help menu or visit the Nimbalyst website.
                </p>
              </div>
            </div>
          )}
        </div>

        <div
          className="welcome-modal-footer agent-elements-welcome-modal-actions flex flex-wrap items-center justify-between gap-3 border-t border-[var(--an-border-color)] bg-[var(--an-background-secondary)] p-[var(--an-spacing-xl)]"
          data-testid="agent-elements-welcome-modal-actions"
          data-agent-elements-shell="welcome-modal-actions"
        >
          <div className="welcome-modal-footer-left flex gap-2">
            <button
              className={`welcome-modal-button ${secondaryButton}`}
              onClick={handleSkip}
              disabled={isProcessing}
            >
              Skip Setup
            </button>
          </div>
          <div className="welcome-modal-footer-right flex gap-2">
            {currentStepIndex > 0 && (
              <button
                className={`welcome-modal-button ${secondaryButton}`}
                onClick={handleBack}
                disabled={isProcessing}
              >
                Back
              </button>
            )}
            {currentStep !== 'complete' ? (
              <button
                className={`welcome-modal-button ${primaryButton}`}
                onClick={handleNext}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Next'}
              </button>
            ) : (
              <button
                className={`welcome-modal-button ${primaryButton}`}
                onClick={handleComplete}
                disabled={isProcessing}
              >
                {isProcessing ? 'Finishing...' : 'Get Started'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
