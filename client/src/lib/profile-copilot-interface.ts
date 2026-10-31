import type { CopilotUiResult } from '../../../shared/artist-profile-copilot';
import { flushSync } from 'react-dom';

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement;
type Scope = { root: HTMLElement; moduleId: string };
const fields = new Map<string, { element: FieldElement; scope: Scope }>();
const views = new Map<string, { element: HTMLElement; scope: Scope }>();
const ids = new WeakMap<Element, string>();
let nextId = 0;
const sensitive = /password|api[ _-]?key|secret|auth[ _-]?token|access[ _-]?token|private[ _-]?key|credential|wallet|credit[ _-]?card|bank[ _-]?account|webhook|contact[ _-]?(email|phone)|autopilot|auto[ _-]?(publish|post|generat|renew)|billing|payout|withdraw/i;
const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const visible = (element: HTMLElement) => element.isConnected && element.getClientRects().length > 0 && !element.closest('[hidden],[aria-hidden="true"],[inert]');
const opaqueId = (element: Element) => {
  if (!ids.has(element)) ids.set(element, `profile-field-${++nextId}`);
  return ids.get(element)!;
};

function labelFor(element: FieldElement | HTMLElement): string {
  const labelledBy = element.getAttribute('aria-labelledby');
  const labelledText = labelledBy?.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ');
  const labels = 'labels' in element ? (element as HTMLInputElement).labels : null;
  const nativeLabel = labels?.length ? Array.from(labels).map((label) => label.textContent || '').join(' ') : '';
  // Direct labels cover modules that use a plain div rather than htmlFor.
  const siblingLabel = element.parentElement?.querySelector(':scope > label')?.textContent;
  return String(element.getAttribute('data-copilot-option') || element.getAttribute('aria-label') || labelledText || nativeLabel || siblingLabel || element.getAttribute('placeholder') || element.getAttribute('name') || element.id || 'Untitled field').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function editable(element: FieldElement): boolean {
  if (!visible(element) || sensitive.test(`${labelFor(element)} ${element.id} ${element.getAttribute('name') || ''} ${element.getAttribute('placeholder') || ''}`)) return false;
  if (element instanceof HTMLInputElement && !['text', 'search', 'url', 'number', 'range', 'date', 'datetime-local', 'time', 'checkbox', 'radio', ''].includes(element.type)) return false;
  if ('readOnly' in element && element.readOnly) return false;
  return true;
}

function valueOf(element: FieldElement): string {
  if (element instanceof HTMLButtonElement) return element.hasAttribute('data-copilot-option') ? String(element.getAttribute('aria-pressed') === 'true') : (element.textContent || '').trim();
  if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) return String(element.checked);
  return element.value;
}

function kindOf(element: FieldElement): string {
  if (element instanceof HTMLButtonElement) return element.hasAttribute('data-copilot-option') ? 'choice' : 'combobox';
  if (element instanceof HTMLSelectElement) return 'select';
  if (element instanceof HTMLTextAreaElement) return 'textarea';
  return element.type || 'text';
}

