document.addEventListener('DOMContentLoaded', () => {
  const keywordsField = document.getElementById('keywords');
  const debugOverlayField = document.getElementById('debugOverlay');
  const form = document.getElementById('options-form');
  const testButton = document.getElementById('test');

  const status = document.createElement('p');
  status.className = 'status-message';
  form.appendChild(status);

  const loadOptions = () => {
    chrome.storage.sync.get(['keywords', 'debugOverlay'], (result) => {
      const keywords = Array.isArray(result.keywords) ? result.keywords : [];
      keywordsField.value = keywords.join('\n');
      debugOverlayField.checked = Boolean(result.debugOverlay);
    });
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const keywords = keywordsField.value
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    chrome.storage.sync.set(
      {
        keywords,
        debugOverlay: debugOverlayField.checked
      },
      () => {
        status.textContent = 'Options saved.';
        setTimeout(() => {
          status.textContent = '';
        }, 2000);
      }
    );
  });

  testButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: 'TEST_NOTIFICATION',
      message: 'Test keyword match',
      snippet: 'This is a test notification triggered from the options page.'
    });
    status.textContent = 'Test notification sent.';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });

  loadOptions();
});
