import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}), emit: vi.fn() }));
vi.mock('../bootPreload', () => ({ takePreloadedSettings: () => null }));
vi.mock('./platform', async (original) => ({
  ...(await original<typeof import('./platform')>()),
  IS_MOBILE: false,
}));
vi.mock('./songHistory', () => ({ openSongs: vi.fn() }));

import { SETTINGS_INDEX } from '../components/settings/searchIndex';
import { useAppStore } from '../stores/AppStore';
import { followAppLink } from './appLinks';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

// The pages Rust opens (`"slug" => Self::Variant` in app_links.rs).
const rustPages = [...read('src-tauri/src/services/app_links.rs').matchAll(/"([a-z-]+)" => Self::(\w+)/g)].map(
  ([, slug, variant]) => ({ slug, page: variant.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase() }),
);

describe('app links', () => {
  it('a settings link opens Settings on its tab and row', () => {
    followAppLink({ kind: 'settings', tab: 'Chat', row: 'Italic /me messages' });
    const s = useAppStore.getState();
    expect(s.isSettingsOpen).toBe(true);
    expect(s.settingsInitialTab).toBe('Chat');
    expect(s.settingsInitialRow).toBe('Italic /me messages');
    s.closeSettings();
    expect(useAppStore.getState().settingsInitialRow).toBeNull();
  });

  it('every page Rust can open is one the app handles', () => {
    const union = read('src/types/index.ts').match(/export type AppLinkPage =([^;]+);/)?.[1] ?? '';
    const tsPages = [...union.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(rustPages.map((p) => p.page).sort()).toEqual(tsPages);
    const handled = read('src/utils/appLinks.ts');
    for (const page of tsPages) expect(handled).toContain(`case '${page}':`);
  });

  it('every app link in the changelog goes somewhere real', () => {
    const links = [...read('CHANGELOG.md').matchAll(/\]\((streamnook:[^)\s]+)\)/g)].map((m) => m[1]);
    for (const link of links) {
      const url = new URL(link);
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (url.host === 'open') {
        expect(rustPages.map((p) => p.slug), link).toContain(parts[0]);
        expect(parts, link).toHaveLength(1);
      } else {
        expect(url.host, link).toBe('settings');
        const [tab, row] = parts;
        const hit = SETTINGS_INDEX.some(
          (e) => e.tab.toLowerCase() === tab?.toLowerCase() && (row === undefined || e.title === row),
        );
        expect(hit, `${link} names no settings row`).toBe(true);
      }
    }
  });
});