export function inspectCopilotInterface(root: HTMLElement, moduleId: string): CopilotUiResult {
  // Drop stale references so a field handle cannot escape its original module.
  for (const [id, item] of Array.from(fields)) if (!item.element.isConnected || item.scope.moduleId === moduleId) fields.delete(id);
  for (const [id, item] of Array.from(views)) if (!item.element.isConnected || item.scope.moduleId === moduleId) views.delete(id);
  const scope = { root, moduleId };
  const candidates = Array.from(root.querySelectorAll<FieldElement>('input,textarea,select,button[role="combobox"],button[data-copilot-option]'));
  const editableFields = candidates.filter((element) => editable(element) && (moduleId !== 'profile' || element.hasAttribute('data-copilot-profile-field'))).slice(0, 50);
  const resultFields = editableFields.map((element) => {
    const id = opaqueId(element);
    fields.set(id, { element, scope });
    const length = 'maxLength' in element && element.maxLength >= 0 ? element.maxLength : undefined;
    return {
      id, label: labelFor(element), kind: kindOf(element),
      value: valueOf(element).slice(0, moduleId === 'profile' ? 12000 : 4000),
      disabled: element.disabled, ...(length === undefined ? {} : { maxLength: length }),
      ...(element instanceof HTMLSelectElement ? { options: Array.from(element.options).filter((option) => !option.disabled).slice(0, 100).map((option) => ({ value: option.value.slice(0, 500), label: option.text.slice(0, 500) })) } : {}),
    };
  });
  const resultViews = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"],details > summary')).filter(visible).slice(0, 30).map((element) => {
    const id = opaqueId(element);
    views.set(id, { element, scope });
    return { id, label: (element.textContent || '').trim().slice(0, 180), selected: element.getAttribute('aria-selected') === 'true' || (element.parentElement instanceof HTMLDetailsElement && element.parentElement.open) };
  });
  return { success: true, moduleId, fields: resultFields, views: resultViews };
}

export async function waitForCopilotTarget(find: () => HTMLElement | null, timeout = 12_000, signal?: AbortSignal): Promise<HTMLElement> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('Task stopped.');
    const element = find();
    if (element && visible(element)) {
      // Let React commit controlled fields and lazy module content before reading.
      await pause(120);
      return element;
    }
    await pause(100);
  }
  throw new Error('This module did not become available. It may need an account connection or a different subscription.');
}

export function spotlightCopilotTarget(element: HTMLElement) {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.classList.add('profile-copilot-focus');
  if (!document.getElementById('profile-copilot-focus-style')) {
    const style = document.createElement('style');
    style.id = 'profile-copilot-focus-style';
    style.textContent = '.profile-copilot-focus{outline:2px solid #c4b5fd!important;outline-offset:5px;box-shadow:0 0 38px #a78bfa35!important;transition:outline-color .2s,box-shadow .2s}';
    document.head.appendChild(style);
  }
  window.setTimeout(() => element.classList.remove('profile-copilot-focus'), 3500);
}

function requireField(moduleId: string, fieldId: string) {
  const item = fields.get(fieldId);
  if (!item || item.scope.moduleId !== moduleId || !item.scope.root.contains(item.element) || !editable(item.element) || item.element.disabled) {
    throw new Error('This field is unavailable or changed. Inspect the module again before editing.');
  }
  return item;
}

async function comboboxOptions(element: HTMLButtonElement, signal?: AbortSignal): Promise<HTMLElement[]> {
  if (element.getAttribute('aria-expanded') !== 'true') flushSync(() => element.click());
  const popup = await waitForCopilotTarget(() => {
    const controlledId = element.getAttribute('aria-controls');
    return controlledId ? document.getElementById(controlledId) : null;
  }, 3000, signal);
  return Array.from(popup.querySelectorAll<HTMLElement>('[role="option"]')).filter((option) => option.getAttribute('aria-disabled') !== 'true');
}

