#!/bin/bash

# Release script for SDK packages
# Usage: ./release-sdk.sh <sdk-name> <version-type>
# Example: ./release-sdk.sh react patch
#          ./release-sdk.sh react minor
#          ./release-sdk.sh react major

set -e  # Exit on any error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -ne 2 ]; then
    echo -e "${RED}Error: Invalid arguments${NC}"
    echo "Usage: ./release-sdk.sh <sdk-name> <version-type>"
    echo "  sdk-name: react (python, go, etc. in the future)"
    echo "  version-type: patch, minor, major"
    echo ""
    echo "Examples:"
    echo "  ./release-sdk.sh react patch    # Bump 0.1.3 → 0.1.4"
    echo "  ./release-sdk.sh react minor    # Bump 0.1.3 → 0.2.0"
    echo "  ./release-sdk.sh react major    # Bump 0.1.3 → 1.0.0"
    exit 1
fi

SDK_NAME=$1
VERSION_TYPE=$2

# Validate SDK exists
if [ ! -d "./$SDK_NAME" ]; then
    echo -e "${RED}Error: SDK '$SDK_NAME' not found at ./$SDK_NAME${NC}"
    exit 1
fi

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}Error: Invalid version type '$VERSION_TYPE'${NC}"
    echo "Must be: patch, minor, or major"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}SDK Release: $SDK_NAME ($VERSION_TYPE)${NC}"
echo -e "${BLUE}========================================${NC}"

# Step 1: Check git status
echo -e "\n${YELLOW}[1/5]${NC} Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: Working directory is not clean${NC}"
    echo "Please commit or stash all changes first"
    git status
    exit 1
fi
echo -e "${GREEN}✓ Working directory clean${NC}"

# Step 2: Navigate to SDK directory and check package.json
echo -e "\n${YELLOW}[2/5]${NC} Checking package.json..."
if [ ! -f "./$SDK_NAME/package.json" ]; then
    echo -e "${RED}Error: package.json not found in ./$SDK_NAME${NC}"
    exit 1
fi

CURRENT_VERSION=$(grep '"version"' "./$SDK_NAME/package.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
echo -e "${GREEN}✓ Current version: $CURRENT_VERSION${NC}"

# Step 3: Run npm version from SDK directory
echo -e "\n${YELLOW}[3/5]${NC} Bumping version ($VERSION_TYPE)..."
cd "./$SDK_NAME"

# This will:
# 1. Bump version in package.json
# 2. Create a git commit in the packages repo
# 3. Create a git tag with prefix react-v (configured in .npmrc)
npm version "$VERSION_TYPE" --git-tag-version

NEW_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
TAG_NAME="${SDK_NAME}-v${NEW_VERSION}"

echo -e "${GREEN}✓ Version bumped: $CURRENT_VERSION → $NEW_VERSION${NC}"
echo -e "${GREEN}✓ Tag created: $TAG_NAME${NC}"

# Step 4: Go back to packages root and push
echo -e "\n${YELLOW}[4/5]${NC} Pushing to remote..."
cd ..

git push origin main
echo -e "${GREEN}✓ Pushed commits to origin/main${NC}"

git push origin "$TAG_NAME"
echo -e "${GREEN}✓ Pushed tag $TAG_NAME to origin${NC}"

# Step 5: Summary
echo -e "\n${YELLOW}[5/5]${NC} Release complete!"
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Summary:${NC}"
echo -e "  SDK:          $SDK_NAME"
echo -e "  New Version:  $NEW_VERSION"
echo -e "  Tag:          $TAG_NAME"
echo -e "  Status:       ✓ Pushed to remote${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}Next steps:${NC}"
echo "1. Go to main repo and update submodule reference:"
echo "   cd /Users/53gf4u1t/Development/utilsio_versions/utilsio"
echo "   git add packages"
echo "   git commit -m \"chore: update packages to React SDK v$NEW_VERSION\""
echo "   git push origin main"
echo ""
echo "2. The publishReact.yml workflow will automatically trigger on the tag"
echo "   and publish to npm registry"
