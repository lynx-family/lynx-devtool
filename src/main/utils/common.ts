// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function getTemplateUrlFromSchema(schema: string) {
  const result = schema.match(/https?[://|%3A%2F%2F][^&]+/);
  if (result && result.length > 0) {
    return decodeURIComponent(result[0]);
  }
  return null;
}

/*
 * @param {string} s
 * @param {string} p
 * @return {boolean}
 */
export function isStringMatch(s?: string, p?: string): boolean {
  if (!p) {
    return true;
  }
  if (!s) {
    return false;
  }
  // Construct dp function
  const dp = [] as any[];
  for (let i = 0; i <= s.length; i++) {
    const child: boolean[] = [];
    for (let j = 0; j <= p.length; j++) {
      child.push(false);
    }
    dp.push(child);
  }
  dp[s.length][p.length] = true;
  // Execute
  for (let i = p.length - 1; i >= 0; i--) {
    if (p[i] !== '*') {
      break;
    } else {
      dp[s.length][i] = true;
    }
  }

  for (let i = s.length - 1; i >= 0; i--) {
    for (let j = p.length - 1; j >= 0; j--) {
      if (s[i] === p[j] || p[j] === '?') {
        dp[i][j] = dp[i + 1][j + 1];
      } else if (p[j] === '*') {
        dp[i][j] = dp[i + 1][j] || dp[i][j + 1];
      } else {
        dp[i][j] = false;
      }
    }
  }
  return dp[0][0];
}
