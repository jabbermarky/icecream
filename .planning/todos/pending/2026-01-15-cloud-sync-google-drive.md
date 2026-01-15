---
created: 2026-01-15T10:20
title: Cloud sync storage backend with Google Drive
area: storage
files:
  - js/storage/storage.js
  - js/storage/indexeddb-storage.js
---

## Problem

Currently all data (recipes and ingredients) is stored locally in IndexedDB. This means:
- Data is lost if browser storage is cleared
- No access to recipes from other devices
- No backup/recovery mechanism
- Can't share recipes between users

The storage interface pattern was specifically designed to enable swapping backends without changing consumers.

## Solution

TBD - Consider Google Drive as cloud storage backend:

**Architecture:**
- Create GoogleDriveStorage class implementing StorageInterface
- Store recipes/ingredients as JSON files in app-specific folder
- Sync strategy: local-first with background sync to cloud

**Google Drive specifics:**
- OAuth 2.0 authentication flow
- Google Drive API for file operations
- App data folder (hidden from user) or visible folder
- Conflict resolution for multi-device edits

**Sync considerations:**
- Offline-first: work locally, sync when online
- Conflict detection and resolution UI
- Progress indicators for sync operations
- Error handling for network failures

**User experience:**
- "Sign in with Google" button
- Sync status indicator
- Manual sync trigger option
- Settings to enable/disable cloud sync
