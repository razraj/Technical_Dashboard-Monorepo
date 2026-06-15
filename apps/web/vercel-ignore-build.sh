#!/usr/bin/env bash

# Vercel Ignored Build Step: exit 1 = build, exit 0 = skip.
#
# Policy (identical for apps/web and apps/backend):
# - Only main and dev may deploy
# - Both must use VERCEL_ENV=production (Production environment variables)
#
# Vercel dashboard (configure for EACH project — web and backend):
# 1. Root Directory: apps/web or apps/backend
# 2. Git → Production Branch: main
# 3. Environments → map dev branch to Production (Custom Environment / branch rule)
# 4. Enable "Automatically expose System Environment Variables"

ALLOWED_BRANCHES=("main" "dev")

echo "Branch: ${VERCEL_GIT_COMMIT_REF:-<unset>}"
echo "Environment: ${VERCEL_ENV:-<unset>}"

if [[ -z "${VERCEL_GIT_COMMIT_REF:-}" ]]; then
  echo "Build cancelled: VERCEL_GIT_COMMIT_REF is not set."
  exit 0
fi

branch_allowed=false
for branch in "${ALLOWED_BRANCHES[@]}"; do
  if [[ "$VERCEL_GIT_COMMIT_REF" == "$branch" ]]; then
    branch_allowed=true
    break
  fi
done

if [[ "$branch_allowed" != true ]]; then
  echo "Build cancelled: branch '$VERCEL_GIT_COMMIT_REF' is not allowed (only ${ALLOWED_BRANCHES[*]})."
  exit 0
fi

if [[ "${VERCEL_ENV:-}" != "production" ]]; then
  echo "Build cancelled: only Production environment builds are allowed (VERCEL_ENV=production)."
  echo "Map main and dev to Production in Vercel → Project Settings → Environments."
  exit 0
fi

echo "Production build allowed for branch '$VERCEL_GIT_COMMIT_REF'."
exit 1
