/**
 * RFC 4122 v4-ish UUID generator. Not cryptographically secure — this is
 * only used to mint Mapbox Search Box `session_token` values, which just
 * need to be unique per concurrent search session, not unguessable.
 */
export const generateSessionToken = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
