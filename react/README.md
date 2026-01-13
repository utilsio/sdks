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

Create an API endpoint to sign requests. The signature proves to utilsio that requests come from your authorized app.

```typescript
// app/api/sign/route.ts
import { deriveAppHashHex, signRequest, nowUnixSeconds } from '@utilsio/react/server';

// Derive the HMAC key once at startup (this is an expensive operation)
const appHashHex = deriveAppHashHex({
  appSecret: process.env.UTILSIO_APP_SECRET!,
  salt: process.env.UTILSIO_APP_SALT!,
});

export async function POST(request: Request) {
  const { deviceId, additionalData } = await request.json();
  
  const timestamp = nowUnixSeconds();
  
  const signature = signRequest({
    appHashHex,
    deviceId,
    appId: process.env.NEXT_PUBLIC_UTILSIO_APP_ID!,
    timestamp,
    additionalData, // Optional: include if you need to verify additional context
  });
  
  return Response.json({ signature, timestamp });
}
```

### 3. Client-Side Setup

Wrap your app with `UtilsioProvider` to enable authentication and subscription management.

```typescript
// app/layout.tsx
import { UtilsioProvider } from '@utilsio/react/client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UtilsioProvider appId={process.env.NEXT_PUBLIC_UTILSIO_APP_ID!}>
          {children}
        </UtilsioProvider>
      </body>
    </html>
  );
}
```

### 4. Create Subscription Flow

Use the `useUtilsio` hook to access user information and create subscriptions.

```typescript
// app/page.tsx
'use client';
import { useUtilsio } from '@utilsio/react/client';
import { useState } from 'react';

export default function Page() {
  const { user, deviceId, currentSubscription, loading, error, redirectToConfirm } = useUtilsio();
  const [isSubscribing, setIsSubscribing] = useState(false);
  
  const handleSubscribe = async () => {
    if (!deviceId) return;
    
    setIsSubscribing(true);
    try {
      // Get signature from your server
      const response = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      
      const { signature, timestamp } = await response.json();
      
      // Redirect to utilsio confirmation page
      redirectToConfirm({
        amountPerMonth: 1, // 1 POL per month
        successUrl: `${window.location.origin}/success`,
        cancelUrl: `${window.location.origin}/cancelled`,
        signature,
        timestamp,
      });
    } catch (error) {
      console.error('Subscription error:', error);
      setIsSubscribing(false);
    }
  };
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      {user ? (
        <div>
          <p>Welcome, {user.email}</p>
          {currentSubscription ? (
            <p>Active subscription: {currentSubscription.amountPerMonth} POL/month</p>
          ) : (
            <button onClick={handleSubscribe} disabled={isSubscribing}>
              {isSubscribing ? 'Processing...' : 'Subscribe (1 POL/month)'}
            </button>
          )}
        </div>
      ) : (
        <p>Please log in to utilsio to subscribe</p>
      )}
    </div>
  );
}
```

### 5. Handle Callbacks

Create success and cancel pages for post-subscription redirects.

```typescript
// app/success/page.tsx
export default function SuccessPage() {
  return <div>Subscription successful! Thank you for subscribing.</div>;
}

// app/cancelled/page.tsx
export default function CancelledPage() {
  return <div>Subscription cancelled.</div>;
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

## API Reference

### Server API (`@utilsio/react/server`)

#### `deriveAppHashHex(params: DeriveKeyParams): string`

Derives the HMAC key from your app credentials using scrypt (N=16384, r=8, p=1).

**Parameters:**
- `appSecret: string` - Your app secret from the creator dashboard
- `salt: string` - Your app salt from the creator dashboard

**Returns:** `string` - Hex-encoded derived key for signing

**Important:** This is a CPU-intensive operation. Call it **once** at application startup and reuse the result.

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
- `deviceId: string` - User's device ID from `useUtilsio()`
- `appId: string` - Your public app ID
- `timestamp: number` - Unix timestamp in seconds
- `additionalData?: string` - Optional additional context to include in signature

**Returns:** `string` - Hex-encoded HMAC signature

```typescript
const signature = signRequest({
  appHashHex,
  deviceId,
  appId: process.env.NEXT_PUBLIC_UTILSIO_APP_ID!,
  timestamp: nowUnixSeconds(),
});
```

#### `nowUnixSeconds(): number`

Returns the current Unix timestamp in seconds.

**Returns:** `number` - Current timestamp

```typescript
const timestamp = nowUnixSeconds();
```

### Client API (`@utilsio/react/client`)

#### `<UtilsioProvider>`

React context provider that manages authentication via a hidden iframe.

**Props:**
- `appId: string` - Your public app ID
- `children: ReactNode` - Your app components

**How it works:**
1. Renders a hidden iframe pointing to `https://utilsio.dev/embed`
2. The iframe checks for utilsio authentication cookies
3. Posts user data and device ID to parent window via `postMessage`
4. Provider makes this data available via `useUtilsio()` hook

