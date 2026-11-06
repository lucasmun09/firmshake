import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const themeDir = resolve(__dirname, '../../src/theme');

function readThemeFile(name: string): string {
  return readFileSync(resolve(themeDir, name), 'utf8');
}

describe('spacing tokens', () => {
  it('defines core spacing variables in variables.css', () => {
    const css = readThemeFile('variables.css');

    expect(css).toContain('--fs-page-inset-inline');
    expect(css).toContain('--fs-page-inset-block');
    expect(css).toContain('--fs-section-gap');
    expect(css).toContain('--fs-card-gap');
    expect(css).toContain('--fs-form-field-gap');
    expect(css).toContain('--fs-sidebar-inset');
    expect(css).toContain('--fs-toolbar-inset');
  });

  it('applies page inset on AppContentFrame in layout.css', () => {
    const css = readThemeFile('layout.css');

    expect(css).toMatch(/\.app-content-frame[\s\S]*padding-inline:\s*var\(--fs-page-inset-inline\)/);
    expect(css).toContain('.app-content-frame--flush-x');
    expect(css).toContain('.app-tab-content');
    expect(css).toContain('.app-form-stack');
    expect(css).toContain('ion-toolbar.app-toolbar-content');
    expect(css).toContain('--color: var(--ion-text-color)');
  });
});
