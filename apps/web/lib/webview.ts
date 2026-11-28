// SPDX-License-Identifier: MIT

/** Instagram's iOS shell is a WKWebView. Mobile Safari does not include this token. */
export function isInstagramWebView(userAgent: string): boolean {
  return /Instagram/i.test(userAgent);
}
