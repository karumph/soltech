import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  GetUserCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ChangePasswordCommand,
  GlobalSignOutCommand,
  DeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { runScan, lookupCoins, networkOf } from "./scan.mjs";
import { checkWallet } from "./wallet.mjs";

const table = process.env.SCANS_TABLE || "soltech-scans";
const accountsTable = process.env.ACCOUNTS_TABLE || "soltech-accounts";
const watchTable = process.env.WATCH_TABLE || "soltech-watchlists";
const WATCH_LIMIT = 50;
const clientId = process.env.CLIENT_ID;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const cognito = new CognitoIdentityProviderClient({});
const allowedHosts = new Set(["api.dexscreener.com", "api.geckoterminal.com", "api.rugcheck.xyz", "api.gopluslabs.io"]);
const ITEM_LIMIT = 360_000;
const SCAN_STALE_MS = 3 * 60 * 1000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "Soltech/1.0" }, signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Solana RPC for contract checks. The public endpoint covers authorities; set SOLANA_RPC_URL (e.g. Helius) for holders.
const rpcUrl = process.env.SOLANA_RPC_URL || "";
async function postJson(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${new URL(url).host}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const readLatest = () => db.send(new GetCommand({ TableName: table, Key: { id: "latest" } })).then((got) => got.Item || null);

async function refresh() {
  const previous = await readLatest().catch(() => null);
  const item = await runScan({ fetchJson, postJson, rpcUrl: rpcUrl || undefined, previous });
  // A failed scan keeps the last good feed instead of replacing it with nothing.
  if (!item.coins.length && previous?.coins?.length) return previous;
  while (JSON.stringify(item).length > ITEM_LIMIT && item.coins.length) item.coins.pop();
  await db.send(new PutCommand({ TableName: table, Item: item }));
  // A tiny companion item lets pollers check for a new scan without reading the whole feed.
  await db.send(new PutCommand({ TableName: table, Item: { id: "meta", updatedAt: item.updatedAt, run: item.run } }));
  return item;
}

const readMeta = () => db.send(new GetCommand({ TableName: table, Key: { id: "meta" } })).then((got) => got.Item || null);

async function latest() {
  const item = await readLatest();
  if (item?.coins?.length && Date.now() - Date.parse(item.updatedAt) < SCAN_STALE_MS) return item;
  // The schedule normally keeps this fresh; this only runs if it stopped or the table is empty.
  return refresh().catch(() => item);
}

function response(status, body, type = "application/json", extra = {}) {
  // Do not add Access-Control-Allow-Origin here. The function URL CORS config is the only CORS source.
  return {
    statusCode: status,
    headers: { "content-type": type, "cache-control": "no-store", ...extra },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

async function proxy(rawUrl) {
  let target;
  try { target = new URL(rawUrl); } catch { return response(400, { error: "bad url" }); }
  if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) return response(403, { error: "host not allowed" });
  const upstream = await fetch(target, { headers: { accept: "application/json", "user-agent": "Soltech/1.0" }, redirect: "follow" });
  const text = await upstream.text();
  return response(upstream.status, text.slice(0, 3_000_000), upstream.headers.get("content-type") || "application/json");
}

function readBody(event) {
  if (!event?.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try { return JSON.parse(raw); } catch { return {}; }
}

class Friendly extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

function authError(error) {
  const name = error?.name || "";
  if (error instanceof Friendly) return [error.status, error.message, error.code];
  if (name === "UsernameExistsException") return [409, "An account with that email already exists. Sign in instead.", "exists"];
  if (name === "InvalidPasswordException") return [400, "Use at least 8 characters, with an uppercase letter, a lowercase letter and a number.", "password"];
  if (name === "InvalidParameterException") return [400, "Check the email and password, then try again.", "invalid"];
  if (name === "CodeMismatchException") return [400, "That code doesn't match. Check the latest email and try again.", "code"];
  if (name === "ExpiredCodeException") return [400, "That code has expired. Send a new one.", "expired"];
  if (name === "LimitExceededException" || name === "TooManyRequestsException" || name === "TooManyFailedAttemptsException") return [429, "Too many attempts. Wait a few minutes, then try again.", "limit"];
  if (name === "UserNotConfirmedException") return [403, "Confirm your email first. Enter the code we sent, or send a new one.", "unconfirmed"];
  if (name === "NotAuthorizedException" && /Refresh Token/i.test(error.message || "")) return [401, "Your session ended. Sign in again.", "session"];
  if (name === "NotAuthorizedException" && /Access Token/i.test(error.message || "")) return [401, "Your session ended. Sign in again.", "session"];
  if (name === "NotAuthorizedException" || name === "UserNotFoundException") return [401, "Email or password is wrong.", "credentials"];
  if (name === "CodeDeliveryFailureException") return [502, "We couldn't send the email. Check the address and try again.", "delivery"];
  console.error("account error", name, error?.message);
  return [400, "Account request failed. Try again.", "unknown"];
}

const emailOf = (body) => String(body.email || "").trim().toLowerCase();
const tokenOf = (event) => String(event.headers?.authorization || event.headers?.Authorization || "").replace(/^Bearer\s+/i, "");
const requireEmail = (email) => { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Friendly(400, "Enter a valid email address.", "email"); };

async function currentUser(event) {
  const token = tokenOf(event);
  if (!token) throw new Friendly(401, "Sign in required.", "session");
  const user = await cognito.send(new GetUserCommand({ AccessToken: token }));
  const attr = (name) => user.UserAttributes?.find((item) => item.Name === name)?.Value || "";
  return { sub: attr("sub"), email: attr("email"), token };
}

const session = (auth, email) => ({ accessToken: auth.AccessToken, refreshToken: auth.RefreshToken, expiresIn: auth.ExpiresIn, email });

const routes = {
  "POST /auth/signup": async (event) => {
    const body = readBody(event), email = emailOf(body), password = String(body.password || "");
    requireEmail(email);
    if (password.length < 8) throw new Friendly(400, "Use at least 8 characters, with an uppercase letter, a lowercase letter and a number.", "password");
    await cognito.send(new SignUpCommand({ ClientId: clientId, Username: email, Password: password, UserAttributes: [{ Name: "email", Value: email }] }));
    return { status: "confirm" };
  },
  "POST /auth/confirm": async (event) => {
    const body = readBody(event), email = emailOf(body);
    requireEmail(email);
    await cognito.send(new ConfirmSignUpCommand({ ClientId: clientId, Username: email, ConfirmationCode: String(body.code || "").trim() }));
    return { status: "confirmed" };
  },
  "POST /auth/resend": async (event) => {
    const email = emailOf(readBody(event));
    requireEmail(email);
    await cognito.send(new ResendConfirmationCodeCommand({ ClientId: clientId, Username: email }));
    return { status: "sent" };
  },
  "POST /auth/login": async (event) => {
    const body = readBody(event), email = emailOf(body);
    requireEmail(email);
    const result = await cognito.send(new InitiateAuthCommand({ AuthFlow: "USER_PASSWORD_AUTH", ClientId: clientId, AuthParameters: { USERNAME: email, PASSWORD: String(body.password || "") } }));
    if (!result.AuthenticationResult) throw new Friendly(400, "This sign-in needs an extra step that Soltech doesn't support yet.", "challenge");
    return session(result.AuthenticationResult, email);
  },
  "POST /auth/refresh": async (event) => {
    const body = readBody(event);
    const result = await cognito.send(new InitiateAuthCommand({ AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: clientId, AuthParameters: { REFRESH_TOKEN: String(body.refreshToken || "") } }));
    const auth = result.AuthenticationResult;
    return { accessToken: auth.AccessToken, expiresIn: auth.ExpiresIn, refreshToken: auth.RefreshToken || undefined };
  },
  "POST /auth/forgot": async (event) => {
    const email = emailOf(readBody(event));
    requireEmail(email);
    // Same answer whether or not the account exists, so this can't be used to discover accounts.
    await cognito.send(new ForgotPasswordCommand({ ClientId: clientId, Username: email })).catch((error) => {
      if (error?.name !== "UserNotFoundException") throw error;
    });
    return { status: "sent" };
  },
  "POST /auth/reset": async (event) => {
    const body = readBody(event), email = emailOf(body);
    requireEmail(email);
    await cognito.send(new ConfirmForgotPasswordCommand({ ClientId: clientId, Username: email, ConfirmationCode: String(body.code || "").trim(), Password: String(body.password || "") }));
    return { status: "reset" };
  },
  "POST /auth/password": async (event) => {
    const body = readBody(event);
    const user = await currentUser(event);
    await cognito.send(new ChangePasswordCommand({ AccessToken: user.token, PreviousPassword: String(body.currentPassword || ""), ProposedPassword: String(body.newPassword || "") })).catch((error) => {
      if (error?.name === "NotAuthorizedException") throw new Friendly(400, "Your current password is wrong.", "credentials");
      throw error;
    });
    return { status: "changed" };
  },
  "POST /auth/logout": async (event) => {
    // Signs out every device. A token that already expired is fine: the caller is signing out anyway.
    await cognito.send(new GlobalSignOutCommand({ AccessToken: tokenOf(event) })).catch(() => {});
    return { status: "signed-out" };
  },
  "GET /auth/me": async (event) => {
    const user = await currentUser(event);
    return { email: user.email };
  },
  "GET /account": async (event) => {
    const user = await currentUser(event);
    const got = await db.send(new GetCommand({ TableName: accountsTable, Key: { userId: user.sub } }));
    return { email: user.email, profile: got.Item?.profile || null, scanner: got.Item?.scanner || null, workspace: got.Item?.workspace || null, signals: got.Item?.signals || null, updatedAt: got.Item?.updatedAt || null };
  },
  "PUT /account": async (event) => {
    const user = await currentUser(event);
    const body = readBody(event);
    if (JSON.stringify(body).length > 350000) throw new Friendly(413, "That account is too large to save. Use a smaller photo.", "size");
    const updatedAt = new Date().toISOString();
    await db.send(new PutCommand({ TableName: accountsTable, Item: { userId: user.sub, email: user.email, profile: body.profile || null, scanner: body.scanner || null, workspace: body.workspace || null, signals: body.signals || null, updatedAt } }));
    return { ok: true, updatedAt };
  },
  "POST /account/delete": async (event) => {
    const user = await currentUser(event);
    await db.send(new DeleteCommand({ TableName: accountsTable, Key: { userId: user.sub } }));
    await db.send(new DeleteCommand({ TableName: watchTable, Key: { userId: user.sub } }));
    await cognito.send(new DeleteUserCommand({ AccessToken: user.token }));
    return { status: "deleted" };
  },
  // Scan a coin, and pricing for the Watching list. Public, so guests can use it too; capped per request.
  "POST /lookup": async (event) => {
    const body = readBody(event);
    const coins = (Array.isArray(body.coins) ? body.coins : []).slice(0, 30);
    if (!coins.length) throw new Friendly(400, "Paste a Solana or Base token address.", "address");
    return { coins: await lookupCoins({ fetchJson, postJson, rpcUrl: rpcUrl || undefined, coins }) };
  },
  // Wallet check: read-only, from the address alone.
  "POST /wallet": async (event) => {
    const address = String(readBody(event).address || "").trim();
    if (!networkOf(address)) throw new Friendly(400, "Paste a Solana wallet address.", "address");
    const result = await checkWallet({ fetchJson, postJson, rpcUrl: rpcUrl || undefined, address });
    if (!result.supported) throw new Friendly(400, "Wallet checks cover Solana for now. Base wallets are coming.", "chain");
    return result;
  },
  "GET /watchlist": async (event) => {
    const user = await currentUser(event);
    const got = await db.send(new GetCommand({ TableName: watchTable, Key: { userId: user.sub } }));
    return { coins: got.Item?.coins || [], updatedAt: got.Item?.updatedAt || null };
  },
  "PUT /watchlist": async (event) => {
    const user = await currentUser(event);
    const body = readBody(event);
    const seen = new Set();
    const coins = [];
    for (const item of Array.isArray(body.coins) ? body.coins : []) {
      const address = String(item?.address || "").trim();
      const chain = networkOf(address);
      if (!chain || (item.chain && item.chain !== chain)) continue;
      const id = `${chain}:${chain === "base" ? address.toLowerCase() : address}`;
      if (seen.has(id)) continue;
      seen.add(id);
      coins.push({ id, chain, address, name: String(item.name || "").slice(0, 60), symbol: String(item.symbol || "").slice(0, 24), addedAt: String(item.addedAt || new Date().toISOString()).slice(0, 30) });
      if (coins.length >= WATCH_LIMIT) break;
    }
    const updatedAt = new Date().toISOString();
    await db.send(new PutCommand({ TableName: watchTable, Item: { userId: user.sub, coins, updatedAt } }));
    return { coins, updatedAt };
  },
};

export const handler = async (event) => {
  if (event?.source === "aws.events" || event?.["detail-type"]) {
    const item = await refresh();
    return { ok: true, count: item.coins.length, newCount: item.run?.newCount ?? 0 };
  }
  const path = (event?.rawPath || "/").replace(/\/+$/, "") || "/";
  const method = event?.requestContext?.http?.method || "GET";
  const params = event?.queryStringParameters || {};
  if (method === "OPTIONS") return response(204, "");
  try {
    if (path === "/bundlers") return response(200, { status: "not-connected" });
    if (path === "/finds") {
      if (params.since) {
        const meta = await readMeta().catch(() => null);
        if (meta && meta.updatedAt === params.since && Date.now() - Date.parse(meta.updatedAt) < SCAN_STALE_MS) {
          return response(200, { unchanged: true, updatedAt: meta.updatedAt, run: meta.run });
        }
      }
      const item = await latest();
      if (!item) return response(503, { error: "The scan has not run yet." });
      // Pollers send the last updatedAt they have; an unchanged scan answers in a few bytes.
      if (params.since && params.since === item.updatedAt) return response(200, { unchanged: true, updatedAt: item.updatedAt, run: item.run });
      return response(200, item);
    }
    if (path === "/proxy") return proxy(params.u || "");
    const route = routes[`${method} ${path}`];
    if (route) return response(200, await route(event));
  } catch (error) {
    if ((path === "/wallet" || path === "/lookup") && !(error instanceof Friendly)) {
      console.error("lookup failed", path, error?.message);
      return response(502, { error: path === "/wallet" ? "That wallet couldn't be read right now. Try again in a minute." : "That coin couldn't be looked up right now. Try again in a minute.", code: "upstream" });
    }
    if (path.startsWith("/auth") || path.startsWith("/account") || path.startsWith("/watchlist") || path === "/lookup" || path === "/wallet") {
      const [status, message, code] = authError(error);
      return response(status, { error: message, code });
    }
    console.error("request failed", path, error);
    return response(500, { error: "The scan service failed." });
  }
  return response(404, { error: "not found" });
};
