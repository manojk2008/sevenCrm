import { useEffect } from 'react';

export interface ShortcutOptions {
  preventDefault?: boolean;
  stopPropagation?: boolean;
  disabled?: boolean;
}

/**
 * Hook to execute a callback when a specific keyboard shortcut is triggered
 * 
 * @param keys Array of keys that should be pressed (e.g. ['Control', 'k'])
 * @param callback The function to call when the shortcut is triggered
 * @param options Additional options (preventDefault, stopPropagation, disabled)
 */
export function useKeyboardShortcut(
  keys: string[],
  callback: (e: KeyboardEvent) => void,
  options: ShortcutOptions = {}
) {
  const { 
    preventDefault = true, 
    stopPropagation = true, 
    disabled = false 
  } = options;

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const hasModifiers = {
        ctrl: keys.includes('Control') || keys.includes('Ctrl'),
        shift: keys.includes('Shift'),
        alt: keys.includes('Alt'),
        meta: keys.includes('Meta') || keys.includes('Cmd'),
      };

      const ctrlPressed = event.ctrlKey;
      const shiftPressed = event.shiftKey;
      const altPressed = event.altKey;
      const metaPressed = event.metaKey;

      if (
        hasModifiers.ctrl !== ctrlPressed ||
        hasModifiers.shift !== shiftPressed ||
        hasModifiers.alt !== altPressed ||
        hasModifiers.meta !== metaPressed
      ) {
        return;
      }

      const mainKey = keys.find(
        key => !['Control', 'Ctrl', 'Shift', 'Alt', 'Meta', 'Cmd'].includes(key)
      );

      if (mainKey && event.key.toLowerCase() !== mainKey.toLowerCase()) {
        return;
      }

      if (preventDefault) {
        event.preventDefault();
      }

      if (stopPropagation) {
        event.stopPropagation();
      }

      callback(event);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [keys, callback, preventDefault, stopPropagation, disabled]);
}
