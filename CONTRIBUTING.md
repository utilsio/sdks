# Contributing to utilsio SDKs

This guide explains how to develop, test, and release SDKs in the `packages/` directory.

## Table of Contents

- [Project Structure](#project-structure)
- [Development](#development)
- [Release Workflow](#release-workflow)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

---

## Project Structure

```
packages/
├── release-sdk.sh              # Unified release script (handles version bumping + git tagging)
├── RELEASE_GUIDE.md            # Detailed release documentation
├── CONTRIBUTING.md             # This file
├── .github/
│   └── workflows/
│       └── publishReact.yml    # GitHub Actions workflow for npm publish
└── react/
    ├── version.sh              # React SDK version bump script (called by release-sdk.sh)
    ├── package.json
    ├── src/
    └── dist/
```

Each SDK directory is **self-contained**:
- Version management: SDK-specific `version.sh` script (called by release-sdk.sh)
- Building: SDK-specific build commands in `package.json`
- Publishing: Handled by language-specific GitHub Actions workflow

---

## Development

### Setting Up React SDK

```bash
cd packages/react
bun install
bun run build
```

### Running Tests

```bash
cd packages/react
bun run test
```

### Making Changes

1. Make your changes in the SDK directory
2. Test locally to ensure everything works
3. Commit your changes to the `packages` submodule
4. Push to the `packages` remote

---

## Release Workflow

The release process is **unified into a single command**:

```bash
cd packages
./release-sdk.sh <sdk-name> <version-type>
```

This single command:
1. ✅ Bumps the SDK version (calls `version.sh` internally)
2. ✅ Creates a git commit with version change
3. ✅ Creates an annotated git tag with SDK-specific prefix
4. ✅ Pushes both commit and tag to remote
5. ✅ GitHub Actions workflow auto-publishes

### One-Command Release

```bash
# From packages/ directory
./release-sdk.sh react patch              # 0.1.3 → 0.1.4, tag, and push
./release-sdk.sh react minor              # 0.1.3 → 0.2.0, tag, and push
./release-sdk.sh react major              # 0.1.3 → 1.0.0, tag, and push
```

**What it does:**
- Validates SDK directory and version.sh script exist
- Calls `./react/version.sh patch` (or minor/major)
- Version script updates `package.json` and creates commit
- Reads new version from `package.json`
- Creates git tag: `react-v0.1.4`
- Pushes tag to remote

**Full Output:**
```
========================================
SDK Release: react
========================================

[1/5] Validating SDK...
✓ SDK found

[2/5] Running version bump script...
========================================
React SDK Version Bump (patch)
========================================

[1/4] Checking git status...
✓ Working directory clean

[2/4] Reading current version...
✓ Current version: 0.1.3

[3/4] Calculating new version...
✓ Version bump: 0.1.3 → 0.1.4

[4/4] Updating package.json and creating commit...
✓ Updated package.json to 0.1.4
✓ Created commit

========================================
✓ Version bump complete!
========================================

Old Version: 0.1.3
New Version: 0.1.4

[3/5] Checking git status...
✓ Working directory clean

[4/5] Creating git tag...
✓ Created tag: react-v0.1.4

[5/5] Pushing to remote...
✓ Pushed tag to origin

========================================
✓ Release complete!
========================================

SDK:           react
Version:       0.1.4
Tag:           react-v0.1.4

Next steps:
1. Update main repo submodule reference:
   cd $(git rev-parse --show-toplevel)
   git add packages
   git commit -m "chore: update packages to react SDK v0.1.4"
   git push origin main

2. GitHub Actions workflow will automatically trigger on the tag
   and publish to the appropriate registry
```

### GitHub Actions Workflow (Automatic)

When the `react-v*` tag is pushed:

1. GitHub detects the tag push
2. Triggers `publishReact.yml` workflow
3. Workflow:
   - Checks out the code at that tag
   - Installs dependencies: `cd react && bun install`
   - Builds the SDK: `bun run build`
   - Publishes to npm with OIDC provenance: `npm publish --provenance --access public`
   - Creates a GitHub release with details

**Workflow file:** `.github/workflows/publishReact.yml`

---

## Complete Release Example

```bash
# 1. From packages directory, run one command to bump version + tag + push
cd packages
./release-sdk.sh react patch

# This automatically:
# - Calls react/version.sh patch (bumps 0.1.3 → 0.1.4)
# - Creates git commit: "chore(react): bump version to 0.1.4"
# - Creates git tag: react-v0.1.4
# - Pushes commit and tag to remote

# 2. Update main repository with submodule reference
cd $(git rev-parse --show-toplevel)
git add packages
git commit -m "chore: update packages to react SDK v0.1.4"
git push origin main

# 3. GitHub Actions automatically publishes to npm
#    (workflow triggered by react-v0.1.4 tag push)
```

---

## Common Tasks

### View Current Version

```bash
cd packages/react
grep '"version"' package.json
```

### View Release History

```bash
cd packages
git tag -l | grep react    # Show all react SDK tags
git log --oneline -10      # Show recent commits
```

### Rollback a Broken Release

If you released a version that has bugs:

1. **Do NOT delete the tag** - GitHub Actions may have already published
2. Instead, release a new patch version with the fix
3. Document the issue in the GitHub release

```bash
cd packages/react
./install.sh patch         # 0.1.4 → 0.1.5
cd ..
git push origin main
./release-sdk.sh react
```

### Pre-Release Testing (Dry Run)

To test publishing without actually pushing to npm:

```bash
cd packages/react
npm publish --dry-run --access public
```

This shows exactly what would be published without actually doing it.

---

## Future SDKs (Python, Go, Rust, etc.)

The architecture is designed to support multiple SDKs with the same release command:

```
packages/
├── release-sdk.sh             # Same script works for ALL SDKs
├── react/
│   ├── version.sh             # React version bumping
│   └── package.json
├── python/
│   ├── version.sh             # Python version bumping (handles pyproject.toml)
│   └── pyproject.toml
├── go/
│   ├── version.sh             # Go version bumping (handles go.mod)
│   └── go.mod
└── .github/workflows/
    ├── publishReact.yml       # npm publish
    ├── publishPython.yml      # PyPI publish
    └── publishGo.yml          # pkg.go.dev publish
```

For a new SDK:

1. Create `packages/<sdk-name>/` directory
2. Create `packages/<sdk-name>/version.sh` script that:
   - Takes version type as argument (patch/minor/major or custom)
   - Updates the language-specific version file (pyproject.toml, go.mod, etc.)
   - Creates a git commit
3. Create `.github/workflows/publish<SdkName>.yml` for publishing to the language-specific registry
4. Use the same command to release:
   ```bash
   ./release-sdk.sh python patch    # Works identically!
   ./release-sdk.sh go minor        # Language-agnostic command
   ```

---

## Architecture: Why This Design?

The release process is **deliberately unified** into a single script:

### ✓ Benefits

- **Single command:** `./release-sdk.sh react patch` does everything
- **Language-agnostic:** Works for Python, Go, Rust, Java, etc.
- **Version control:** Each SDK controls its own `version.sh` script
- **No package manager bugs:** Avoids issues with `npm version`, `python setup.py`, etc.
- **Consistent workflow:** Same command for all SDKs regardless of language
- **Works everywhere:** Uses only git + bash, no external dependencies

### How It Works

```
./release-sdk.sh react patch
    ↓
./react/version.sh patch     ← SDK-specific version bumping
    ↓ (creates commit)
git tag react-v0.1.4         ← Language-agnostic git operations
    ↓ (pushes tag)
GitHub Actions               ← Auto-publish (language-specific workflow)
```

Each layer is **independent and language-agnostic**:
- **release-sdk.sh:** Only uses git commands (works everywhere)
- **version.sh:** SDK-specific (npm, pip, cargo, etc.)
- **GitHub Actions:** Language-specific workflows (publishReact.yml, publishPython.yml, etc.)

---

## Troubleshooting

### Error: "Working directory is not clean"

**Problem:** You have uncommitted changes

**Solution:**
```bash
git status
git add .
git commit -m "your message"
```

Then try the script again.

### Error: "tag already exists"

**Problem:** The tag `react-v0.1.4` already exists

**Solution:** You likely already ran `release-sdk.sh`. The tag should be in the remote.

Verify:
```bash
cd packages
git tag -l | grep react-v0.1.4
git ls-remote origin react-v0.1.4
```

### Error: "package.json not found"

**Problem:** Running script from wrong directory

**Solution:** 
- For `install.sh`: Run from `packages/react/`
- For `release-sdk.sh`: Run from `packages/`

### GitHub Actions Workflow Failed

**Problem:** The `publishReact.yml` workflow failed

**Check logs:**
1. Go to GitHub repository: https://github.com/utilsio/sdks
2. Click "Actions" tab
3. Find the failed workflow run
4. Click the workflow name to see detailed logs

**Common issues:**
- `npm install` failed: Check `react/package.json` dependencies
- `bun run build` failed: Check build script in `react/package.json`
- npm publish failed: Check npm auth token configuration in GitHub secrets

### Version Numbers Not Updating

**Problem:** You ran `install.sh` but `package.json` didn't change

**Solution:** Check you're in the right directory:
```bash
pwd  # Should be: /path/to/packages/react
```

---

## Publishing to npm

### Prerequisites

1. npm account with access to `@utilsio` organization
2. GitHub organization secrets configured:
   - `NPM_TOKEN` (for authentication)
   - Or OIDC provider configured for `npm` registry

### Current Setup

The `publishReact.yml` workflow:
- Uses OIDC token for authentication (no stored credentials)
- Publishes with `--provenance` flag (signed provenance)
- Published to: https://www.npmjs.com/package/@utilsio/react
- Visibility: Public

### Manual Publish (Not Recommended)

If the workflow fails and you need to publish manually:

```bash
cd packages/react
npm login              # Enter credentials
npm publish --access public
```

---

## Additional Resources

- [Semantic Versioning](https://semver.org/)
- [npm Publishing Best Practices](https://docs.npmjs.com/packages-and-modules)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [RELEASE_GUIDE.md](./RELEASE_GUIDE.md) - Detailed version management information
