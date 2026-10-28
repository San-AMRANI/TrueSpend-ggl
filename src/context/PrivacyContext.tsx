import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

interface PrivacyContextType {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  setPrivacyMode: (value: boolean) => void;
  maskText: (value: string | number, suffix?: string) => string;
}

const STORAGE_KEY = 'truespend_privacy_mode';

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivacyMode: false,
  togglePrivacyMode: () => {},
  setPrivacyMode: () => {},
  maskText: (val, suffix) => `${val}${suffix ? ` ${suffix}` : ''}`,
});

/**
 * Masks monetary numbers in a text string with stars (******) while keeping currency labels and structure intact.
 */
export function maskMonetaryString(input: string): string {
  if (!input || !/\d/.test(input)) return input;

  let result = input;

  // 1. Dollar-prefixed amounts: e.g. "$83.00", "+$12.45", "-$5.34", "$ 1,200"
  result = result.replace(/([+-−]?\s*\$)\s*\d[\d,.]*/g, '$1******');

  // 2. Amounts followed by currency / asset codes: e.g. "879 MAD", "-53.15 MAD", "1,250.00 USD", "200 MAD/day"
  result = result.replace(
    /([+-−]?\s*)\d[\d,.\s]*\d(\s*(?:MAD|USD|EUR|GBP|DH|USDT|USDC|BTC|ETH|BNB)\b)/gi,
    '$1******$2'
  );
  result = result.replace(
    /([+-−]?\s*)\d(\s*(?:MAD|USD|EUR|GBP|DH|USDT|USDC|BTC|ETH|BNB)\b)/gi,
    '$1******$2'
  );

  // 3. Compact overview strip tokens: e.g. "Liquidity 4500", "Stocks +826", "Buffer −1000", "Inv Reserve −879", "Subs 120/mo", "Payables −300"
  result = result.replace(
    /\b(Liquidity|Stocks|Buffer|Inv Reserve|Subs|Payables)\s+([+-−]?\d[\d,.]*)/gi,
    '$1 ******'
  );

  // 4. Decimal currency figures (2 to 6 decimal places, e.g. "1234.56", "879.00", "0.00")
  result = result.replace(/[+-−]?\b\d[\d,]*\.\d{2,6}\b(?:\s*%?)/g, (match) => {
    if (match.trim().endsWith('%')) {
      return '****%';
    }
    return '******';
  });

  return result;
}

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const trackedNodesRef = useRef<Map<Text, { original: string; masked: string }>>(new Map());
  const isApplyingMaskRef = useRef(false);

  const setPrivacyMode = useCallback((value: boolean) => {
    setIsPrivacyMode(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore storage errors
    }
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const maskText = useCallback(
    (value: string | number, suffix?: string) => {
      if (isPrivacyMode) {
        return suffix ? `****** ${suffix}` : '******';
      }
      return suffix ? `${value} ${suffix}` : String(value);
    },
    [isPrivacyMode]
  );

  // Global DOM monetary text masker so every tab, modal, chart tooltip, and table respects Privacy Mode
  useEffect(() => {
    const restoreAllNodes = () => {
      isApplyingMaskRef.current = true;
      try {
        trackedNodesRef.current.forEach((entry, textNode) => {
          if (textNode.nodeValue === entry.masked) {
            textNode.nodeValue = entry.original;
          }
        });
        trackedNodesRef.current.clear();
      } finally {
        isApplyingMaskRef.current = false;
      }
    };

    if (!isPrivacyMode) {
      restoreAllNodes();
      return;
    }

    const shouldSkipNode = (node: Text): boolean => {
      const parent = node.parentElement;
      if (!parent) return true;
      const tag = parent.tagName;
      if (
        tag === 'SCRIPT' ||
        tag === 'STYLE' ||
        tag === 'TEXTAREA' ||
        tag === 'INPUT' ||
        tag === 'KBD' ||
        parent.closest('[data-privacy-exempt="true"]')
      ) {
        return true;
      }
      return false;
    };

    const applyMaskToRoot = (root: Node) => {
      if (isApplyingMaskRef.current) return;
      isApplyingMaskRef.current = true;
      try {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let current = walker.nextNode() as Text | null;
        while (current) {
          if (!shouldSkipNode(current)) {
            const raw = current.nodeValue || '';
            const existing = trackedNodesRef.current.get(current);
            if (!existing || raw !== existing.masked) {
              const masked = maskMonetaryString(raw);
              if (masked !== raw) {
                trackedNodesRef.current.set(current, { original: raw, masked });
                current.nodeValue = masked;
              }
            }
          }
          current = walker.nextNode() as Text | null;
        }
      } finally {
        isApplyingMaskRef.current = false;
      }
    };

    applyMaskToRoot(document.body);

    const observer = new MutationObserver((mutations) => {
      if (isApplyingMaskRef.current) return;
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          const textNode = mutation.target as Text;
          if (!shouldSkipNode(textNode)) {
            const raw = textNode.nodeValue || '';
            const existing = trackedNodesRef.current.get(textNode);
            if (!existing || raw !== existing.masked) {
              const masked = maskMonetaryString(raw);
              if (masked !== raw) {
                isApplyingMaskRef.current = true;
                trackedNodesRef.current.set(textNode, { original: raw, masked });
                textNode.nodeValue = masked;
                isApplyingMaskRef.current = false;
              }
            }
          }
        } else if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((added) => {
            if (added.nodeType === Node.TEXT_NODE) {
              const textNode = added as Text;
              if (!shouldSkipNode(textNode)) {
                const raw = textNode.nodeValue || '';
                const masked = maskMonetaryString(raw);
                if (masked !== raw) {
                  isApplyingMaskRef.current = true;
                  trackedNodesRef.current.set(textNode, { original: raw, masked });
                  textNode.nodeValue = masked;
                  isApplyingMaskRef.current = false;
                }
              }
            } else if (added.nodeType === Node.ELEMENT_NODE) {
              applyMaskToRoot(added);
            }
          });
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [isPrivacyMode]);

  return (
    <PrivacyContext.Provider
      value={{
        isPrivacyMode,
        togglePrivacyMode,
        setPrivacyMode,
        maskText,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = () => useContext(PrivacyContext);
