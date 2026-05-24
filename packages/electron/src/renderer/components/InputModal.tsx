import React, { useState, useRef, useEffect } from 'react';
import { MaterialSymbol } from '@nimbalyst/runtime';

interface InputModalProps {
  isOpen: boolean;
  title: string;
  placeholder: string;
  defaultValue?: string;
  suffix?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const inputModalButtonBase =
  'input-modal-button inline-flex items-center justify-center gap-2 rounded-[var(--an-input-border-radius)] border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--an-input-focus-outline)] disabled:cursor-not-allowed disabled:opacity-50';

export function InputModal({
  isOpen,
  title,
  placeholder,
  defaultValue = '',
  suffix,
  confirmLabel = 'Create',
  onConfirm,
  onCancel
}: InputModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="input-modal-overlay nim-overlay agent-elements-input-modal-backdrop bg-[color-mix(in_srgb,var(--nim-text)_36%,transparent)]"
      data-testid="agent-elements-input-modal-backdrop"
      data-agent-elements-shell="input-modal-backdrop"
      onClick={onCancel}
    >
      <div
        className="input-modal agent-elements-input-modal agent-elements-tool-card w-[400px] max-w-[90vw] !gap-0 !p-0 overflow-hidden rounded-[var(--an-border-radius)] bg-[var(--an-background)] border border-[var(--an-border-color)] text-[var(--an-foreground)] shadow-[0_20px_60px_color-mix(in_srgb,var(--nim-text)_18%,transparent)]"
        data-testid="agent-elements-input-modal"
        data-component="InputModal"
        data-agent-elements-shell="input-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div
            className="input-modal-header agent-elements-input-modal-header p-[var(--an-spacing-xl)] border-b border-[var(--an-border-color)]"
            data-testid="agent-elements-input-modal-header"
            data-agent-elements-shell="input-modal-header"
          >
            <h3 className="input-modal-title m-0 text-sm font-medium text-[var(--an-foreground)]">
              {title}
            </h3>
          </div>

          <div
            className="input-modal-body agent-elements-input-modal-body p-[var(--an-spacing-xl)]"
            data-agent-elements-shell="input-modal-body"
          >
            <div
              className={`input-modal-input-wrapper agent-elements-input-modal-input-wrapper relative flex items-center overflow-hidden rounded-[var(--an-input-border-radius)] border border-[var(--an-input-border-color)] bg-[var(--an-input-background)] focus-within:ring-2 focus-within:ring-[var(--an-input-focus-outline)] ${suffix ? 'has-suffix' : ''}`}
              data-testid="agent-elements-input-modal-input-wrapper"
              data-agent-elements-shell="input-modal-input-wrapper"
            >
              <input
                ref={inputRef}
                type="text"
                className={`input-modal-input nim-input agent-elements-input-modal-input flex-1 border-none bg-transparent px-3 py-2 text-sm text-[var(--an-input-color)] placeholder:text-[var(--an-foreground-subtle)] focus:outline-none ${suffix ? 'pr-[120px]' : ''}`}
                data-testid="agent-elements-input-modal-input"
                data-agent-elements-shell="input-modal-input"
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {suffix && (
                <span
                  className="input-modal-suffix agent-elements-input-modal-suffix absolute right-3 text-sm text-[var(--an-foreground-subtle)] pointer-events-none select-none"
                  data-testid="agent-elements-input-modal-suffix"
                  data-agent-elements-shell="input-modal-suffix"
                >
                  {suffix}
                </span>
              )}
            </div>
          </div>

          <div
            className="input-modal-buttons agent-elements-input-modal-footer flex justify-end gap-2 border-t border-[var(--an-border-color)] p-[var(--an-spacing-xl)]"
            data-agent-elements-shell="input-modal-footer"
          >
            <button
              type="button"
              className={`${inputModalButtonBase} input-modal-cancel border-[var(--an-border-color)] bg-[var(--an-background)] text-[var(--an-foreground-muted)] hover:bg-[var(--an-background-tertiary)] hover:text-[var(--an-foreground)]`}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${inputModalButtonBase} input-modal-confirm border-[var(--an-primary-color)] bg-[var(--an-primary-color)] text-[var(--an-background)] hover:bg-[var(--nim-primary-hover)] hover:border-[var(--nim-primary-hover)]`}
              disabled={!value.trim()}
            >
              <span aria-hidden="true">
                <MaterialSymbol icon="check" size={16} />
              </span>
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
