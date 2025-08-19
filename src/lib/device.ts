export function isMobileOrTablet(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  // Common mobile and tablet indicators
  const mobileTabletRegex = /mobile|iphone|ipod|android(?!.*tv)|blackberry|bb10|mini|windows phone|webos|tablet|ipad/;
  return mobileTabletRegex.test(ua);
}

