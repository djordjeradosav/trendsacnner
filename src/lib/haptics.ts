/**
 * Lightweight haptic feedback utility using the Vibration API.
 * Falls back silently on unsupported devices.
 */
export function hapticTap() {
  if ("vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

export function hapticHeavy() {
  if ("vibrate" in navigator) {
    navigator.vibrate(20);
  }
}
