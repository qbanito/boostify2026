import { useMemo } from 'react';

export interface KaraokeWord {
  word: string;
  start: number;
  end: number;
}

export interface KaraokeLine {
  text: string;
  startTime: number;
  endTime: number;
  words?: KaraokeWord[];
}

interface KaraokeSyncResult {
  currentLineIndex: number;
  prevLineIndex: number;
  nextLineIndex: number;
  currentWordIndex: number;
  /** 0–1 progress through the current line */
  lineProgress: number;
}

/**
 * useKaraokeSync
 *
 * Pure computation hook — given `currentTime` (seconds, from useAudioPlayer().progress)
 * and an array of synced lyric lines, returns the active line + word indices.
 * No side-effects; safe to call every render.
 */
export function useKaraokeSync(
  lines: KaraokeLine[],
  currentTime: number
): KaraokeSyncResult {
  return useMemo<KaraokeSyncResult>(() => {
    if (!lines || lines.length === 0) {
      return { currentLineIndex: -1, prevLineIndex: -1, nextLineIndex: 0, currentWordIndex: -1, lineProgress: 0 };
    }

    // Binary search for current line
    let lo = 0;
    let hi = lines.length - 1;
    let found = -1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const line = lines[mid];
      if (currentTime >= line.startTime && currentTime < line.endTime) {
        found = mid;
        break;
      } else if (currentTime < line.startTime) {
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }

    if (found === -1) {
      if (currentTime < lines[0].startTime) {
        return { currentLineIndex: -1, prevLineIndex: -1, nextLineIndex: 0, currentWordIndex: -1, lineProgress: 0 };
      }
      // Past last line
      found = lines.length - 1;
    }

    const line = lines[found];
    const duration = line.endTime - line.startTime;
    const lineProgress = duration > 0 ? Math.min(1, (currentTime - line.startTime) / duration) : 0;

    // Find current word within this line
    let currentWordIndex = -1;
    if (line.words && line.words.length > 0) {
      for (let i = 0; i < line.words.length; i++) {
        if (currentTime >= line.words[i].start && currentTime < line.words[i].end) {
          currentWordIndex = i;
          break;
        }
        if (currentTime >= line.words[i].end) {
          currentWordIndex = i;
        }
      }
    }

    return {
      currentLineIndex: found,
      prevLineIndex: found > 0 ? found - 1 : -1,
      nextLineIndex: found < lines.length - 1 ? found + 1 : -1,
      currentWordIndex,
      lineProgress,
    };
  }, [lines, currentTime]);
}
