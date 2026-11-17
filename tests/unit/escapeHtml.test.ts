import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../src/utils/escapeHtml';

describe('escapeHtml', () => {
  it('preserves text without allowing markup or attribute injection', () => {
    const value = '</textarea><img src=x onerror="alert(1)"> & \'';
    const encoded = escapeHtml(value);
    const root = document.createElement('div');
    root.innerHTML = `<textarea>${encoded}</textarea><div data-value="${encoded}"></div>`;
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('textarea')?.value).toBe(value);
    expect(root.querySelector('[data-value]')?.getAttribute('data-value')).toBe(value);
  });
});
