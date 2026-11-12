import { invoke } from '@tauri-apps/api/core';
import { useAppStore, type SettingsTab } from '../stores/AppStore';
import type { AppLink } from '../types';
import { Logger } from './logger';
import { openSongs } from './songHistory';

// Links in the update notes (`streamnook://settings/...`, `streamnook://open/...`).
// Rust reads a link into where it goes (`app_link_target`); this only opens
// that place, through the same store calls the command palette uses.

/** Where a link goes, or null when it is not an app link Rust knows. */
export async function appLinkTarget(url: string): Promise<AppLink | null> {
  try {
    return await invoke<AppLink | null>('app_link_target', { url });
  } catch (err) {
    Logger.warn('[appLinks] could not read link:', err);
    return null;
  }
}

/** Open the place a link names. */
export function followAppLink(link: AppLink): void {
  const store = useAppStore.getState();
  if (link.kind === 'settings') {
    store.openSettings(link.tab as SettingsTab, undefined, link.row ?? undefined);
    return;
  }
  switch (link.page) {
    case 'drops':
      store.setShowDropsOverlay(true);
      return;
    case 'whispers':
      store.setShowWhispersOverlay(true);
      return;
    case 'badges':
      store.setShowBadgesOverlay(true);
      return;
    case 'emote_sets':
      store.openEmoteSets();
      return;
    case 'multichat':
      void import('./multichatWindow')
        .then(({ openMultiChatWindow }) => openMultiChatWindow({}))
        .catch((err) => Logger.error('[appLinks] MultiChat failed:', err));
      return;
    case 'songs':
      openSongs();
      return;
    case 'profile':
      store.openSettings('Profile');
      return;
    case 'home':
      if (!store.isHomeActive) store.toggleHome();
      return;
  }
}
