# @utilsio/react

Official React SDK for integrating utilsio crypto subscriptions into your application.

## Installation

```bash
bun add @utilsio/react
```

## Quick Start

### 1. Get Your Credentials

Visit the [utilsio creator dashboard](https://utilsio.dev/creator/apps) to create an app and get:
- **App ID** - Public identifier for your app
- **App Secret** - Secret key for signing (keep secure!)
- **App Salt** - Salt for key derivation (keep secure!)

### 2. Server-Side Setup

Create server actions to sign requests. The signature proves to utilsio that requests come from your authorized app.

```typescript
// app/actions.ts
'use server';

import { deriveAppHashHex, signRequest } from '@utilsio/react/server';

// Derive the HMAC key once at module load (expensive operation)
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

  return { signature: signature, timestamp: String(timestamp) };
}
```

### 3. Safari Compatibility Endpoint

Create a callback endpoint for Safari users (third-party cookies are blocked in iframes):

```typescript
// app/api/signature-callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { deriveAppHashHex, signRequest } from "@utilsio/react/server";

const appHashHex = deriveAppHashHex({
  appSecret: process.env.UTILSIO_APP_SECRET!,
  salt: process.env.UTILSIO_APP_SALT!,
});

export async function POST(req: NextRequest) {
  // Verify request origin
  const origin = req.headers.get("X-utilsio-Origin");
  if (origin !== "utilsio.dev") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { deviceId, appId, additionalData, timestamp } = await req.json();

  const signature = signRequest({
    appHashHex,
    deviceId,
    appId,
    timestamp,
    additionalData,
  });

  return NextResponse.json({ signature, timestamp });
}
```

### 4. Client-Side Setup

Wrap your app with `UtilsioProvider` to enable authentication and subscription management.

```typescript
// app/layout.tsx
import { UtilsioProvider } from '@utilsio/react/client';
import { getAuthHeadersAction } from './actions';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UtilsioProvider
          appId={process.env.NEXT_PUBLIC_UTILSIO_APP_ID!}
          utilsioBaseUrl="https://utilsio.dev"
          getAuthHeadersAction={getAuthHeadersAction}
        >
          {children}
        </UtilsioProvider>
      </body>
    </html>
  );
}
```

### 5. Subscribe and Cancel Flows

Use the `useUtilsio` hook to manage subscriptions.

```typescript
// app/page.tsx
'use client';

import { useUtilsio } from '@utilsio/react/client';
import { useCallback, useState } from 'react';

export default function Page() {
  const { user, currentSubscription, loading, redirectToConfirm, cancelSubscription } = useUtilsio();
  const [cancelling, setCancelling] = useState(false);

  const handleSubscribe = useCallback(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    redirectToConfirm({
      appId: process.env.NEXT_PUBLIC_UTILSIO_APP_ID!,
      appName: "My App",
      amountPerDay: "1", // 1 POL per day
      appUrl,
      nextSuccess: `${appUrl}/success`,
      nextCancelled: `${appUrl}/cancelled`,
    });
  }, [redirectToConfirm]);

  const handleCancel = useCallback(async () => {
    if (!currentSubscription) return;

    setCancelling(true);
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
      await cancelSubscription([currentSubscription.id], appUrl);
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setCancelling(false);
    }
  }, [currentSubscription, cancelSubscription]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {currentSubscription ? (
        <div>
          <p>Active: {currentSubscription.amountPerDay} POL/day</p>
          <button onClick={handleCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
          </button>
        </div>
      ) : (
        <button onClick={handleSubscribe}>
          Subscribe (1 POL/day)
        </button>
      )}
    </div>
  );
}
```

## Environment Variables

Create a `.env.local` file with your credentials:

```env
# Server-side only (NEVER expose these!)
UTILSIO_APP_SECRET=your_app_secret_here
UTILSIO_APP_SALT=your_app_salt_here

# Public (can be exposed to client)
NEXT_PUBLIC_UTILSIO_APP_ID=your_app_id_uuid_here
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Safari Compatibility

Safari blocks third-party cookies in iframes, preventing the SDK from reading `deviceId`. The solution uses server-side signature generation:

### Subscribe Flow
1. User clicks subscribe → SDK redirects to `utilsio.dev/subscription/init`
2. utilsio.dev reads `deviceId` from first-party cookies
3. Calls your `/api/signature-callback` endpoint
4. Your server generates signature
5. Redirects to confirmation page

### Cancel Flow
1. User clicks cancel → SDK makes DELETE request without deviceId/signature
2. utilsio.dev reads `deviceId` from first-party cookies
3. Calls your `/api/signature-callback` endpoint
4. Your server generates signature
5. utilsio.dev deletes subscription

**Key Points:**
- Always pass `appUrl` to `redirectToConfirm()` and `cancelSubscription()`
- The `/api/signature-callback` endpoint handles both flows
- No additional configuration needed - works automatically

## API Reference

### Server API (`@utilsio/react/server`)

#### `deriveAppHashHex(params: DeriveKeyParams): string`

Derives the HMAC key from your app credentials using scrypt (N=16384, r=8, p=1).

**Parameters:**
- `appSecret: string` - Your app secret from the creator dashboard
- `salt: string` - Your app salt from the creator dashboard

**Returns:** `string` - Hex-encoded derived key for signing

**Important:** This is a CPU-intensive operation. Call it **once** at module load and reuse the result.

```typescript
const appHashHex = deriveAppHashHex({
  appSecret: process.env.UTILSIO_APP_SECRET!,
  salt: process.env.UTILSIO_APP_SALT!,
});
```

#### `signRequest(params: SignRequestParams): string`

Signs an API request with HMAC-SHA256.

**Parameters:**
- `appHashHex: string` - Derived key from `deriveAppHashHex()`
- `deviceId: string` - User's device ID
- `appId: string` - Your public app ID
- `timestamp: number` - Unix timestamp in milliseconds
- `additionalData?: string` - Optional additional context (e.g., amountPerDay or subscriptionIds)

**Returns:** `string` - Hex-encoded HMAC signature

```typescript
const signature = signRequest({
  appHashHex,
  deviceId,
  appId: process.env.NEXT_PUBLIC_UTILSIO_APP_ID!,
  timestamp: Math.floor(Date.now() / 1000),
  additionalData: "1", // amountPerDay for subscribe
});
```

### Client API (`@utilsio/react/client`)

#### `<UtilsioProvider>`

React context provider that manages authentication via a hidden iframe.

**Props:**
- `appId: string` - Your public app ID
- `utilsioBaseUrl: string` - Base URL for utilsio (usually "https://utilsio.dev")
- `getAuthHeadersAction: function` - Server action that generates signatures
- `children: ReactNode` - Your app components

```typescript
<UtilsioProvider
  appId={process.env.NEXT_PUBLIC_UTILSIO_APP_ID!}
  utilsioBaseUrl="https://utilsio.dev"
  getAuthHeadersAction={getAuthHeadersAction}
>
  {children}
</UtilsioProvider>
```

#### `useUtilsio()`

Hook that provides utilsio state and actions. Must be used within a `UtilsioProvider`.

**Returns:**
```typescript
{
  user: User | null;
  deviceId: string | null;
  currentSubscription: Subscription | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  redirectToConfirm: (params: RedirectParams) => void;
  cancelSubscription: (subscriptionIds: string[], appUrl?: string) => Promise<void>;
}
```

**Types:**
```typescript
interface RedirectParams {
  appId: string;
  appName: string;
  amountPerDay: string; // POL per day as string
  appUrl?: string;      // Required for Safari support
  appLogo?: string;
  nextSuccess: string;
  nextCancelled: string;
}
```

## Troubleshooting

### Safari: deviceId is null

**Cause:** Safari blocks third-party cookies in iframes.

**Solution:** Pass `appUrl` to `redirectToConfirm()` and `cancelSubscription()`. The SDK will automatically use the server-side callback flow.

### Signature verification fails

**Cause:** Mismatch in signature generation.

**Solution:**
- Ensure `additionalData` matches on both client and server
- Use the same `timestamp` value
- Verify `appSecret` and `salt` are correct

### Subscription not showing after confirmation

**Solution:** Call `refresh()` from `useUtilsio()` to manually update subscription state.

## License

Apache-2.0

## Links

- **Documentation**: [utilsio.dev/docs](https://utilsio.dev/docs)
- **Template**: [github.com/utilsio/templates](https://github.com/utilsio/templates)
- **Issues**: [github.com/utilsio/sdks/issues](https://github.com/utilsio/sdks/issues)
