# @utilsio SDKs

Official SDKs for integrating Utilsio crypto subscriptions into your applications.

## Available SDKs

### React SDK

The React SDK provides components and hooks for seamless Utilsio integration.

- **Location:** `react/`
- **Package:** `@utilsio/react`
- **Documentation:** See `react/README.md`

Installation:
```bash
pnpm add @utilsio/react
# npm install @utilsio/react
# bun add @utilsio/react
```

### Vue SDK (Coming Soon)

Located in `vue/` (in development)

## Development

This repository uses a workspace structure to manage multiple SDK implementations:

```bash
# Install dependencies for all SDKs
pnpm install

# Build all SDKs
pnpm run build

# Build specific SDK
pnpm --filter @utilsio/react run build
```

## Contributing

Each SDK maintains its own:
- Source code (`client/`, `server/`)
- Build configuration
- Package metadata (`package.json`)
- Documentation (`README.md`)

## License

Apache-2.0
