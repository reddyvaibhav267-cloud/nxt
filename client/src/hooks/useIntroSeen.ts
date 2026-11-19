import { useState } from 'react';

const KEY = 'nxt:seen-intro';

/**
 * The intro loader plays once per browser session.
 * Returns whether it should show and a dismiss callback.
 */
export function useIntroVisibility(): { show: boolean; dismiss: () => void } {
  const [show, setShow] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(KEY) !== '1';
    } catch {
      return true;
    }
  });

  const dismiss = () => {
    setShow(false);
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* private mode — just don't persist */
    }
  };

  return { show, dismiss };
}
