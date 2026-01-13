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
echo -e "\n${YELLOW}[1/6]${NC} Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: Working directory is not clean${NC}"
    echo "Please commit or stash all changes first"
    git status
    exit 1
fi
echo -e "${GREEN}✓ Working directory clean${NC}"

# Step 2: Navigate to SDK directory and check package.json
echo -e "\n${YELLOW}[2/6]${NC} Checking package.json..."
if [ ! -f "./$SDK_NAME/package.json" ]; then
    echo -e "${RED}Error: package.json not found in ./$SDK_NAME${NC}"
    exit 1
fi

CURRENT_VERSION=$(grep '"version"' "./$SDK_NAME/package.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
echo -e "${GREEN}✓ Current version: $CURRENT_VERSION${NC}"

# Step 3: Calculate new version (manual - avoids npm version hanging with bun)
echo -e "\n${YELLOW}[3/6]${NC} Calculating new version..."

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
MAJOR=${MAJOR:-0}
MINOR=${MINOR:-0}
PATCH=${PATCH:-0}

case "$VERSION_TYPE" in
    patch)
        PATCH=$((PATCH + 1))
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
TAG_NAME="${SDK_NAME}-v${NEW_VERSION}"

echo -e "${GREEN}✓ Version bump: $CURRENT_VERSION → $NEW_VERSION${NC}"

# Step 4: Update package.json version manually
echo -e "\n${YELLOW}[4/6]${NC} Updating package.json..."
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/g" "./$SDK_NAME/package.json"
echo -e "${GREEN}✓ Updated package.json to $NEW_VERSION${NC}"

# Step 5: Create git commit and tag
echo -e "\n${YELLOW}[5/6]${NC} Creating git commit and tag..."
git add "./$SDK_NAME/package.json"
git commit -m "chore(${SDK_NAME}): bump version to $NEW_VERSION"
git tag -a "$TAG_NAME" -m "$SDK_NAME $NEW_VERSION"

echo -e "${GREEN}✓ Created commit and tag: $TAG_NAME${NC}"

# Step 6: Push to remote
echo -e "\n${YELLOW}[6/6]${NC} Pushing to remote..."

git push origin main
echo -e "${GREEN}✓ Pushed commits to origin/main${NC}"

git push origin "$TAG_NAME"
echo -e "${GREEN}✓ Pushed tag $TAG_NAME to origin${NC}"

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Release complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "SDK:          ${BLUE}$SDK_NAME${NC}"
echo -e "New Version:  ${BLUE}$NEW_VERSION${NC}"
echo -e "Tag:          ${BLUE}$TAG_NAME${NC}"
echo -e "Status:       ${GREEN}✓ Pushed to remote${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Go to main repo and update submodule reference:"
echo "   cd /Users/53gf4u1t/Development/utilsio_versions/utilsio"
echo "   git add packages"
echo "   git commit -m \"chore: update packages to ${SDK_NAME^} SDK v$NEW_VERSION\""
echo "   git push origin main"
echo ""
echo "2. The publish${SDK_NAME^}.yml workflow will automatically trigger on the tag"
echo "   and publish to the appropriate registry"

