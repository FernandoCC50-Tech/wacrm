#!/usr/bin/env bash
# Preflight do wacrm -- rodar antes de qualquer alteracao
cd "$(dirname "$0")/.."
echo "== GIT =="; git status --short
echo "== SWARM =="; docker service ps wacrm_app --no-trunc
