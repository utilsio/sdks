#!/bin/bash

# Git release script for SDK packages
# Handles git tagging and pushing only
# Version bumping is handled by SDK-specific install.sh scripts
#
# Usage: ./release-sdk.sh <sdk-name>
# Example: ./release-sdk.sh react
#
# Prerequisites:
# 1. Run ./<sdk-name>/install.sh patch|minor|major to bump version
# 2. Commit the version change (install.sh does this)
# 3. Run ./release-sdk.sh <sdk-name> to create tag and push

set -e  # Exit on any error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -ne 1 ]; then
    echo -e "${RED}Error: Invalid arguments${NC}"
    echo "Usage: ./release-sdk.sh <sdk-name>"
    echo ""
    echo "Example:"
    echo "  ./release-sdk.sh react"
    echo ""
    echo "Prerequisites:"
    echo "  1. Run ./react/install.sh patch|minor|major"
    echo "  2. Run ./release-sdk.sh react"
    exit 1
fi

SDK_NAME=$1

# Validate SDK exists
if [ ! -d "./$SDK_NAME" ]; then
    echo -e "${RED}Error: SDK '$SDK_NAME' not found at ./$SDK_NAME${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}SDK Git Release: $SDK_NAME${NC}"
echo -e "${BLUE}========================================${NC}"

# Step 1: Check git status
echo -e "\n${YELLOW}[1/4]${NC} Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: Working directory is not clean${NC}"
    echo "Please commit all changes first (or run $SDK_NAME/install.sh)"
    git status
    exit 1
fi
echo -e "${GREEN}✓ Working directory clean${NC}"

# Step 2: Read version from SDK's version file
echo -e "\n${YELLOW}[2/4]${NC} Reading version..."
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
echo -e "${GREEN}✓ Version: $VERSION${NC}"
echo -e "${GREEN}✓ Tag: $TAG_NAME${NC}"

# Step 3: Create and push tag
echo -e "\n${YELLOW}[3/4]${NC} Creating git tag..."
git tag -a "$TAG_NAME" -m "$SDK_NAME $VERSION"
echo -e "${GREEN}✓ Created tag: $TAG_NAME${NC}"

# Step 4: Push to remote
echo -e "\n${YELLOW}[4/4]${NC} Pushing to remote..."
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
echo "1. Go to main repo and update submodule reference:"
echo "   cd /Users/53gf4u1t/Development/utilsio_versions/utilsio"
echo "   git add packages"
echo "   git commit -m \"chore: update packages to $SDK_NAME SDK v$VERSION\""
echo "   git push origin main"
echo ""
echo "2. The publish$SDK_NAME.yml workflow will automatically trigger on the tag"
echo "   and publish to the appropriate registry"

