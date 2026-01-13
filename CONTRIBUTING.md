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
├── release-sdk.sh              # Git-only release script (language-agnostic)
├── RELEASE_GUIDE.md            # Detailed release documentation
├── CONTRIBUTING.md             # This file
├── .github/
│   └── workflows/
│       └── publishReact.yml    # GitHub Actions workflow for npm publish
└── react/
    ├── install.sh              # React SDK version bump script
    ├── package.json
    ├── src/
    └── dist/
```

Each SDK directory is **self-contained**:
- Version management: SDK-specific `install.sh` script
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

The release process has **two distinct steps** - each with its own script:

### Step 1: Bump Version (Language-Specific)

Run the SDK's version bump script:

```bash
cd packages/react
./install.sh patch|minor|major
```

**What it does:**
- Reads current version from `package.json`
- Calculates new semantic version (patch/minor/major)
- Updates `package.json` and `package-lock.json`
- Creates a git commit automatically

**Examples:**
```bash
./install.sh patch    # 0.1.3 → 0.1.4 (bug fixes)
./install.sh minor    # 0.1.3 → 0.2.0 (new features)
./install.sh major    # 0.1.3 → 1.0.0 (breaking changes)
```

**Output:**
```
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

Next steps:
1. Push the version commit:
   cd ..
   git push origin main

2. Create and push the release tag:
   ./release-sdk.sh react
```

### Step 2: Create Git Tag (Language-Agnostic)

From the `packages/` directory, run the release script:

```bash
./release-sdk.sh react
```

**What it does:**
- Reads version from `react/package.json`
- Creates an **annotated git tag** with SDK-specific prefix: `react-v0.1.4`
- Pushes the tag to remote

**Output:**
```
========================================
SDK Git Release: react
========================================

[1/4] Checking git status...
✓ Working directory clean

[2/4] Reading version...
✓ Version: 0.1.4
✓ Tag: react-v0.1.4

[3/4] Creating git tag...
✓ Created tag: react-v0.1.4

[4/4] Pushing to remote...
✓ Pushed tag to origin

========================================
✓ Release complete!
========================================

SDK:           react
Version:       0.1.4
Tag:           react-v0.1.4
```

### Step 3: GitHub Actions Workflow (Automatic)

When the `react-v*` tag is pushed:

1. GitHub detects the tag push
2. Triggers `publishReact.yml` workflow
3. Workflow:
   - Checks out the code at that tag
   - Installs dependencies: `cd react && bun install`
   - Builds the SDK: `bun run build`
   - Publishes to npm with OIDC provenance
   - Creates a GitHub release with details

**Workflow file:** `.github/workflows/publishReact.yml`

---

## Complete Release Example

```bash
# 1. Bump version
cd packages/react
./install.sh patch
# Creates commit: "chore(react): bump version to 0.1.4"

# 2. Push version commit
cd ..
git push origin main

# 3. Create and push tag
./release-sdk.sh react
# Creates tag: react-v0.1.4
# Pushes to remote
# GitHub Actions automatically publishes to npm

# 4. Verify in main repository
cd /Users/53gf4u1t/Development/utilsio_versions/utilsio
git add packages
git commit -m "chore: update packages to react SDK v0.1.4"
git push origin main
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

The architecture is designed to support multiple SDKs:

```
packages/
├── release-sdk.sh           # Works for ALL SDKs (git operations only)
├── react/
│   ├── install.sh           # React-specific version bumping
│   └── package.json
├── python/
│   ├── install.sh           # Python-specific version bumping
│   └── pyproject.toml
├── go/
│   ├── install.sh           # Go-specific version bumping
│   └── go.mod
└── .github/workflows/
    ├── publishReact.yml     # npm publish
    ├── publishPython.yml    # PyPI publish
    └── publishGo.yml        # pkg.go.dev publish
```

For a new SDK:

1. Create `packages/<sdk-name>/` directory
2. Create `packages/<sdk-name>/install.sh` for version bumping
3. Create `.github/workflows/publish<SdkName>.yml` for publishing
4. Use `./release-sdk.sh <sdk-name>` to release

---

## Architecture: Why Split Version & Git?

The release process is deliberately split into two scripts:

### ✓ Benefits

- **Language-agnostic:** `release-sdk.sh` works for Python, Go, Rust, Java, etc.
- **Version control:** Only the specific SDK controls its version file
- **No package manager bugs:** Avoids issues with `npm version`, `python setup.py`, etc.
- **Clear responsibility:** Version bumping vs. git operations are separate
- **Works everywhere:** No dependency on npm, pip, cargo, etc. in release-sdk.sh

### ✗ Why Not Combined?

- `npm version` hangs with bun (npm compatibility issue)
- Different package managers have different version formats
- Python uses `pyproject.toml` or `setup.py`, Go uses `go.mod`, etc.
- Git operations should work the same way across all languages

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
