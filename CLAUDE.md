# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Craft Timeblock Viewer - a single-page web application that displays Craft daily notes as a visual timeline. Uses Claude Desktop's color palette for theming.

## Development

This is a zero-build project. Open `index.html` directly in a browser to run.

No package manager, bundler, or build step required.

## Architecture

**Single file (`index.html`)** containing:
- CSS custom properties for dark/light theming (Claude Desktop palette)
- Vanilla JavaScript application with no dependencies
- Connects to Craft Connect API to fetch daily blocks

**Key sections in the code:**
- **Setup screen**: First-run flow to configure Craft API URL
- **Timeline view**: Visual schedule from 6 AM - 10 PM (60px per hour)
- **Settings modal**: Theme toggle and API URL configuration

**Data flow:**
1. Fetches from `{apiUrl}/blocks?date=today`
2. Parses time patterns like `10:00 AM - 11:00 AM - Task name`
3. Renders as positioned blocks on timeline
4. Updates "now line" every 60 seconds

**Storage:** Uses localStorage for `craft-timeblock-api` (URL) and `craft-timeblock-theme` (dark/light)
