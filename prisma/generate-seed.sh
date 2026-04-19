#!/bin/bash
# Genereer de juiste image arrays voor seed.ts
cd "$(dirname "$0")/.."
for dir in public/products/banken/*/; do
  slug=$(basename "$dir")
  files=$(ls "$dir"*.webp 2>/dev/null | sort | head -6 | while read f; do
    echo "\"/products/banken/$slug/$(basename $f)\""
  done | paste -sd,)
  echo "$slug: [$files]"
done
