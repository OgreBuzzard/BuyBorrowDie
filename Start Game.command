#!/bin/zsh
# Double-click to install what the game needs and start it in your browser.
cd "$(dirname "$0")" || exit 1
npm install && npm run dev -- --open
