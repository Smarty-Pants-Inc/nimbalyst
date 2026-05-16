import { atom } from 'jotai';
import { atomFamily } from '../debug/atomFamilyRegistry';

export interface ActionPrompt {
  id: string;
  label: string;
  body: string;
}

export interface ActionPromptParseDiagnostic {
  level: 'warning';
  code: 'duplicate-heading' | 'empty-body';
  label: string;
  message: string;
}

export interface ActionPromptListState {
  actions: ActionPrompt[];
  diagnostics: ActionPromptParseDiagnostic[];
  filePath: string | null;
  fileExists: boolean;
  loaded: boolean;
}

const EMPTY_STATE: ActionPromptListState = {
  actions: [],
  diagnostics: [],
  filePath: null,
  fileExists: false,
  loaded: false,
};

export const actionPromptsAtomFamily = atomFamily((_workspacePath: string) =>
  atom<ActionPromptListState>(EMPTY_STATE)
);