export async function inspectCopilotFieldOptions(moduleId: string, fieldId: string, signal?: AbortSignal): Promise<CopilotUiResult> {
  const { element, scope } = requireField(moduleId, fieldId);
  if (element instanceof HTMLButtonElement && !element.hasAttribute('data-copilot-option')) {
    const options = await comboboxOptions(element, signal);
    const labels = options.slice(0, 100).map((option) => ({ value: (option.textContent || '').trim().slice(0, 500), label: (option.textContent || '').trim().slice(0, 500) }));
    flushSync(() => { document.getElementById(element.getAttribute('aria-controls') || '')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    const result = inspectCopilotInterface(scope.root, moduleId);
    result.fields?.forEach((field) => { if (field.id === fieldId) field.options = labels; });
    return result;
  }
  return inspectCopilotInterface(scope.root, moduleId);
}

export async function selectCopilotView(moduleId: string, controlId: string): Promise<CopilotUiResult> {
  const view = views.get(controlId);
  if (!view || view.scope.moduleId !== moduleId || !view.scope.root.contains(view.element) || !visible(view.element)) throw new Error('Inspect the module before choosing a view.');
  if (view.element.tagName === 'SUMMARY' && view.element.parentElement instanceof HTMLDetailsElement) view.element.parentElement.open = true;
  else if (view.element.getAttribute('role') === 'tab') flushSync(() => view.element.click());
  else throw new Error('This control is not an editable module view.');
  await pause(150);
  return inspectCopilotInterface(view.scope.root, moduleId);
}

export async function fillCopilotFields(moduleId: string, changes: Array<{ fieldId: string; value: string }>, signal?: AbortSignal): Promise<CopilotUiResult> {
  // Validate the whole batch before mutating any field. Never accept selectors,
  // scripts, submit buttons, file inputs, billing details or credential fields.
  const batch = changes.map((change) => ({ ...change, ...requireField(moduleId, change.fieldId) }));
  for (const { element, value } of batch) {
    if (value.length > 12000 || ('maxLength' in element && element.maxLength >= 0 && value.length > element.maxLength)) throw new Error(`The value for ${labelFor(element)} is too long.`);
    if (element instanceof HTMLSelectElement && !Array.from(element.options).some((option) => !option.disabled && (option.value === value || option.text === value))) throw new Error(`Choose an available option for ${labelFor(element)}.`);
    if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type) && !['true', 'false'].includes(value)) throw new Error('Toggle fields require true or false.');
    if (element.hasAttribute('data-copilot-option') && value !== 'true') throw new Error('Select a choice by setting its value to true.');
    if (element instanceof HTMLInputElement && ['number', 'range'].includes(element.type) && (!Number.isFinite(Number(value)) || (element.min !== '' && Number(value) < Number(element.min)) || (element.max !== '' && Number(value) > Number(element.max)))) throw new Error(`Use a number within the limits for ${labelFor(element)}.`);
  }
  const applied: string[] = [];
  for (const { element, scope, value } of batch) {
    if (signal?.aborted) throw new Error('Task stopped.');
    if (!element.isConnected || !scope.root.contains(element)) return { success: false, moduleId, applied, error: 'A field changed while editing. Inspect the updated form.' };
    spotlightCopilotTarget(element);
    let expectedValue = value;
    if (element instanceof HTMLButtonElement && element.hasAttribute('data-copilot-option')) {
      if (element.getAttribute('aria-pressed') !== 'true') flushSync(() => element.click());
    } else if (element instanceof HTMLButtonElement) {
      const options = await comboboxOptions(element, signal);
      const chosen = options.find((option) => (option.textContent || '').trim() === value);
      if (!chosen) return { success: false, moduleId, applied, error: `The option for ${labelFor(element)} is unavailable.` };
      flushSync(() => chosen.click());
    } else if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
      if (element.checked !== (value === 'true')) flushSync(() => element.click());
    } else {
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      const nextValue = element instanceof HTMLSelectElement ? Array.from(element.options).find((option) => option.value === value || option.text === value)!.value : value;
      expectedValue = nextValue;
      // Native setter bypasses React's value tracker so its onChange receives
      // the same input/change events as a real user edit.
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, nextValue);
      flushSync(() => {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    await pause(100);
    if (valueOf(element) !== expectedValue) return { ...inspectCopilotInterface(scope.root, moduleId), success: false, saved: false, applied, error: `The form did not retain the requested value for ${labelFor(element)}. Inspect its current value before retrying.` };
    applied.push(labelFor(element));
  }
  const scope = batch[0]?.scope;
  return { ...(scope ? inspectCopilotInterface(scope.root, moduleId) : { success: true, moduleId }), applied, saved: false };
}
