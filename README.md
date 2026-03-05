# @utilsio SDKs

Official SDKs for integrating utilsio crypto subscriptions into your applications.

utilsio is a crypto-native subscription platform built on Superfluid money streams and USDT on Polygon. Users who already have a utilsio account are recognized automatically when they visit your app — no new accounts, no billing forms, just a single click to subscribe.

## Available SDKs

### `@utilsio/react`

The React SDK provides a context provider and hook for managing subscriptions in React and Next.js applications.

| Sub-package | Import | Description |
|---|---|---|
| Client | `@utilsio/react/client` | `UtilsioProvider`, `useUtilsio` hook |
| Server | `@utilsio/react/server` | `deriveAppHashHex`, `signRequest`, `nowUnixSeconds`, `buildSignatureMessage` |

**Location:** [`react/`](./react/)

**Install:**

```bash
bun add @utilsio/react
# or
npm install @utilsio/react
# or
pnpm add @utilsio/react
```

**Full documentation:** [`react/README.md`](./react/README.md)

---

## Repository Structure

```
packages/
├── react/              # @utilsio/react package
│   ├── client/         # Client-side: UtilsioProvider, useUtilsio
│   ├── server/         # Server-side: signing utilities
│   ├── package.json
│   └── README.md       # Detailed SDK documentation
└── README.md           # This file
```

## Development

This repository uses Bun workspaces.

```bash
# Install all dependencies
bun install

# Build all SDKs
bun run build

# Build react SDK only
cd react && bun run build

# Build server and client sub-packages
cd react
bun run build:server   # Compiles server/
bun run build:client   # Compiles client/

# Clean build artifacts
bun run clean
```

### Local Development with the Template

To test SDK changes against the Next.js template:

```bash
# From packages/react — packs, copies, and installs into the template
bun run update-template
```

This command:
1. Builds the SDK
2. Packs it as a `.tgz`
3. Copies it to `templates/nextjs/`
4. Reinstalls dependencies in the template

### Publishing

```bash
# From packages/react
bun run prepublishOnly   # Builds before publish
npm publish              # Publishes to npm
```

The GitHub Actions workflow in `.github/workflows/publishReact.yml` handles automated publishing on push to main.

## Contributing

Contributions are welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for guidelines.

Each SDK maintains:
- Source code (`client/src/`, `server/src/`)
- Build configuration (`tsconfig.build.json` per sub-package)
- Package metadata (`package.json`)
- Documentation (`README.md`)

## License

Apache-2.0

## Links

- **Documentation:** [utilsio.dev/docs](https://utilsio.dev/docs)
- **Templates:** [github.com/utilsio/templates](https://github.com/utilsio/templates)
- **npm:** [@utilsio/react](https://www.npmjs.com/package/@utilsio/react)
- **Creator Dashboard:** [utilsio.dev/creator/apps](https://utilsio.dev/creator/apps)