```typescript
<UtilsioProvider appId={process.env.NEXT_PUBLIC_UTILSIO_APP_ID!}>
  {children}
</UtilsioProvider>
```

#### `useUtilsio()`

Hook that provides utilsio state and actions. Must be used within a `UtilsioProvider`.

**Returns:**
```typescript
{
  user: User | null;                    // Current logged-in user
  deviceId: string | null;              // User's device identifier
  currentSubscription: Subscription | null; // Active subscription if any
  loading: boolean;                     // True while loading user data
  error: string | null;                 // Error message if authentication failed
  refresh: () => Promise<void>;         // Manually refresh user data
  redirectToConfirm: (params: RedirectParams) => void; // Redirect to subscription confirmation
}
```

**Types:**
```typescript
interface User {
  id: string;
  email: string;
  // ... other user properties
}

interface Subscription {
  id: string;
  appId: string;
  amountPerMonth: number;
  status: 'active' | 'cancelled' | 'expired';
  // ... other subscription properties
}

interface RedirectParams {
  amountPerMonth: number;  // Subscription amount in POL
  successUrl: string;      // Redirect URL after successful subscription
  cancelUrl: string;       // Redirect URL if user cancels
  signature: string;       // HMAC signature from your server
  timestamp: number;       // Unix timestamp used in signature
  additionalData?: string; // Optional additional context
}
```

**Example:**
```typescript
const { user, deviceId, currentSubscription, redirectToConfirm } = useUtilsio();
```

## Architecture

### Authentication Flow

1. **Iframe Setup**: `UtilsioProvider` creates a hidden iframe to `utilsio.dev/embed`
2. **Cookie Check**: Iframe checks for utilsio authentication cookies (HttpOnly, Secure)
3. **PostMessage**: Iframe sends `{type: 'utilsio-auth', user, deviceId}` to parent
4. **State Update**: Provider receives message and updates React state
5. **Hook Access**: Components use `useUtilsio()` to access user data

### Subscription Flow

1. **User Action**: User clicks subscribe button in your app
2. **Sign Request**: App calls your `/api/sign` endpoint with `deviceId`
3. **Server Signs**: Your server derives key and creates HMAC signature
4. **Return Signature**: Server returns `{signature, timestamp}` to client
5. **Redirect**: Client calls `redirectToConfirm()` with subscription params
6. **User Confirms**: User is redirected to `utilsio.dev/confirm` to approve
7. **Stream Creation**: Utilsio creates Superfluid payment stream on Polygon
8. **Callback**: User is redirected to your `successUrl` or `cancelUrl`

### Security Model

- **App Secret & Salt**: Never exposed to client, only used server-side
- **Device ID**: Unique browser identifier, tied to user session
- **HMAC Signature**: Proves request authenticity without exposing secrets
- **Timestamp**: Prevents replay attacks (utilsio validates recency)
- **Superfluid Streams**: Non-custodial, user maintains full control of funds

## Example Use Cases

### Content Subscription Platform
```typescript
// Gate premium content behind subscription
if (!currentSubscription) {
  return <SubscribePrompt />;
}
return <PremiumContent />;
```

### SaaS Tool Access
```typescript
// Enable features based on subscription tier
const tier = currentSubscription?.amountPerMonth || 0;
if (tier >= 10) {
  return <ProFeatures />;
}
return <BasicFeatures />;
```

### API Rate Limits
```typescript
// Server-side: Verify subscription before processing API request
if (!userHasActiveSubscription) {
  return Response.json({ error: 'Subscription required' }, { status: 402 });
}
```

## Troubleshooting

### User is null even when logged in

**Cause:** Hidden iframe is blocked or cookies are not set.

**Solution:**
- Ensure your app is served over HTTPS (required for cross-origin cookies)
- Check browser console for iframe errors
- Verify `appId` is correct in `UtilsioProvider`

### Signature verification fails

**Cause:** Mismatch between client timestamp/deviceId and server signature.

**Solution:**
- Ensure you're using the exact same `deviceId` from `useUtilsio()`
- Use `nowUnixSeconds()` for timestamp generation
- Verify `appSecret` and `salt` are correct in environment variables

### Subscription not showing after confirmation

**Cause:** Superfluid stream creation is pending or failed.

**Solution:**
- Call `refresh()` from `useUtilsio()` to manually update subscription state
- Check network requests for subscription data
- Verify user has sufficient POL balance for stream creation

## License

Apache-2.0

## Links

- **Documentation**: [utilsio.dev/docs](https://utilsio.dev/docs)
- **Template**: [github.com/53gf4u1t/utilsio-templates](https://github.com/53gf4u1t/utilsio-templates)
- **SDK Repository**: [github.com/53gf4u1t/utilsio-sdks](https://github.com/53gf4u1t/utilsio-sdks)
- **npm Package**: [@utilsio/react](https://www.npmjs.com/package/@utilsio/react)
- **Issues**: [github.com/53gf4u1t/utilsio-sdks/issues](https://github.com/53gf4u1t/utilsio-sdks/issues)
