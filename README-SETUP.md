# Execution Engine — Phone Setup

## Step 1: Install PWA on Home Screen
1. Open Safari on iPhone: `http://10.193.178.114:8080`
2. Tap Share button (rectangle with arrow)
3. Tap "Add to Home Screen"
4. Name it "Engine" → Add
5. It now opens as a full-screen app

## Step 2: Widget (Scriptable)
1. Install **Scriptable** from App Store (free)
2. Open Scriptable → tap "+" to create new script
3. AirDrop or paste the contents of `Execution Engine Widget.js`
4. Rename script to "Execution Engine"
5. Go to home screen → long press → tap "+" (top left)
6. Search "Scriptable" → choose Small or Medium widget
7. Long press the widget → Edit Widget
8. Set "Script" to "Execution Engine"
9. Done — widget shows your Big Task, progress, and weekly %

## Widget Sizes
- **Small**: Shows Big Task name + today's progress + weekly %
- **Medium**: Shows Big Task + medium tasks + energy + recovery status

## Tapping the Widget
Tapping opens the full PWA in your browser.

## Notes
- Widget refreshes every ~15 minutes (iOS limitation)
- Phone must be on same WiFi as Mac for widget to update
- If you change WiFi networks, update SERVER_IP in the script
- Server runs automatically on boot via launchd

## Troubleshooting
- Widget shows "Engine offline"? → Check Mac is awake + same WiFi
- PWA not syncing? → Refresh the page once
- Want to reset? → Sync tab → Reset All Data
