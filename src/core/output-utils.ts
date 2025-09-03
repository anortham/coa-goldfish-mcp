/**
 * Output utilities for adaptive rendering across different CLIs
 *
 * Provides dual-mode/plain/json output packing to keep results readable
 * in Codex/Gemini while preserving a structured JSON payload for parsing.
 */

import { ToolResponse } from '../types/index.js';

export type OutputMode = 'plain' | 'emoji' | 'json' | 'dual';

function getMode(explicit?: OutputMode): OutputMode {
  if (explicit) return explicit;
  const env = (process.env.GOLDFISH_OUTPUT_MODE || '').toLowerCase();
  if (env === 'plain' || env === 'emoji' || env === 'json' || env === 'dual') return env as OutputMode;

  // Heuristics for auto-selection when not explicitly set
  // - Prefer plain for CI/dumb terminals or when NO_EMOJI/NO_COLOR is set
  const isCi = !!process.env.CI;
  const noEmoji = process.env.NO_EMOJI === '1' || process.env.NO_EMOJI === 'true';
  const noColor = !!process.env.NO_COLOR;
  const term = (process.env.TERM || '').toLowerCase();
  const isDumb = term === 'dumb' || term === '';
  if (isCi || noEmoji || noColor || isDumb) return 'plain';

  // Default to dual for broad compatibility across tools (Claude/Codex/Gemini)
  return 'dual';
}

function stripMarkdown(text: string): string {
  // Remove bold markers and heading asterisks while keeping content
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/`([^`]*)`/g, '$1');
}

function stripEmojis(text: string): string {
  // Basic emoji and symbol removal (covers common ranges)
  // Misc symbols + pictographs, dingbats, supplemental symbols
  return text
    .replace(/[\u2700-\u27BF]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '');
}

function normalizeRules(text: string): string {
  // Replace heavy box rules with ASCII separators
  return text.replace(/[\u2500-\u257F]+/g, '--------------------------------');
}

function toPlain(text: string): string {
  return normalizeRules(stripEmojis(stripMarkdown(text))).trim();
}

export function buildToolContent(
  operation: string,
  formattedOutput: string,
  data?: Record<string, unknown>,
  explicitMode?: OutputMode
): ToolResponse {
  const mode = getMode(explicitMode);
  const plain = toPlain(formattedOutput);

  // Build JSON payload; omit formattedOutput when mode is strictly 'json'
  const basePayload: any = {
    success: true,
    operation,
    data: data || {},
    meta: {
      mode,
      lines: formattedOutput.split('\n').length
    }
  };
  const jsonPayload = mode === 'json'
    ? basePayload
    : { ...basePayload, formattedOutput };

  if (mode === 'plain') {
    return { content: [{ type: 'text', text: plain }] };
  }

  if (mode === 'emoji') {
    return { content: [{ type: 'text', text: formattedOutput }] };
  }

  if (mode === 'json') {
    return { content: [{ type: 'text', text: JSON.stringify(jsonPayload, null, 2) }] };
  }

  // dual
  return {
    content: [
      { type: 'text', text: plain },
      { type: 'text', text: JSON.stringify(jsonPayload, null, 2) }
    ]
  };
}
