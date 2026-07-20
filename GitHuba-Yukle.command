#!/bin/bash

set -euo pipefail

REPOSITORY="UmutKaanTorun/sade-not"
REMOTE_URL="https://github.com/UmutKaanTorun/sade-not.git"
WORKFLOW_FILE="build-macos.yml"
ARTIFACT_NAME="Sade-Not-macOS"

cd "$(dirname "$0")"

echo ""
echo "Sade Not — GitHub ve DMG hazırlayıcı"
echo "===================================="
echo ""

if ! command -v git >/dev/null 2>&1; then
  echo "Git bulunamadı. Önce Xcode Command Line Tools kurulacak."
  xcode-select --install || true
  echo "Kurulum bittikten sonra bu dosyayı yeniden açın."
  read -r -p "Kapatmak için Enter'a basın..."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "GitHub CLI gerekli. Homebrew ile kurulabilir."
    read -r -p "Şimdi kurulsun mu? [E/h] " answer
    case "${answer:-E}" in
      h|H|n|N)
        echo "Kurulum iptal edildi. Daha sonra 'brew install gh' çalıştırabilirsiniz."
        read -r -p "Kapatmak için Enter'a basın..."
        exit 1
        ;;
      *) brew install gh ;;
    esac
  else
    echo "GitHub CLI bulunamadı. Önce Homebrew veya GitHub CLI kurulmalı:"
    echo "https://cli.github.com/"
    open "https://cli.github.com/" || true
    read -r -p "Kurulum bittikten sonra dosyayı yeniden açmak için Enter'a basın..."
    exit 1
  fi
fi

if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  echo "Tarayıcıda GitHub girişi açılıyor..."
  gh auth login --hostname github.com --git-protocol https --web
fi

gh auth setup-git

if [ ! -d .git ]; then
  git init >/dev/null
fi

git config user.name "Umut Kaan Torun"
git config user.email "230411265+UmutKaanTorun@users.noreply.github.com"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

echo "GitHub'daki başlangıç commit'i alınıyor..."
git fetch origin main

git add -A
tree_sha="$(git write-tree)"
parent_sha="$(git rev-parse FETCH_HEAD)"
parent_tree_sha="$(git rev-parse "${parent_sha}^{tree}")"

if [ "$tree_sha" = "$parent_tree_sha" ]; then
  commit_sha="$parent_sha"
  echo "Kaynaklar GitHub'da zaten güncel."
else
  commit_sha="$(printf '%s\n' 'feat: add Sade Not macOS MVP' | git commit-tree "$tree_sha" -p "$parent_sha")"
  git update-ref refs/heads/main "$commit_sha"
  git symbolic-ref HEAD refs/heads/main
  echo "Kaynaklar GitHub'a gönderiliyor..."
  git push --set-upstream origin main
fi

echo "macOS DMG iş akışı bekleniyor..."
run_id=""
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  run_id="$(gh run list \
    --repo "$REPOSITORY" \
    --workflow "$WORKFLOW_FILE" \
    --branch main \
    --event push \
    --limit 20 \
    --json databaseId,headSha \
    --jq "map(select(.headSha == \"$commit_sha\"))[0].databaseId // \"\"" \
    2>/dev/null || true)"
  [ -n "$run_id" ] && break
  sleep 5
done

if [ -z "$run_id" ]; then
  echo "İş akışı henüz görünmedi. Actions sayfası açılıyor."
  open "https://github.com/$REPOSITORY/actions" || true
  read -r -p "Kapatmak için Enter'a basın..."
  exit 0
fi

if ! gh run watch "$run_id" --repo "$REPOSITORY" --exit-status; then
  echo "DMG derlemesi başarısız oldu. Hata ayrıntıları:"
  gh run view "$run_id" --repo "$REPOSITORY" --log-failed || true
  open "https://github.com/$REPOSITORY/actions/runs/$run_id" || true
  read -r -p "Kapatmak için Enter'a basın..."
  exit 1
fi

output_dir="$PWD/release-from-github/run-$run_id-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$output_dir"
gh run download "$run_id" \
  --repo "$REPOSITORY" \
  --name "$ARTIFACT_NAME" \
  --dir "$output_dir"

echo ""
echo "DMG dosyaları hazır: $output_dir"
open "$output_dir" || true
read -r -p "Tamamlandı. Kapatmak için Enter'a basın..."
