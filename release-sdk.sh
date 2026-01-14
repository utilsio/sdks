#!/bin/bash

# Release script for SDK packages
# Handles version bumping (via version.sh) + git tagging/pushing
# Language-agnostic: works with npm, pip, cargo, etc.
#
# Usage: ./release-sdk.sh <sdk-name> [version-args...]
# Examples:
#   ./release-sdk.sh react patch              # Bump 0.1.3 → 0.1.4, tag, push
#   ./release-sdk.sh react minor              # Bump 0.1.3 → 0.2.0, tag, push
#   ./release-sdk.sh python minor             # Works for Python (future SDK)
#   ./release-sdk.sh go major                 # Works for Go (future SDK)

set -e  # Exit on any error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 1 ]; then
    echo -e "${RED}Error: Invalid arguments${NC}"
    echo "Usage: ./release-sdk.sh <sdk-name> [version-args...]"
    echo ""
    echo "Examples:"
    echo "  ./release-sdk.sh react patch              # npm SDK"
    echo "  ./release-sdk.sh python minor             # pip SDK (future)"
    echo "  ./release-sdk.sh go major                 # Go SDK (future)"
    echo ""
    echo "What this script does:"
    echo "  1. Calls ./<sdk-name>/version.sh with any additional args"
    echo "  2. Reads new version from version file"
    echo "  3. Creates annotated git tag: <sdk-name>-v<version>"
    echo "  4. Pushes tag to remote"
    echo "  5. GitHub Actions workflow auto-publishes"
    exit 1
fi

SDK_NAME=$1
shift  # Remove sdk-name, keep remaining args for version.sh
VERSION_ARGS="$@"

# Validate SDK exists
if [ ! -d "./$SDK_NAME" ]; then
    echo -e "${RED}Error: SDK '$SDK_NAME' not found at ./$SDK_NAME${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}SDK Release: $SDK_NAME${NC}"
echo -e "${BLUE}========================================${NC}"

# Step 1: Validate SDK exists
echo -e "\n${YELLOW}[1/5]${NC} Validating SDK..."
if [ ! -d "./$SDK_NAME" ]; then
    echo -e "${RED}Error: SDK '$SDK_NAME' not found at ./$SDK_NAME${NC}"
    exit 1
fi

if [ ! -f "./$SDK_NAME/version.sh" ]; then
    echo -e "${RED}Error: version.sh not found in ./$SDK_NAME${NC}"
    exit 1
fi
echo -e "${GREEN}✓ SDK found${NC}"

# Step 2: Run version.sh with passed arguments
echo -e "\n${YELLOW}[2/5]${NC} Running version bump script..."
if [ -z "$VERSION_ARGS" ]; then
    echo -e "${RED}Error: No version arguments provided${NC}"
    echo "Usage: ./release-sdk.sh <sdk-name> <version-args>"
    echo "Example: ./release-sdk.sh react patch"
    exit 1
fi

cd "./$SDK_NAME"
./version.sh $VERSION_ARGS
cd ..

echo -e "${GREEN}✓ Version bump complete${NC}"

# Step 3: Check git status
echo -e "\n${YELLOW}[3/5]${NC} Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: Working directory is not clean after version bump${NC}"
    git status
    exit 1
fi
echo -e "${GREEN}✓ Working directory clean${NC}"

# Step 4: Read version and create tag
echo -e "\n${YELLOW}[4/5]${NC} Creating git tag..."
if [ ! -f "./$SDK_NAME/package.json" ]; then
    echo -e "${RED}Error: package.json not found in ./$SDK_NAME${NC}"
    exit 1
fi

VERSION=$(grep '"version"' "./$SDK_NAME/package.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Could not read version from package.json${NC}"
    exit 1
fi

TAG_NAME="${SDK_NAME}-v${VERSION}"
git tag -a "$TAG_NAME" -m "$SDK_NAME $VERSION"
echo -e "${GREEN}✓ Created tag: $TAG_NAME${NC}"

# Step 5: Push to remote
echo -e "\n${YELLOW}[5/5]${NC} Pushing to remote..."
git push origin "$TAG_NAME"
echo -e "${GREEN}✓ Pushed tag to origin${NC}"

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Release complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "SDK:           ${BLUE}$SDK_NAME${NC}"
echo -e "Version:       ${BLUE}$VERSION${NC}"
echo -e "Tag:           ${BLUE}$TAG_NAME${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update main repo submodule reference:"
echo "   cd \$(git rev-parse --show-toplevel)"
echo "   git add packages"
echo "   git commit -m \"chore: update packages to $SDK_NAME SDK v$VERSION\""
echo "   git push origin main"
echo ""
echo "2. GitHub Actions workflow will automatically trigger on the tag"
echo "   and publish to the appropriate registry"

