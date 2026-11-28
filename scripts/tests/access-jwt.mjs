// Test helper: a fake Cloudflare Access team (RSA key, JWKS endpoint, token minting).

export const TEAM = "sample-team.cloudflareaccess.com";
export const AUD = "a".repeat(64);

const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const enc = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

export async function makeAccess() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const other = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = {
    ...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
    kid: "kid-1",
    alg: "RS256",
  };
  const state = { fetches: 0, keys: [jwk] };
  const fetchFn = async (url) => {
    state.fetches++;
    if (url !== `https://${TEAM}/cdn-cgi/access/certs`) return new Response("no", { status: 404 });
    return Response.json({ keys: state.keys });
  };
  const now = () => Math.floor(Date.now() / 1000);
  async function token(claims = {}, { kid = "kid-1", alg = "RS256", key = pair.privateKey } = {}) {
    const header = enc({ alg, kid, typ: "JWT" });
    const payload = enc({
      iss: `https://${TEAM}`,
      aud: [AUD],
      email: "admin@example.com",
      iat: now(),
      nbf: now(),
      exp: now() + 600,
      ...claims,
    });
    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(`${header}.${payload}`),
    );
    return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
  }
  return { fetchFn, state, token, otherKey: other.privateKey };
}
