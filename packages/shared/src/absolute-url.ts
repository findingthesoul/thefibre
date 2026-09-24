// Turning a path into something a person can paste elsewhere.
//
// Every "copy this link" button in the family holds the same little problem:
// what it has is a path ("/sjoerd-luteijn/intro-call"), and what the reader
// needs is a URL. Meet had written this twice by hand (CopyLinkButton and
// OpenBookingLink, in the same file) before the share menu would have made it
// three — so it is one function now.
//
// The origin is passed in rather than read from `window`, which keeps this
// module importable from a server component and testable without a DOM.

/**
 * @param url    an absolute URL, or a path with or without its leading slash
 * @param origin the page's own origin, e.g. `window.location.origin`
 */
export function absoluteUrl(url: string, origin: string): string {
  // Anything already carrying a scheme is left exactly as it is: a public
  // page may well live on a different host than the app rendering the button
  // (Meet's booking pages against the Thread's app domain, for one).
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  const base = origin.replace(/\/+$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}
