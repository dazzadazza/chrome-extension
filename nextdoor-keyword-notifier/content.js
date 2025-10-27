(() => {
  const state = {
    keywords: [],
    debugOverlay: false
  };

  let parsedKeywords = [];
  const recentHashes = new Set();
  const recentQueue = [];
  const RECENT_HASH_LIMIT = 500;

  const selectors = [
    '[data-testid="post"]',
    'article',
    'div[class*="Post"]'
  ];

  const normalizeText = (text) => {
    if (!text) {
      return '';
    }
    const folded = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return folded.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  };

  const parseKeywords = () => {
    parsedKeywords = state.keywords
      .map((raw) => (typeof raw === 'string' ? raw.trim() : ''))
      .filter(Boolean)
      .map((raw) => {
        if (raw.length >= 2 && raw.startsWith('/') && raw.endsWith('/')) {
          const pattern = raw.slice(1, -1);
          try {
            return {
              type: 'regex',
              raw,
              matcher: new RegExp(pattern, 'i')
            };
          } catch (error) {
            console.warn('Invalid regex keyword skipped:', raw, error);
            return null;
          }
        }
        return {
          type: 'text',
          raw,
          matcher: normalizeText(raw)
        };
      })
      .filter(Boolean);
  };

  const ensureSettingsLoaded = () => {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['keywords', 'debugOverlay'], (result) => {
        state.keywords = Array.isArray(result.keywords) ? result.keywords : [];
        state.debugOverlay = Boolean(result.debugOverlay);
        parseKeywords();
        resolve();
      });
    });
  };

  const hashString = async (input) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const rememberHash = (hash) => {
    if (recentHashes.has(hash)) {
      return false;
    }
    recentHashes.add(hash);
    recentQueue.push(hash);
    if (recentQueue.length > RECENT_HASH_LIMIT) {
      const oldest = recentQueue.shift();
      recentHashes.delete(oldest);
    }
    return true;
  };

  const applyDebugOverlay = (element, phrase) => {
    if (!state.debugOverlay || !element) {
      return;
    }
    const stored = element.dataset.ndknPhrases ? element.dataset.ndknPhrases.split('\u0000').filter(Boolean) : [];
    if (!stored.includes(phrase)) {
      stored.push(phrase);
    }
    element.dataset.ndknPhrases = stored.join('\u0000');
    const label = stored.join(', ');
    element.style.outline = '2px solid #2e7d32';
    element.style.position = element.style.position || 'relative';

    const existingBadge = element.querySelector('.ndkn-debug-badge');
    if (existingBadge) {
      existingBadge.textContent = label;
      return;
    }
    const badge = document.createElement('div');
    badge.className = 'ndkn-debug-badge';
    badge.textContent = label;
    Object.assign(badge.style, {
      position: 'absolute',
      top: '8px',
      right: '8px',
      background: '#2e7d32',
      color: '#fff',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 'bold',
      zIndex: 9999
    });
    element.appendChild(badge);
  };

  const clearDebugOverlay = () => {
    document.querySelectorAll('[data-ndkn-phrases]').forEach((el) => {
      el.style.outline = '';
      delete el.dataset.ndknPhrases;
      const badge = el.querySelector('.ndkn-debug-badge');
      if (badge) {
        badge.remove();
      }
    });
  };

  const extractUrl = (element) => {
    if (!element) {
      return location.href;
    }
    const permalink = element.querySelector('a[href*="/p/"]') || element.querySelector('a[href*="permalink"]');
    if (permalink && permalink.href) {
      return permalink.href;
    }
    return location.href;
  };

  const extractText = (element) => {
    if (!element) {
      return '';
    }
    const text = element.innerText || element.textContent || '';
    return text.slice(0, 5000);
  };

  const findMatchingKeywords = (originalText, normalizedText) => {
    const matches = [];
    for (const keyword of parsedKeywords) {
      if (keyword.type === 'regex') {
        if (keyword.matcher.test(originalText)) {
          matches.push(keyword.raw);
        }
      } else if (normalizedText.includes(keyword.matcher)) {
        matches.push(keyword.raw);
      }
    }
    return matches;
  };

  const processElement = async (element) => {
    const originalText = extractText(element);
    if (!originalText) {
      return;
    }
    const normalizedText = normalizeText(originalText);
    const matches = findMatchingKeywords(originalText, normalizedText);
    if (!matches.length) {
      return;
    }

    const url = extractUrl(element);
    const snippet = originalText.trim().slice(0, 200);

    for (const phrase of matches) {
      const hashSource = `${url}|${phrase}|${originalText.slice(0, 128)}`;
      const hash = await hashString(hashSource);
      if (!rememberHash(hash)) {
        continue;
      }

      applyDebugOverlay(element, phrase);

      chrome.runtime.sendMessage({
        type: 'MATCH',
        payload: {
          url,
          snippet,
          phrase
        }
      });
    }
  };

  const scanPosts = async () => {
    const elements = new Set();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((el) => {
        elements.add(el);
      });
    }

    for (const element of elements) {
      await processElement(element);
    }
  };

  let scheduled = false;
  const scheduleScan = () => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    setTimeout(async () => {
      scheduled = false;
      await scanPosts();
    }, 400);
  };

  const observer = new MutationObserver(() => {
    scheduleScan();
  });

  const init = async () => {
    await ensureSettingsLoaded();
    scheduleScan();
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') {
      return;
    }
    let shouldRescan = false;
    if (changes.keywords) {
      state.keywords = Array.isArray(changes.keywords.newValue) ? changes.keywords.newValue : [];
      parseKeywords();
      shouldRescan = true;
    }
    if (changes.debugOverlay) {
      state.debugOverlay = Boolean(changes.debugOverlay.newValue);
      if (!state.debugOverlay) {
        clearDebugOverlay();
      }
      shouldRescan = true;
    }
    if (shouldRescan) {
      scheduleScan();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
