const DEFAULT_SETTINGS = {
  keywords: [],
  debugOverlay: false
};

const notificationUrls = new Map();
let lastNotificationTime = 0;
const NOTIFICATION_THROTTLE_MS = 3000;

const NOTIFICATION_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAACCUlEQVR4nO3RMXKEQBAEwXuRDP1Pb5d8AkcM19vLJYE/XZuvr5/vyf/7z294LvCHi157zQUwndtvAADAmwHKDQAAeD9AswEAABGAWgMAAFIAnQafBVBoAABAFqDNAACAOECVAQAAKwB6DAAAWARQYvDRAA0GAAAsBVhuAADAaoB5FYDpB2AxwDwMwPQDsBhg3gZg+gFYDDDPA3AyN1wI4Dg3XAjgZG44EsBxbjgSwMnccCeA49xwJ4CTueFUAMe54VQAJ3PDtQBO5oaDAQAoA2gzCI8BAKDMILwEAIAyg/AMAADKDMIbugAaDMIDAABY/QQAAPTNDb8CAAB9c8MPAQBA39zwWwAA0Dc3/BwA1r9I+BwAADVXAFQ8SvLWNgCPPAQAQOWtZBEAAH3nwkWbAQQuhosAACg7Gi4CAKDsbrgIAICy0+EiAADKroeLAAAoGxAu2h7g9g3hIgAAygzCRQAAlBmEiwAAKDMIFwEAUGYQLnoawHxSuAgAgDKDcBGA46pw0TMBJsPCRQCOw8JFjwW4vC1cBOC4LVz0ZIBr88JFDwe4sDBcBGD6AVhsAABAcG6hAQAAwbmFBgAABOcWGgAAsA/AOwwALDYAAGA3gHsNAADYEOBGAwAA9gS4ywAAgG0BbjEAsNgAAIDNAYYGAADsDzAxAADgEQCXDQAAeArANQMAiw2G5/4Ae7dH2wErhEwAAAAASUVORK5CYII=';

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const settingsToSet = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (stored[key] === undefined) {
      settingsToSet[key] = DEFAULT_SETTINGS[key];
    }
  }
  if (Object.keys(settingsToSet).length > 0) {
    await chrome.storage.sync.set(settingsToSet);
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  const url = notificationUrls.get(notificationId);
  if (!url) {
    return;
  }
  chrome.tabs.create({ url });
  chrome.notifications.clear(notificationId);
  notificationUrls.delete(notificationId);
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message) {
    return;
  }

  if (message.type === 'MATCH' && message.payload) {
    const { url, snippet, phrase } = message.payload;
    if (!url || !phrase) {
      return;
    }

    const now = Date.now();
    if (now - lastNotificationTime < NOTIFICATION_THROTTLE_MS) {
      return;
    }
    lastNotificationTime = now;

    const notificationId = `nextdoor-match-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const messageText = `${phrase} found`;

    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: NOTIFICATION_ICON,
      title: 'Keyword match',
      message: messageText,
      contextMessage: snippet ? snippet.slice(0, 200) : ''
    });

    notificationUrls.set(notificationId, url);
    return;
  }

  if (message.type === 'TEST_NOTIFICATION') {
    const now = Date.now();
    const notificationId = `nextdoor-test-${now}`;
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: NOTIFICATION_ICON,
      title: 'Keyword match (test)',
      message: message.message || 'Test notification',
      contextMessage: message.snippet || ''
    });
  }
});
