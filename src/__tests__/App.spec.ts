import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount, type VueWrapper } from '@vue/test-utils';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App.vue';

const mounted: VueWrapper[] = [];

function mountApp(): VueWrapper {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const wrapper = mount(App, { attachTo: host });
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount();
  }
  document.body.innerHTML = '';
});

describe('App — tela neutra inicial', () => {
  it('monta e renderiza o título principal', () => {
    const wrapper = mountApp();
    const headings = wrapper.findAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0]?.text()).toBe('FinBank V2');
  });

  it('usa landmarks semânticos únicos', () => {
    const wrapper = mountApp();
    expect(wrapper.findAll('header')).toHaveLength(1);
    expect(wrapper.findAll('main')).toHaveLength(1);
    expect(wrapper.findAll('footer')).toHaveLength(1);
  });

  it('não simula resultados ou valores financeiros', () => {
    const wrapper = mountApp();
    expect(wrapper.text()).not.toMatch(/R\$|\bsaldo\b|\bextrato\b|\bpix\b|\d+[.,]\d{2}\b/i);
    expect(wrapper.findAll('button, form, input, a')).toHaveLength(0);
  });

  it('não apresenta violações axe (color-contrast exige layout real, fora do jsdom)', async () => {
    mountApp();
    const result = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe('index.html', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  it('declara idioma pt-BR, título e viewport', () => {
    expect(html).toMatch(/<html lang="pt-BR">/);
    expect(html).toMatch(/<title>FinBank V2<\/title>/);
    expect(html).toMatch(/<meta name="viewport"/);
  });
});
