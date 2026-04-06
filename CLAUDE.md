# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based lottery/draw tool with prize management. Static single-page app — no build system, no bundler, no tests. Open `index.html` directly in a browser to run.

## Architecture

Single-file JavaScript app (`script.js`) with all logic in one file:

- **Storage layer**: IndexedDB (`lotteryDB` / `prizes` object store) for prize data including base64 images. localStorage for draw history (max 1000 records) and UI settings (`thumbnailSize`, `enlargedSize`).
- **Draw engine**: Weighted random selection based on probability. When a prize hits quantity 0, its probability is redistributed proportionally among remaining active prizes (`adjustProbabilities`). `distributeProbabilities` normalizes all probabilities to sum to 100%.
- **Settings modal**: SweetAlert2-based UI for CRUD on prizes. Each prize has: name, image (base64), probability, quantity, customText, textColor, bgColor, displayMode (name/image/all).
- **Import/Export**: SheetJS (XLSX) for Excel import/export of both prize settings and draw history. Import requires specific column headers (Name, Probability, Quantity).
- **Test draw**: Simulation mode (100/1000 draws) that runs draws without persisting, showing distribution stats.

## Dependencies (loaded via CDN in index.html)

- **SweetAlert2**: All modals and dialogs
- **SheetJS (XLSX)**: Excel import/export

## Key Patterns

- All functions are global (no modules). Draw functions (`drawSingle`, `drawMultiple`) are called directly from `onclick` attributes in HTML.
- Prize images stored as base64 data URLs in IndexedDB — large images can cause storage issues.
- UI language is mixed: Chinese (Traditional) in HTML labels, English in JS alerts and code.
- The `prizes` array is the in-memory state; it's loaded from IndexedDB on page load and saved back after every draw or settings change.
