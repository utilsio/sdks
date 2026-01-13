# SDK Release & Commit Workflow Guide

## Overview

This guide explains the complete workflow for:
1. Making changes in `packages/react/`
2. Releasing and tagging with proper version numbers
3. Committing in the main repository

## Prerequisites

- You're in the `packages/` directory or `utilsio/` root
- All local changes are committed
- You have push access to both `sdks.git` and `main.git` repositories

---

## 🚀 Complete Workflow: From Code Changes to Release

### **Phase 1: Make Code Changes in React SDK**

```bash
# Navigate to packages/react
cd /Users/53gf4u1t/Development/utilsio_versions/utilsio/packages/react

# Make your code changes
# Edit files as needed...

# Build to verify everything works
bun run build

# Go back to packages root to commit
cd ..
```

### **Phase 2: Stage and Test Changes (Optional)**

```bash
# View what changed
git status

# Stage changes
git add react/

# (Optional) Create a regular commit before release
git commit -m "feat: add new feature to React SDK"

# Push to remote to test in CI
git push origin main
```

### **Phase 3: Release with Version Bump and Tag**

```bash
# Use the automated release script
./release-sdk.sh react patch

# This will:
# ✓ Check git status is clean
# ✓ Bump version in react/package.json (0.1.3 → 0.1.4)
# ✓ Create git commit in packages repo
# ✓ Create tag react-v0.1.4 (configured in .npmrc)
# ✓ Push commits to origin/main
# ✓ Push tag to origin (triggers publishReact.yml workflow)
```

**Version bump options:**
```bash
./release-sdk.sh react patch  # 0.1.3 → 0.1.4
./release-sdk.sh react minor  # 0.1.3 → 0.2.0
./release-sdk.sh react major  # 0.1.3 → 1.0.0
```

### **Phase 4: Update Main Repository Submodule Reference**

```bash
# Go to main repo root
cd /Users/53gf4u1t/Development/utilsio_versions/utilsio

# Git automatically detects the updated submodule reference
git status
# Output: modified:   packages (new commits)

# Stage the submodule reference update
git add packages

# Commit
git commit -m "chore: update packages to React SDK v0.1.4"

# Push to main
git push origin main
```

### **Phase 5: Automated npm Publishing**

When you push the `react-v0.1.4` tag, GitHub Actions automatically:
1. ✅ Triggers `publishReact.yml` workflow
2. ✅ Checks out the code at that tag
3. ✅ Builds React SDK
4. ✅ Publishes to npm registry
5. ✅ Creates GitHub release with installation instructions

**No manual npm publish needed!**

---

## 📋 Quick Reference: Common Scenarios

### **Scenario 1: Only React SDK Changes (Most Common)**

```bash
# 1. Make changes in packages/react
cd packages/react
# Edit files...
cd ..

# 2. Release with version bump
./release-sdk.sh react patch

# 3. Update main repo
cd ..
git add packages
git commit -m "chore: update packages to React SDK v0.1.4"
git push origin main

# Done! npm publish happens automatically via publishReact.yml
```

### **Scenario 2: Only Main Repo Changes (No SDK Release)**

```bash
# 1. Make changes in root
cd /Users/53gf4u1t/Development/utilsio_versions/utilsio
# Edit src/, docs/, etc.

# 2. Stage and commit (DON'T include packages/ unless they changed)
git add src/ docs/ README.md
git commit -m "fix: critical bug in wallet page"

# 3. Push
git push origin main

# Done! No submodule or npm publish involved
```

### **Scenario 3: Changes in Multiple Places**

```bash
# 1. Make SDK changes and release
cd packages/react
# Edit files...
cd ..
./release-sdk.sh react patch

# 2. Make main repo changes
cd ..
git add src/ docs/
git commit -m "feat: integrate new SDK features"

# 3. Update submodule reference
git add packages
git commit -m "chore: update packages to React SDK v0.1.4"

# 4. Push everything
git push origin main

# Done!
```

