#!/bin/bash

echo "Current branch: $VERCEL_GIT_COMMIT_REF"

# Replace "main" and "staging" with the specific branches you want to build
if [[ "$VERCEL_GIT_COMMIT_REF" == "main" || "$VERCEL_GIT_COMMIT_REF" == "dev" ]] ; then
  # exit 1 tells Vercel to proceed with the build
  echo "✅ - Branch allowed. Build can proceed."
  exit 1;
else
  # exit 0 tells Vercel to cancel the build gracefully
  echo "🛑 - Branch not allowed. Build cancelled."
  exit 0;
fi