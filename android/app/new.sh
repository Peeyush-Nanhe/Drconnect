#!/bin/bash
# Move to the project root (where package.json is)
cd "$(dirname "$0")/../.." || exit

echo "Building web assets..."
npm run build

echo "Syncing assets to Android..."
npx cap sync android
