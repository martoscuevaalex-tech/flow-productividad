/** Redeem an email link in FLOW when email opens in a different browser. */
export function parseAccessLink(value: string, projectUrl: string) {
  const link = new URL(value.trim());
  const project = new URL(projectUrl);
  if (link.protocol !== 'https:' || link.origin !== project.origin || link.pathname !== '/auth/v1/verify' || link.username || link.password) {
    throw new Error('FLOW_INVALID_ACCESS_LINK');
  }
  const type = link.searchParams.get('type');
  const token = link.searchParams.get('token');
  if (!['email', 'magiclink', 'signup'].includes(type ?? '') || !token || token.length > 2048) {
    throw new Error('FLOW_INVALID_ACCESS_LINK');
  }
  return { token_hash: token, type: 'email' as const };
}
