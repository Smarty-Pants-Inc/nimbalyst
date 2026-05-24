// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WelcomeModal from '../WelcomeModal';

const onboardingMocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  completeOnboarding: vi.fn(),
  installTrackCommand: vi.fn(),
  configureCLAUDEmd: vi.fn(),
  createExamplePlan: vi.fn(),
}));

vi.mock('../../../services/OnboardingService', () => ({
  default: onboardingMocks,
}));

vi.mock('@nimbalyst/runtime', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MaterialSymbol: ({
      icon,
      size,
      className,
    }: {
      icon: string;
      size?: number;
      className?: string;
    }) =>
      ReactModule.createElement('span', {
        'data-material-symbol': icon,
        'data-size': size,
        className,
      }),
  };
});

function renderWelcomeModal(overrides: Partial<React.ComponentProps<typeof WelcomeModal>> = {}) {
  const props: React.ComponentProps<typeof WelcomeModal> = {
    workspacePath: '/repo/workspace',
    workspaceName: 'Workspace Alpha',
    onComplete: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  };

  const view = render(<WelcomeModal {...props} />);
  return { props, ...view };
}

describe('WelcomeModal Agent Elements shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).PLAYWRIGHT;

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: vi.fn().mockResolvedValue({ success: true }),
        send: vi.fn(),
      },
    });

    onboardingMocks.loadConfig.mockResolvedValue({
      onboardingCompleted: false,
      plansLocation: 'nimbalyst-local/plans',
      checkInPlans: false,
      commandsLocation: 'project',
      claudeCodeIntegration: {
        enabled: false,
        trackCommandInstalled: false,
        claudeMdConfigured: false,
      },
    });
    onboardingMocks.saveConfig.mockResolvedValue(undefined);
    onboardingMocks.completeOnboarding.mockResolvedValue(undefined);
    onboardingMocks.installTrackCommand.mockResolvedValue(undefined);
    onboardingMocks.configureCLAUDEmd.mockResolvedValue(undefined);
    onboardingMocks.createExamplePlan.mockResolvedValue('/repo/workspace/plans/example.md');
  });

  it('does not render in Playwright mode', () => {
    (window as any).PLAYWRIGHT = true;

    renderWelcomeModal();

    expect(screen.queryByTestId('agent-elements-welcome-modal')).not.toBeInTheDocument();
  });

  it('renders an Agent Elements onboarding shell while preserving welcome content and skip behavior', async () => {
    const onSkip = vi.fn();
    renderWelcomeModal({ onSkip });

    const backdrop = screen.getByTestId('agent-elements-welcome-modal-backdrop');
    expect(backdrop).toHaveClass('welcome-modal-overlay', 'agent-elements-welcome-modal-backdrop');
    expect(backdrop).toHaveAttribute('data-agent-elements-shell', 'welcome-modal-backdrop');

    const dialog = screen.getByTestId('agent-elements-welcome-modal');
    expect(dialog).toHaveClass('welcome-modal', 'agent-elements-welcome-modal', 'agent-elements-tool-card');
    expect(dialog).toHaveAttribute('data-component', 'WelcomeModal');
    expect(dialog).toHaveAttribute('data-agent-elements-shell', 'welcome-modal');

    expect(screen.getByTestId('agent-elements-welcome-modal-progress')).toHaveAttribute(
      'data-agent-elements-shell',
      'welcome-modal-progress'
    );
    expect(screen.getByTestId('agent-elements-welcome-modal-header')).toHaveTextContent('Welcome to Nimbalyst');
    expect(screen.getByTestId('agent-elements-welcome-modal-content')).toHaveAttribute(
      'data-agent-elements-shell',
      'welcome-modal-content'
    );
    expect(screen.getByTestId('agent-elements-welcome-modal-actions')).toHaveAttribute(
      'data-agent-elements-shell',
      'welcome-modal-actions'
    );

    const welcomeStep = screen.getByTestId('agent-elements-welcome-modal-step');
    expect(welcomeStep).toHaveClass('welcome-step', 'agent-elements-welcome-modal-step');
    expect(welcomeStep).toHaveAttribute('data-step', 'welcome');
    expect(welcomeStep).toHaveTextContent('Workspace Alpha');
    expect(screen.getAllByTestId('agent-elements-welcome-modal-feature')).toHaveLength(3);

    fireEvent.click(screen.getByTitle('Skip onboarding'));

    await waitFor(() => {
      expect(onboardingMocks.completeOnboarding).toHaveBeenCalledWith('/repo/workspace');
      expect(onSkip).toHaveBeenCalledTimes(1);
    });
  });

  it('preserves plans-location configuration and error display inside the Agent Elements shell', async () => {
    renderWelcomeModal();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByText('Configure Plans Location');
    expect(screen.getByTestId('agent-elements-welcome-modal-step')).toHaveAttribute(
      'data-step',
      'plans-location'
    );

    fireEvent.click(screen.getByLabelText(/Custom location/i));
    fireEvent.change(screen.getByPlaceholderText('e.g., docs/plans or .local/plans'), {
      target: { value: 'docs/roadmap' },
    });
    fireEvent.click(screen.getByLabelText('Check into version control'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(onboardingMocks.saveConfig).toHaveBeenCalledWith(
        '/repo/workspace',
        expect.objectContaining({
          plansLocation: 'docs/roadmap',
          checkInPlans: true,
        })
      );
    });

    onboardingMocks.saveConfig.mockRejectedValueOnce(new Error('Cannot save onboarding config'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText('Configure Plans Location');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByTestId('agent-elements-welcome-modal-error')).toHaveTextContent(
      'Cannot save onboarding config'
    );
    expect(screen.getByText('Configure Plans Location')).toBeInTheDocument();
  });

  it('preserves enabled Claude Agent setup inside the Agent Elements shell', async () => {
    renderWelcomeModal();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Configure Plans Location');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Configure Claude Agent Integration');

    fireEvent.click(screen.getByLabelText('Enable Claude Agent integration'));
    fireEvent.click(screen.getByLabelText(/Global/));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(onboardingMocks.saveConfig).toHaveBeenLastCalledWith(
        '/repo/workspace',
        expect.objectContaining({
          commandsLocation: 'global',
          claudeCodeIntegration: expect.objectContaining({
            enabled: true,
          }),
        })
      );
      expect(onboardingMocks.installTrackCommand).toHaveBeenCalledWith('/repo/workspace');
      expect(onboardingMocks.configureCLAUDEmd).toHaveBeenCalledWith('/repo/workspace');
    });

    expect(screen.getByText('Create Your First Plan')).toBeInTheDocument();
  });

  it('preserves example-plan creation, workspace open-file IPC, and completion callback', async () => {
    const onComplete = vi.fn();
    renderWelcomeModal({ onComplete });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Configure Plans Location');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Configure Claude Agent Integration');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Create Your First Plan');

    fireEvent.click(screen.getByRole('button', { name: /Create Example Plan/i }));
    await waitFor(() => {
      expect(onboardingMocks.createExamplePlan).toHaveBeenCalledWith('/repo/workspace');
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('workspace:open-file', {
        workspacePath: '/repo/workspace',
        filePath: '/repo/workspace/plans/example.md',
      });
      expect(window.electronAPI.send).not.toHaveBeenCalledWith(
        'open-file',
        '/repo/workspace/plans/example.md'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Explore the Plan View');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('All Set!');
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));

    await waitFor(() => {
      expect(onboardingMocks.completeOnboarding).toHaveBeenCalledWith('/repo/workspace');
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
