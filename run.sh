#!/bin/bash
# ForgeClaw Skill Extractor - Runner

echo "🔥 ForgeClaw Skill Extractor"
echo "============================="
echo ""

cd "$(dirname "$0")"

if [ ! -f "extractor.js" ]; then
    echo "❌ extractor.js not found!"
    exit 1
fi

node extractor.js "$@"
