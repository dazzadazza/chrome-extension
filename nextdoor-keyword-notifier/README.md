# Nextdoor Keyword Notifier

A local-only Chrome MV3 extension that monitors the Nextdoor UK news feed and raises notifications when posts match your configured keywords or regular expressions.

## Installation

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `nextdoor-keyword-notifier` folder.
5. Open the extension's **Options** page to enter your keywords (one per line or wrapped in `/` for regex).
6. Visit `http://localhost/mock/mock-nextdoor.html` for testing, or browse the real Nextdoor UK news feed while logged in.

## Usage

- Keywords are case-insensitive. Each line in the options textarea is treated as one keyword. Wrap a keyword in `/` to treat it as a regular expression.
- The content script continuously watches the feed for new posts and de-duplicates notifications to avoid spam.
- Enable the optional debug overlay in Options to see which posts matched.
- Use the **Test Notification** button to confirm notifications are working.

## Privacy

All processing occurs locally within the browser. No data ever leaves your device.
