/**
 * Player Preferences Utility
 * Stores and retrieves user preferences for video playback
 */

const STORAGE_PREFIX = 'ifilm_player_';

export interface PlayerPreferences {
  audioTrack: number | null;
  subtitleTrack: number | null;
  playbackSpeed: number;
  volume: number;
  muted: boolean;
  lastPosition: number;
  lastWatched: number; // timestamp
}

/**
 * Get preferences for a specific media item
 */
export const getPlayerPreferences = (mediaId: string): Partial<PlayerPreferences> => {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${mediaId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[PlayerPreferences] Error reading preferences:', error);
  }
  return {};
};

/**
 * Save preferences for a specific media item
 */
export const savePlayerPreferences = (mediaId: string, preferences: Partial<PlayerPreferences>): void => {
  try {
    const existing = getPlayerPreferences(mediaId);
    const updated = {
      ...existing,
      ...preferences,
      lastWatched: Date.now(),
    };
    localStorage.setItem(`${STORAGE_PREFIX}${mediaId}`, JSON.stringify(updated));
  } catch (error) {
    console.error('[PlayerPreferences] Error saving preferences:', error);
  }
};

/**
 * Get last playback position for a media item
 */
export const getLastPosition = (mediaId: string): number => {
  const prefs = getPlayerPreferences(mediaId);
  return prefs.lastPosition || 0;
};

/**
 * Save playback position
 */
export const saveLastPosition = (mediaId: string, position: number): void => {
  savePlayerPreferences(mediaId, { lastPosition: position });
};

/**
 * Get saved audio track preference
 */
export const getSavedAudioTrack = (mediaId: string): number | null => {
  const prefs = getPlayerPreferences(mediaId);
  return prefs.audioTrack ?? null;
};

/**
 * Save audio track preference
 */
export const saveAudioTrack = (mediaId: string, trackIndex: number | null): void => {
  savePlayerPreferences(mediaId, { audioTrack: trackIndex });
};

/**
 * Get saved subtitle preference
 */
export const getSavedSubtitle = (mediaId: string): number | null => {
  const prefs = getPlayerPreferences(mediaId);
  return prefs.subtitleTrack ?? null;
};

/**
 * Save subtitle preference
 */
export const saveSubtitle = (mediaId: string, trackIndex: number | null): void => {
  savePlayerPreferences(mediaId, { subtitleTrack: trackIndex });
};

/**
 * Get saved playback speed
 */
export const getSavedPlaybackSpeed = (mediaId: string): number => {
  const prefs = getPlayerPreferences(mediaId);
  return prefs.playbackSpeed ?? 1;
};

/**
 * Save playback speed
 */
export const savePlaybackSpeed = (mediaId: string, speed: number): void => {
  savePlayerPreferences(mediaId, { playbackSpeed: speed });
};

/**
 * Get saved video quality preference
 */
export const getSavedVideoQuality = (mediaId: string): string => {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${mediaId}_quality`);
    return stored || 'auto';
  } catch (error) {
    console.error('[PlayerPreferences] Error reading quality:', error);
  }
  return 'auto';
};

/**
 * Save video quality preference
 */
export const saveVideoQuality = (mediaId: string, quality: string): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${mediaId}_quality`, quality);
  } catch (error) {
    console.error('[PlayerPreferences] Error saving quality:', error);
  }
};

/**
 * Get saved volume
 */
export const getSavedVolume = (): number => {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}volume`);
    if (stored) {
      return parseFloat(stored);
    }
  } catch (error) {
    console.error('[PlayerPreferences] Error reading volume:', error);
  }
  return 1;
};

/**
 * Save volume (global, not per-media)
 */
export const saveVolume = (volume: number): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}volume`, volume.toString());
  } catch (error) {
    console.error('[PlayerPreferences] Error saving volume:', error);
  }
};

/**
 * Get saved muted state
 */
export const getSavedMuted = (): boolean => {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}muted`);
    if (stored) {
      return stored === 'true';
    }
  } catch (error) {
    console.error('[PlayerPreferences] Error reading muted state:', error);
  }
  return false;
};

/**
 * Save muted state (global, not per-media)
 */
export const saveMuted = (muted: boolean): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}muted`, muted.toString());
  } catch (error) {
    console.error('[PlayerPreferences] Error saving muted state:', error);
  }
};

