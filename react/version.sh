#!/bin/bash

# Version bump script for React SDK
# Handles package.json version updates and creates commit
#
# Usage: ./version.sh patch|minor|major
# Example:
#   ./version.sh patch    # 0.1.3 → 0.1.4
#   ./version.sh minor    # 0.1.3 → 0.2.0
#   ./version.sh major    # 0.1.3 → 1.0.0

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
    echo "Usage: ./version.sh patch|minor|major"
    echo ""
    echo "Examples:"
    echo "  ./version.sh patch    # Bump 0.1.3 → 0.1.4"
    echo "  ./version.sh minor    # Bump 0.1.3 → 0.2.0"
    echo "  ./version.sh major    # Bump 0.1.3 → 1.0.0"
    exit 1
fi

VERSION_TYPE=$1

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}Error: Invalid version type '$VERSION_TYPE'${NC}"
    echo "Must be: patch, minor, or major"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}React SDK Version Bump ($VERSION_TYPE)${NC}"
echo -e "${BLUE}========================================${NC}"

# Step 1: Check git status
echo -e "\n${YELLOW}[1/4]${NC} Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: Working directory is not clean${NC}"
    echo "Please commit or stash all changes first"
    git status
    exit 1
fi
echo -e "${GREEN}✓ Working directory clean${NC}"

# Step 2: Read current version
echo -e "\n${YELLOW}[2/4]${NC} Reading current version..."
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found${NC}"
    exit 1
fi

CURRENT_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
if [ -z "$CURRENT_VERSION" ]; then
    echo -e "${RED}Error: Could not read version from package.json${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Current version: $CURRENT_VERSION${NC}"

# Step 3: Calculate new version
echo -e "\n${YELLOW}[3/4]${NC} Calculating new version..."

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

echo -e "${GREEN}✓ Version bump: $CURRENT_VERSION → $NEW_VERSION${NC}"

# Step 4: Update package.json and create commit
echo -e "\n${YELLOW}[4/4]${NC} Updating package.json and creating commit..."

# Update version in package.json using sed (non-destructive)
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/g" package.json

# Update package-lock.json if it exists
if [ -f "package-lock.json" ]; then
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/g" package-lock.json
fi

# Create git commit
git add package.json
[ -f "package-lock.json" ] && git add package-lock.json
git commit -m "chore(react): bump version to $NEW_VERSION"

echo -e "${GREEN}✓ Updated package.json to $NEW_VERSION${NC}"
echo -e "${GREEN}✓ Created commit${NC}"

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Version bump complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Old Version: ${BLUE}$CURRENT_VERSION${NC}"
echo -e "New Version: ${BLUE}$NEW_VERSION${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Push the version commit:"
echo "   cd .."
echo "   git push origin main"
echo ""
echo "2. Create and push the release tag:"
echo "   ./release-sdk.sh react"
echo ""
echo "3. The GitHub Actions workflow will trigger and publish to npm"
