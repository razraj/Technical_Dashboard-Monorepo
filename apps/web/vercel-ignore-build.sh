#!/usr/bin/env bash

# Vercel Ignored Build Step: exit 1 = build, exit 0 = skip.
# Only main and dev should trigger deployments for this app.

ALLOWED_BRANCHES=("main" "dev")

echo "Current branch: ${VERCEL_GIT_COMMIT_REF:-<unset>}"

if [[ -z "${VERCEL_GIT_COMMIT_REF:-}" ]]; then
  echo "Build cancelled: VERCEL_GIT_COMMIT_REF is not set."
  exit 0
fi

for branch in "${ALLOWED_BRANCHES[@]}"; do
  if [[ "$VERCEL_GIT_COMMIT_REF" == "$branch" ]]; then
    echo "Branch allowed. Build can proceed."
    exit 1
  fi
done

echo "Build cancelled: branch '$VERCEL_GIT_COMMIT_REF' is not allowed (only ${ALLOWED_BRANCHES[*]})."
exit 0
