export function credentials(site) {
  const prefix = `WP_${site.id.toUpperCase().replace(/-/g,'_')}`;
  const username = process.env[`${prefix}_USERNAME`], password = process.env[`${prefix}_APP_PASSWORD`];
  if (!username || !password) throw new Error(`Configure ${prefix}_USERNAME and ${prefix}_APP_PASSWORD in .env.`);
  return {username,password};
}
export class WPError extends Error { constructor(message, unknown = false) { super(message); this.unknown = unknown; } }
export function createWP(fetcher = fetch) {
  return async (site, endpoint, options = {}) => {
    const {username,password} = credentials(site);
    const url = new URL(`${site.url.replace(/\/$/,'')}/wp-json/wp/v2/${endpoint}`);
    if (url.protocol !== 'https:') throw new Error('WordPress requires HTTPS.');
    const write = !!options.method && options.method !== 'GET';
    let response;
    try {
      response = await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,...options.headers}});
    } catch { throw new WPError(write ? 'Connection failed during write; remote outcome is unknown. Inspect WordPress before retrying.' : 'Connection failed or timed out. Check HTTPS, REST access and host restrictions.',write); }
    let body;
    try { body = await response.json(); } catch { throw new WPError(`HTTP ${response.status}: WordPress returned a non-JSON response.`,write); }
    if (!response.ok) {
      // Never retain raw error bodies: plugins may echo request headers or secrets.
      const code = /^[a-zA-Z0-9_-]{1,100}$/.test(body?.code) ? body.code : 'unexpected_response';
      const hint = response.status === 401 ? 'Authentication failed.' : response.status === 403 ? 'Permission denied.' : 'WordPress rejected the request.';
      throw new WPError(`HTTP ${response.status} (${code}): ${hint}`,write && response.status >= 500);
    }
    return body;
  };
}
export const wp = createWP();
export const jsonRequest = body => ({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
