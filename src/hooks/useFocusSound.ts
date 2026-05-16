import { useEffect, useRef, useState, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

// Publicly available loopable ambient sounds (public domain / Creative Commons)
// Replace with local assets (assets/sounds/*.mp3) for offline support
const SOUND_URLS: Record<FocusSound, string> = {
  rain:  'https://cdn.freesound.org/previews/346/346642_5858296-lq.mp3',
  noise: 'https://cdn.freesound.org/previews/361/361300_6681381-lq.mp3',
  cafe:  'https://cdn.freesound.org/previews/462/462550_7349983-lq.mp3',
};

export type FocusSound = 'rain' | 'noise' | 'cafe' | 'off';

export const FOCUS_SOUND_LABELS: Record<FocusSound, string> = {
  rain:  'Deszcz',
  noise: 'Szum',
  cafe:  'Kawiarnia',
  off:   'Cisza',
};

export function useFocusSound(isRunning: boolean) {
  const [selected, setSelected] = useState<FocusSound>('off');
  const soundRef = useRef<Audio.Sound | null>(null);
  const loadedFor = useRef<FocusSound | null>(null);

  const unload = useCallback(async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
      loadedFor.current = null;
    }
  }, []);

  // Load & play when selected+running changes
  useEffect(() => {
    let cancelled = false;

    const manage = async () => {
      if (selected === 'off' || !isRunning) {
        await unload();
        return;
      }

      // Same sound already loaded → just play/resume
      if (soundRef.current && loadedFor.current === selected) {
        try { await soundRef.current.playAsync(); } catch {}
        return;
      }

      // Load new sound
      await unload();
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: SOUND_URLS[selected] },
          { shouldPlay: true, isLooping: true, volume: 0.35 },
        );
        if (!cancelled) {
          soundRef.current = sound;
          loadedFor.current = selected;
        } else {
          await sound.unloadAsync();
        }
      } catch {
        // Silently fail (network unavailable, etc.)
      }
    };

    manage();
    return () => { cancelled = true; };
  }, [selected, isRunning]);

  // Pause when timer paused, resume when running
  useEffect(() => {
    if (!soundRef.current) return;
    if (isRunning) {
      soundRef.current.playAsync().catch(() => {});
    } else {
      soundRef.current.pauseAsync().catch(() => {});
    }
  }, [isRunning]);

  // Cleanup on unmount
  useEffect(() => () => { unload(); }, []);

  return { selected, setSelected };
}
