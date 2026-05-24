import { DEFAULT_MODELS } from '@nimbalyst/runtime/ai/modelConstants';

const SUPER_LOOP_DEFAULT_MODEL = DEFAULT_MODELS['smarty-server'];

export function resolveSuperLoopSessionRoute(modelId?: string | null): { model: string; provider: string } {
  const model = modelId || SUPER_LOOP_DEFAULT_MODEL;
  return {
    model,
    provider: model.includes(':') ? model.split(':')[0] : 'smarty-server',
  };
}