---

## 🔧 Understanding the Configuration

### **tag-version-prefix in react/.npmrc**

```ini
tag-version-prefix=react-v
```

This tells npm to create tags like `react-v0.1.4` instead of `v0.1.4`.

When you run `npm version patch` in `react/`:
- ✅ Package version: 0.1.3 → 0.1.4
- ✅ Git tag created: `react-v0.1.4`
- ✅ Git commit created in packages repo (with `tag-version-prefix` properly configured)

### **publishReact.yml Workflow**

Triggers on: `push` with tags matching `react-v*`

Steps:
1. Checks out the tagged commit
2. Installs dependencies
3. Builds React SDK
4. Publishes to npm registry (@utilsio/react)
5. Creates GitHub release

**Hardcoded values:**
- Package directory: `react/`
- npm scope: `@utilsio`
- Registry: npmjs.org (via .npmrc)
- Access level: public

---

## ⚠️ Important Notes

### **Why Use release-sdk.sh?**

Running `npm version` directly in `packages/react/` can freeze because:
- It tries to commit in a git subdirectory
- The tag-version-prefix configuration may not be applied correctly

The script:
- ✅ Runs `npm version` with proper configuration
- ✅ Handles all git operations from the correct directory
- ✅ Validates preconditions (clean working directory, package.json exists)
- ✅ Provides clear feedback and next steps

### **Submodule References**

The main repo stores **references** (commit hashes) to specific commits in each submodule:

```bash
# View submodule references in main repo
cat .gitmodules

# See current references
git status  # Shows "modified: packages" if submodule updated

# Always push submodule BEFORE updating reference in main repo
```

### **npm Tag Prefix Per SDK**

When other SDKs are added later:
- Python SDK: `tag-version-prefix=python-v` in `packages/python/.npmrc` (uses PyPI)
- Go SDK: `tag-version-prefix=go-v` in `packages/go/.npmrc` (uses pkg.go.dev)

Each SDK has independent versioning and tagging!

---

## 🐛 Troubleshooting

### **Issue: "Working directory is not clean"**

```bash
# Solution: Commit or stash changes
git status
git add .
git commit -m "message"
```

### **Issue: "package.json not found"**

```bash
# Make sure you're calling the script correctly
cd /Users/53gf4u1t/Development/utilsio_versions/utilsio/packages
./release-sdk.sh react patch
```

### **Issue: Tag created with wrong prefix (v0.1.4 instead of react-v0.1.4)**

```bash
# The .npmrc tag-version-prefix wasn't configured
# Fix it:
echo "tag-version-prefix=react-v" >> react/.npmrc

# Delete wrong tags
cd packages && git tag -d v0.1.4
git push origin --delete v0.1.4

# Try again with release-sdk.sh
./release-sdk.sh react patch
```

### **Issue: "npm version" is freezing**

```bash
# Don't run npm version directly in subdirectories
# Always use the release-sdk.sh script instead
./release-sdk.sh react patch
```

---

## 📚 File Locations

- **Release script:** `/packages/release-sdk.sh`
- **npm configuration:** `/packages/react/.npmrc`
- **Publish workflow:** `/packages/.github/workflows/publishReact.yml`
- **React package:** `/packages/react/`
- **Main repo root:** `/`

---

## 🎯 Summary: The Three-Step Process

### **For SDK Release:**
1. Make changes in `packages/react/`
2. Run `./release-sdk.sh react patch` (handles everything: commit, tag, push)
3. Update main repo: `git add packages && git commit && git push`

### **For Main Repo Changes:**
1. Make changes in `src/`, `docs/`, etc.
2. Commit normally: `git add . && git commit && git push`

### **For Both:**
1. Release SDK first (steps above)
2. Then update main repo with submodule reference
3. Everything propagates automatically!

**That's it! 🚀**
