// src/logging/storage.ts
//
// LogStorageService: manages persistence of debug log entries to the
// dedicated `space_idle_logs` IndexedDB store.
//
// Implements a capped ring buffer (max 1,000 entries) to prevent
// client-side storage bloat during long-running idle sessions.
// Writes are serialized via an internal promise chain to prevent
// lost updates from concurrent fire-and-forget appends.
//
// This module depends on the db layer (src/db) for IDB access and
// the LogEntry type. It is NOT imported by the engine layer.
import type { LogEntry } from '../db'
import { getLogEntries, saveLogEntries, clearLogEntries, LOG_ENTRY_LIMIT } from '../db'

/**
 * Internal write queue: serializes appends so that concurrent
 * fire-and-forget calls don't clobber each other's read-modify-write
 * cycle. Each append is chained after the previous one completes.
 */
let writeQueue: Promise<void> = Promise.resolve()

export const LogStorageService = {
  /**
   * Appends a log entry to the `space_idle_logs` store, maintaining
   * the ring-buffer limit of LOG_ENTRY_LIMIT entries.
   *
   * Fire-and-forget: returns a Promise that resolves once the write
   * completes, but callers are not expected to await it. Errors are
   * caught and logged to console.warn so they never break the game
   * loop.
   */
  append(entry: LogEntry): Promise<void> {
    const doWrite = async () => {
      const existing = await getLogEntries()
      const currentLogs = existing ?? []
      const updated = [...currentLogs, entry]
      const trimmed =
        updated.length > LOG_ENTRY_LIMIT ? updated.slice(updated.length - LOG_ENTRY_LIMIT) : updated
      await saveLogEntries(trimmed)
    }

    writeQueue = writeQueue.then(doWrite, doWrite).catch((err) => {
      console.warn('Failed to persist debug log entry:', err)
    })

    return writeQueue
  },

  /**
   * Retrieves all persisted log entries (oldest first).
   * Returns an empty array if no logs exist yet.
   */
  getAll(): Promise<LogEntry[]> {
    return getLogEntries().then((entries) => entries ?? [])
  },

  /**
   * Clears all persisted debug log entries from IndexedDB.
   */
  clear(): Promise<void> {
    return clearLogEntries()
  },
}
