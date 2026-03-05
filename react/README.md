# @utilsio/react

Official React SDK for integrating utilsio crypto subscriptions into your application. Enables seamless subscription management powered by Superfluid money streams and USDT on Polygon — without requiring users to create new accounts or enter payment details.

## Overview

utilsio is a crypto-native subscription system that lets SaaS applications monetize their products using blockchain payments. When a user who already has a utilsio account visits your app, they are automatically recognized and can subscribe with a single click.

This SDK provides:
- **`@utilsio/react/client`** — React components and hooks for client-side subscription management
- **`@utilsio/react/server`** — Cryptographic signing functions for your backend

## Installation

```bash
bun add @utilsio/react
# or
npm install @utilsio/react
# or
pnpm add @utilsio/react
# or
yarn add @utilsio/react
```

**Requirements:** React 18+ and Next.js 13+ (App Router). The client package uses React context; the server package is framework-agnostic.

---

## Quick Start

### 1. Get Your Credentials

Visit [utilsio.dev/creator/apps](https://utilsio.dev/creator/apps) to create an app and retrieve:

| Variable | Visibility | Description |
|---|---|---|
| `NEXT_PUBLIC_UTILSIO_APP_ID` | Public (client-safe) | Your app's unique UUID |
| `UTILSIO_APP_SECRET` | **Secret (server only)** | Used to sign requests via HMAC |
| `UTILSIO_APP_SALT` | **Secret (server only)** | Salt for scrypt key derivation |
| `NEXT_PUBLIC_UTILSIO_APP_URL` | Public (client-safe) | utilsio base URL (`https://utilsio.dev`) |
| `NEXT_PUBLIC_APP_URL` | Public (client-safe) | Your app's public URL |

Create `.env.local`:

```env
# Public — safe to expose to the browser
NEXT_PUBLIC_UTILSIO_APP_ID=your_app_id_uuid_here
NEXT_PUBLIC_UTILSIO_APP_URL=https://utilsio.dev
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Secret — NEVER expose these to the client
UTILSIO_APP_SECRET=your_app_secret_here
UTILSIO_APP_SALT=your_app_salt_here
```

### 2. Create a Server Action for Signing

The server action generates HMAC-SHA256 signatures so your app secret never reaches the browser.

Create `src/app/actions.ts`:

```typescript
"use server";

import { deriveAppHashHex, signRequest } from "@utilsio/react/server";

// Derive the HMAC key once at module load — this is CPU-intensive (scrypt)
const appHashHex = deriveAppHashHex({
  appSecret: process.env.UTILSIO_APP_SECRET!,
  salt: process.env.UTILSIO_APP_SALT!,
});

export async function getAuthHeadersAction(input: {
  deviceId: string;
  additionalData?: string;
}) {
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = signRequest({
    appHashHex,
    deviceId: input.deviceId,
    appId: process.env.NEXT_PUBLIC_UTILSIO_APP_ID!,
    timestamp,
    additionalData: input.additionalData,
  });

  return { signature, timestamp: String(timestamp) };
}
```

### 3. Create the Safari Callback Endpoint

Safari and privacy-focused browsers block third-party cookies in iframes, preventing the SDK from reading `deviceId`. This server-to-server endpoint allows utilsio.dev to request signatures from your server.

Create `src/app/api/signature-callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { deriveAppHashHex, signRequest } from "@utilsio/react/server";

const TIMESTAMP_VALIDITY_WINDOW_SECONDS = 60;

// Derive once at module load time
const appHashHex = deriveAppHashHex({
  appSecret: process.env.UTILSIO_APP_SECRET!,
  salt: process.env.UTILSIO_APP_SALT!,
});

export async function POST(req: NextRequest) {
  try {
    // Verify request origin
    const origin = req.headers.get("X-utilsio-Origin");
    if (origin !== "utilsio.dev") {
      return NextResponse.json({ error: "Unauthorized origin" }, { status: 403 });
    }

    // Require HTTPS in production
    const isProduction = process.env.NODE_ENV === "production";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    if (isProduction && protocol !== "https") {
      return NextResponse.json({ error: "HTTPS required" }, { status: 403 });
    }

    const body = await req.json();
    const { deviceId, appId, additionalData, timestamp } = body as {
      deviceId: string;
      appId: string;
      additionalData: string;
      timestamp: number;
    };

    if (!deviceId || !appId || !additionalData || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: deviceId, appId, additionalData, timestamp" },
        { status: 400 }
      );
    }

    // Reject stale or future-dated requests
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > TIMESTAMP_VALIDITY_WINDOW_SECONDS) {
      return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
    }

    // Verify this request targets the correct app
    if (appId !== process.env.NEXT_PUBLIC_UTILSIO_APP_ID!) {
      return NextResponse.json({ error: "Invalid appId" }, { status: 403 });
    }

    const signature = signRequest({
      appHashHex,
      deviceId,
      appId,
      timestamp,
      additionalData,
    });

    return NextResponse.json({ signature, timestamp });
  } catch (error) {
    console.error("Signature callback error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate signature" },
      { status: 500 }
    );
  }
}
```

### 4. Wrap Your App with `UtilsioProvider`

Update `src/app/layout.tsx`:

```typescript
import { UtilsioProvider } from "@utilsio/react/client";
import { getAuthHeadersAction } from "./actions";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <UtilsioProvider
          utilsioBaseUrl={process.env.NEXT_PUBLIC_UTILSIO_APP_URL!}
          appId={process.env.NEXT_PUBLIC_UTILSIO_APP_ID!}
          getAuthHeadersAction={getAuthHeadersAction}
        >
          {children}
        </UtilsioProvider>
      </body>
    </html>
  );
}
```

### 5. Use the `useUtilsio` Hook in Your Components

Create `src/app/page.tsx`:

```typescript
"use client";

import { useUtilsio } from "@utilsio/react/client";
import { useCallback, useState } from "react";

function SubscriptionWidget() {
  const {
    user,
    currentSubscription,
    loading,
    error,
    redirectToConfirm,
    cancelSubscription,
  } = useUtilsio();

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleSubscribe = useCallback(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    redirectToConfirm({
      appId: process.env.NEXT_PUBLIC_UTILSIO_APP_ID!,
      appName: "My App",
      amountPerDay: "0.01", // 0.01 USD/day (~$0.30/month)
      appUrl,
      nextSuccess: `${appUrl}/success`,
      nextCancelled: `${appUrl}/cancelled`,
    });
  }, [redirectToConfirm]);

  const handleCancel = useCallback(async () => {
    if (!currentSubscription) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
      await cancelSubscription([currentSubscription.id], appUrl);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : String(err));
    } finally {
      setCancelling(false);
    }
  }, [currentSubscription, cancelSubscription]);

  // Don't block the UI while loading — show subscribe button regardless.
  // user may be null in Safari/Brave (third-party cookies blocked). That's expected.
  // The redirect flow handles authentication automatically.

  if (currentSubscription) {
    const daily = parseFloat(currentSubscription.amountPerDay);
    return (
      <div>
        <p>Active subscription: {currentSubscription.amountPerDay} USD/day (~${(daily * 30).toFixed(2)}/month)</p>
        <p>Started: {new Date(currentSubscription.createdAt).toLocaleDateString()}</p>
        <button onClick={handleCancel} disabled={cancelling}>
          {cancelling ? "Cancelling..." : "Cancel Subscription"}
        </button>
        {cancelError && <p style={{ color: "red" }}>{cancelError}</p>}
      </div>
    );
  }

  return (
    <div>
      {user && <p>Welcome, {user.email ?? "N/A"}</p>}
      <button onClick={handleSubscribe}>Subscribe (~$0.30/month)</button>
    </div>
  );
}

export default function HomePage() {
  return <SubscriptionWidget />;
}
```

### 6. Add Success and Cancelled Pages

Create `src/app/success/page.tsx`:
```typescript
export default function SuccessPage() {
  return <p>Subscription activated successfully!</p>;
}
```

Create `src/app/cancelled/page.tsx`:
```typescript
export default function CancelledPage() {
  return <p>Subscription cancelled.</p>;
}
```

---

## Client API Reference (`@utilsio/react/client`)

### `<UtilsioProvider>`

Root context provider that manages SDK state via a hidden authentication iframe. Must wrap any component that uses `useUtilsio()`.

**Props:**

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `appId` | `string` | Yes | — | Your utilsio app UUID from the creator dashboard |
| `getAuthHeadersAction` | `function` | Yes | — | Server action that returns `{ signature, timestamp }` |
| `children` | `ReactNode` | Yes | — | Your application components |
| `utilsioBaseUrl` | `string` | No | `"https://utilsio.dev"` | Base URL for utilsio API and embed |
| `parentOrigin` | `string` | No | `window.location.origin` | Your app's origin for secure iframe communication |

```typescript
<UtilsioProvider
  appId={process.env.NEXT_PUBLIC_UTILSIO_APP_ID!}
  utilsioBaseUrl={process.env.NEXT_PUBLIC_UTILSIO_APP_URL!}
  getAuthHeadersAction={getAuthHeadersAction}
>
  {children}
</UtilsioProvider>
```

---

### `useUtilsio()`

Hook that exposes SDK state and actions. Must be called inside a `<UtilsioProvider>` in a client component (`"use client"`).

**Returns:**

#### State

| Field | Type | Description |
|---|---|---|
| `user` | `UtilsioUser \| null` | Authenticated utilsio user. May be `null` in Safari/Brave — see note below. |
| `deviceId` | `string \| null` | Device identifier persisted in utilsio's first-party cookies. For reference only. |
| `currentSubscription` | `UtilsioSubscription \| null` | Active subscription for this user+device, or `null` if none. |
| `loading` | `boolean` | `true` while the SDK is initializing. |
| `error` | `string \| null` | Error message if initialization or an action failed. |

**`UtilsioUser` shape:**

```typescript
interface UtilsioUser {
  id: string;            // Unique user ID
  email?: string;        // User's email address (optional)
  phone?: string;        // User's phone number (optional)
  user_metadata: Record<string, unknown>;
  created_at: string;    // ISO timestamp
}
```

**`UtilsioSubscription` shape:**

```typescript
interface UtilsioSubscription {
  id: string;            // Unique subscription ID
  amountPerDay: string;  // USD/day as decimal string (billing is per-second)
  isActive: boolean;
  createdAt: string;     // ISO timestamp
  cancelledAt: string | null; // null while active
}
```

> **Safari & privacy browser note:** `user` may be `null` even when the user is logged into utilsio.dev, because Safari and some browsers block third-party cookies in iframes. This is expected — do not gate your UI on `user` being non-null. Show the subscribe button regardless; utilsio.dev handles authentication automatically during the redirect flow.

#### Actions

| Field | Type | Description |
|---|---|---|
| `refresh` | `() => Promise<void>` | Re-fetches user and subscription state from the server. |
| `redirectToConfirm` | `(params: RedirectParams) => void` | Initiates the subscribe flow by redirecting the user to utilsio.dev. |
| `cancelSubscription` | `(ids: string[], appUrl?: string) => Promise<void>` | Cancels one or more subscriptions. Pass `appUrl` for Safari support. |

**`RedirectParams`:**

```typescript
interface RedirectParams {
  appId: string;          // Your app ID (same as in UtilsioProvider)
  appName: string;        // Display name shown during subscription flow
  amountPerDay: string;   // Daily charge in USD (e.g. "0.033333" ≈ $1/month)
  appUrl?: string;        // Your app's URL — required for Safari support
  appLogo?: string;       // URL to your app logo (shown in flow UI)
  nextSuccess: string;    // Redirect URL after successful subscription
  nextCancelled: string;  // Redirect URL if user cancels the flow
}
```

**`cancelSubscription` details:**

```typescript
// Cancel a subscription (always pass appUrl for Safari support)
await cancelSubscription([currentSubscription.id], process.env.NEXT_PUBLIC_APP_URL);

// After cancellation:
// - currentSubscription becomes null
// - refresh() is called automatically
```

**`refresh` details:**

```typescript
// Manually re-fetch subscription state
// Useful after returning from an external flow or suspecting stale state
await refresh();
```

---

## Server API Reference (`@utilsio/react/server`)

### `deriveAppHashHex(params)`

Derives a deterministic HMAC key from your app credentials using scrypt (N=16384, r=8, p=1). This is a CPU-intensive, memory-hard operation that prevents brute-force attacks on your secret.

**Call this once at module load and reuse the result — never call it per-request.**

```typescript
import { deriveAppHashHex } from "@utilsio/react/server";

const appHashHex = deriveAppHashHex({
  appSecret: process.env.UTILSIO_APP_SECRET!, // Your app secret
  salt: process.env.UTILSIO_APP_SALT!,         // Your app salt
});
// Returns a 64-character hex string (256-bit key)
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `appSecret` | `string` | Your app secret from the creator dashboard |
| `salt` | `string` | Your app salt from the creator dashboard |

**Returns:** `string` — 64-character hex-encoded derived key.

---

### `signRequest(params)`

Creates an HMAC-SHA256 signature for a request. Proves to utilsio that the request is authorized by your application.

```typescript
import { signRequest } from "@utilsio/react/server";

const signature = signRequest({
  appHashHex,                                      // From deriveAppHashHex()
  deviceId: input.deviceId,                        // From useUtilsio().deviceId
  appId: process.env.NEXT_PUBLIC_UTILSIO_APP_ID!,
  timestamp: Math.floor(Date.now() / 1000),        // Unix seconds
  additionalData: input.additionalData,            // Optional: binds signature to operation
});
// Returns a 64-character hex string (HMAC-SHA256 digest)
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `appHashHex` | `string` | Derived key from `deriveAppHashHex()` |
| `deviceId` | `string` | User's device identifier |
| `appId` | `string` | Your public app ID |
| `timestamp` | `number \| string` | Unix timestamp in seconds |
| `additionalData` | `string?` | Optional context — pass `amountPerDay` for subscribe, sorted `userId,subscriptionIds` for cancel |

**Returns:** `string` — 64-character hex-encoded HMAC-SHA256 signature.

**`additionalData` context:**
- **Subscribe:** Pass the `amountPerDay` string (e.g. `"0.033333"`). Binds the signature to the exact amount, preventing tampering.
- **Cancel:** Pass a comma-separated, alphabetically-sorted string of `userId` and subscription IDs.
- **Basic requests:** Omit entirely.

---

### `nowUnixSeconds()`

Returns the current Unix timestamp in seconds. Utility function equivalent to `Math.floor(Date.now() / 1000)`.

```typescript
import { nowUnixSeconds } from "@utilsio/react/server";

const timestamp = nowUnixSeconds(); // e.g. 1705355234
```

---

### `buildSignatureMessage(params)`

Builds the message string that is signed with HMAC-SHA256. Useful for debugging signature mismatches.

```typescript
import { buildSignatureMessage } from "@utilsio/react/server";

const message = buildSignatureMessage({
  deviceId: "abc123",
  appId: "my-app-uuid",
  timestamp: 1234567890,
  additionalData: "0.033333",
});
// message = "abc123-my-app-uuid-1234567890-0.033333"
// Then: signature = HMAC-SHA256(message, appHashHex)
```

---

## Safari & Privacy Browser Compatibility

Safari and privacy-focused browsers (Brave, Firefox with strict settings) block third-party cookies in iframes. The SDK uses an iframe to read `deviceId` from utilsio's origin — this fails in those browsers.

### How the Fallback Works

The `/api/signature-callback` endpoint enables both flows to work in Safari:

**Subscribe flow (Safari):**
1. User clicks subscribe → SDK redirects to `utilsio.dev/subscription/init`
2. utilsio.dev reads `deviceId` from its own first-party cookies
3. utilsio.dev calls your `/api/signature-callback` (server-to-server)
4. Your server generates and returns the signature
5. utilsio.dev redirects user to the confirmation page

**Cancel flow (Safari):**
1. User clicks cancel → SDK sends DELETE request with `signatureCallbackUrl` but no `deviceId`
2. utilsio.dev reads `deviceId` from its own first-party cookies
3. utilsio.dev calls your `/api/signature-callback` (server-to-server)
4. Your server generates and returns the signature
5. utilsio.dev verifies the signature and cancels the subscription

### Implementation Requirements

Always pass `appUrl` to both `redirectToConfirm` and `cancelSubscription`:

```typescript
// Subscribe — appUrl enables Safari fallback
redirectToConfirm({
  appId,
  appName: "My App",
  amountPerDay: "0.033333",
  appUrl: process.env.NEXT_PUBLIC_APP_URL!, // Required for Safari
  nextSuccess: `${appUrl}/success`,
  nextCancelled: `${appUrl}/cancelled`,
});

// Cancel — appUrl enables Safari fallback
await cancelSubscription([subscriptionId], process.env.NEXT_PUBLIC_APP_URL!);
```

### Callback Endpoint Security

The `/api/signature-callback` endpoint should:
- Validate the `X-utilsio-Origin: utilsio.dev` header
- Require HTTPS in production
- Validate timestamp is within ±60 seconds
- Verify `appId` matches your configured app ID

---

## Environment Variables

```env
# ─── Public (safe to expose to browser) ──────────────────────────────────────
NEXT_PUBLIC_UTILSIO_APP_ID=your_app_id_uuid_here
NEXT_PUBLIC_UTILSIO_APP_URL=https://utilsio.dev
NEXT_PUBLIC_APP_URL=https://yourdomain.com   # or http://localhost:3001 for dev

# ─── Secret (backend only — NEVER expose) ────────────────────────────────────
UTILSIO_APP_SECRET=your_app_secret_here
UTILSIO_APP_SALT=your_app_salt_here
```

Variables prefixed with `NEXT_PUBLIC_` are bundled into the browser. `UTILSIO_APP_SECRET` and `UTILSIO_APP_SALT` must never use this prefix.

---

## Common Errors

| Error | Cause | Solution |
|---|---|---|
| `user` is always `null` | Safari/Brave blocking third-party cookies | Expected — don't gate UI on `user`. See [Safari section](#safari--privacy-browser-compatibility). |
| Signature verification fails | Mismatch in parameters | Ensure `additionalData`, `timestamp`, and `appId` match between client and server. |
| `"Failed to authenticate"` | Signing endpoint unreachable or threw an error | Check server action/route is deployed and env vars are set. |
| `"Invalid credentials"` | Wrong `appId` or mismatched signing key | Verify `NEXT_PUBLIC_UTILSIO_APP_ID`, `UTILSIO_APP_SECRET`, and `UTILSIO_APP_SALT`. |
| `"Either deviceId or appUrl is required"` | Safari cancel without `appUrl` | Always pass `appUrl` as second argument to `cancelSubscription()`. |
| Subscription stale after confirmation | State not refreshed | Call `refresh()` from `useUtilsio()` after returning from a redirect. |

---

## How Authentication Works

`UtilsioProvider` renders a hidden `<iframe>` pointing to `utilsio.dev`. Because the iframe runs in utilsio's first-party origin, it can read the user's session cookie and `deviceId`. These values are sent back to your page via `window.postMessage`. The SDK then calls `getAuthHeadersAction` (your server action) to generate an HMAC signature, and uses that to fetch the user's subscription state from the utilsio API.

### Normal flow (Chrome, Firefox)

```
Your Page (browser)            Your Server                utilsio.dev
       │                            │                          │
       ├─ render hidden iframe ──────────────────────────────>│
       │                            │           iframe reads deviceId from
       │                            │           first-party cookie, sends
       │<─ postMessage(deviceId) ───────────────────────────── │
       │                            │                          │
       ├─ getAuthHeadersAction ────>│                          │
       │   { deviceId }             ├─ deriveAppHashHex()      │
       │                            ├─ signRequest()           │
       │<─ { signature, timestamp } ┤                          │
       │                            │                          │
       ├─ fetch subscription (SDK, using deviceId) ──────────>│
       │<─ { user, currentSubscription } ────────────────────┤
```

### Safari / privacy browser fallback (third-party cookies blocked)

In Safari and browsers that block third-party cookies, the iframe cannot read `deviceId`. The SDK detects this and falls back to a server-side callback pattern:

**Subscribe fallback:**
```
Your Page (browser)          utilsio.dev                Your Server (/api/signature-callback)
       │                          │                               │
       ├─ redirectToConfirm() ───>│ (full-page redirect)          │
       │  includes ?appUrl=...    │                               │
       │                          ├─ reads deviceId (first-party) │
       │                          ├─ POST /api/signature-callback>│
       │                          │   { deviceId, appId,          │
       │                          │     additionalData,           │
       │                          │     timestamp }               │
       │                          │<─ { signature, timestamp } ───┤
       │                          │   validates & creates         │
       │<─ redirect to nextSuccess┤   subscription                │
```

**Cancel fallback:**
```
Your Page (browser)          utilsio.dev                Your Server (/api/signature-callback)
       │                          │                               │
       ├─ cancelSubscription() ──>│ DELETE (no deviceId,          │
       │  includes signatureCb    │  includes signatureCallbackUrl)│
       │  URL                     ├─ reads deviceId (first-party) │
       │                          ├─ POST /api/signature-callback>│
       │                          │   { deviceId, appId,          │
       │                          │     additionalData,           │
       │                          │     timestamp }               │
       │                          │<─ { signature, timestamp } ───┤
       │                          │   verifies & cancels          │
       │<─ subscription deleted ──┤   subscription                │
```

**Key points:**
- Your `UTILSIO_APP_SECRET` never leaves your server in either flow
- Pass `appUrl` to `redirectToConfirm()` and `cancelSubscription()` to enable the Safari fallback
- The `/api/signature-callback` endpoint must validate `X-utilsio-Origin`, timestamp, and `appId`

---

## License

Apache-2.0

## Links

- **Documentation:** [utilsio.dev/docs](https://utilsio.dev/docs)
- **Next.js Template:** [github.com/utilsio/templates](https://github.com/utilsio/templates)
- **npm:** [@utilsio/react](https://www.npmjs.com/package/@utilsio/react)
- **Issues:** [github.com/utilsio/sdks/issues](https://github.com/utilsio/sdks/issues)
- **Creator Dashboard:** [utilsio.dev/creator/apps](https://utilsio.dev/creator/apps)
