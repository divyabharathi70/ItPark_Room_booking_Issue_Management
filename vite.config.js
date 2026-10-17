import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const sharedDataPath = resolve(projectRoot, '.local', 'shared-data.json')
const sharedCollections = new Set(['bookings', 'notifications', 'clients', 'issues', 'extendRequests', 'staffProfiles'])

function emptySharedData() {
  return { bookings: [], notifications: [], clients: [], issues: [], extendRequests: [], staffProfiles: [] }
}

function readSharedData() {
  if (!existsSync(sharedDataPath)) return emptySharedData()
  try {
    return { ...emptySharedData(), ...JSON.parse(readFileSync(sharedDataPath, 'utf8')) }
  } catch {
    return emptySharedData()
  }
}

function recordKey(collection, record) {
  return collection === 'clients' ? String(record.email || '').trim().toLowerCase() : record.id
}

function mergeRecords(collection, existing, incoming) {
  const records = new Map()
  existing.forEach((record) => {
    const key = recordKey(collection, record)
    if (key) records.set(key, record)
  })
  incoming.forEach((record) => {
    const key = recordKey(collection, record)
    if (!key) return
    const previous = records.get(key)
    if ((collection === 'issues' || collection === 'extendRequests' || collection === 'staffProfiles') && previous) {
      const previousTime = Date.parse(previous.lastUpdated || previous.updatedAt || previous.createdDate || previous.createdAt || 0)
      const incomingTime = Date.parse(record.lastUpdated || record.updatedAt || record.createdDate || record.createdAt || 0)
      if (previousTime > incomingTime) return
    }
    records.set(key, record)
  })
  return Array.from(records.values())
}

function withSharedDataLock(update) {
  mkdirSync(dirname(sharedDataPath), { recursive: true })
  const lockPath = `${sharedDataPath}.lock`
  const waitArray = new Int32Array(new SharedArrayBuffer(4))
  const deadline = Date.now() + 3000
  let lockFd

  while (lockFd === undefined) {
    try {
      lockFd = openSync(lockPath, 'wx')
    } catch (error) {
      if (error.code !== 'EEXIST' || Date.now() >= deadline) throw error
      Atomics.wait(waitArray, 0, 0, 10)
    }
  }

  try {
    const shared = readSharedData()
    const result = update(shared)
    if (result?.persist !== false) {
      const tempPath = `${sharedDataPath}.${process.pid}.tmp`
      writeFileSync(tempPath, JSON.stringify(shared, null, 2))
      renameSync(tempPath, sharedDataPath)
    }
    return result
  } finally {
    closeSync(lockFd)
    unlinkSync(lockPath)
  }
}

function persistSharedRecords(collection, records) {
  return withSharedDataLock((shared) => {
    shared[collection] = mergeRecords(collection, shared[collection], records)
  })
}

function bookingTimestamp(booking, edge) {
  const date = edge === 'start'
    ? booking.startDate || booking.date
    : booking.endDate || booking.date
  const time = edge === 'start' ? booking.startTime : booking.endTime
  if (!date || !time) return null
  const timestamp = new Date(`${date}T${time}:00`).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function findBookingConflict(bookings, candidate, excludeId) {
  const start = bookingTimestamp(candidate, 'start')
  const end = bookingTimestamp(candidate, 'end')
  if (!candidate?.roomId || start === null || end === null || end <= start) return { invalid: true }
  const conflict = bookings.find((existing) => {
    if (existing.id === excludeId || existing.roomId !== candidate.roomId || existing.bookingStatus === 'CANCELLED') {
      return false
    }
    const existingStart = bookingTimestamp(existing, 'start')
    const existingEnd = bookingTimestamp(existing, 'end')
    return existingStart !== null && existingEnd !== null && start < existingEnd && existingStart < end
  })
  return { conflict: conflict || null }
}

function checkSharedAvailability(candidate, excludeId) {
  return withSharedDataLock((shared) => {
    const result = findBookingConflict(shared.bookings || [], candidate, excludeId)
    return { persist: false, ...result, available: !result.invalid && !result.conflict }
  })
}

function reserveSharedBooking(booking) {
  return withSharedDataLock((shared) => {
    if (!booking?.id) {
      return { persist: false, invalid: true }
    }
    const stored = (shared.bookings || []).find((existing) => existing.id === booking.id)
    if (stored?.bookingStatus === 'CANCELLED' && booking.bookingStatus !== 'CANCELLED') {
      return { persist: false, conflict: stored }
    }
    const { conflict, invalid } = findBookingConflict(shared.bookings || [], booking, booking.id)
    if (invalid) return { persist: false, invalid: true }
    if (conflict) return { persist: false, conflict }

    shared.bookings = mergeRecords('bookings', shared.bookings || [], [booking])
    return { booking }
  })
}

function sharedDataMiddleware(req, res, next) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname
  if (
    pathname !== '/__itpark_shared_data' &&
    pathname !== '/__itpark_reserve_booking' &&
    pathname !== '/__itpark_check_availability'
  ) return next()

  res.setHeader('Cache-Control', 'no-store')
  if (pathname !== '/__itpark_shared_data' && req.method !== 'POST') {
    res.writeHead(405)
    res.end('Method not allowed')
    return
  }
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(readSharedData()))
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405)
    res.end('Method not allowed')
    return
  }

  let body = ''
  req.on('data', (chunk) => {
    body += chunk
    if (body.length > 6_000_000) {
      res.writeHead(413)
      res.end('Request too large')
      req.destroy()
    }
  })
  req.on('end', () => {
    try {
      if (pathname === '/__itpark_check_availability') {
        const result = checkSharedAvailability(JSON.parse(body || '{}'), JSON.parse(body || '{}').excludeId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
        return
      }

      if (pathname === '/__itpark_reserve_booking') {
        const result = reserveSharedBooking(JSON.parse(body || '{}').booking)
        if (result.invalid) {
          res.writeHead(400)
          res.end('Invalid booking')
          return
        }
        if (result.conflict) {
          res.writeHead(409, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ conflict: result.conflict }))
          return
        }
        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ booking: result.booking }))
        return
      }

      const { collection, records } = JSON.parse(body || '{}')
      if (!sharedCollections.has(collection) || !Array.isArray(records)) {
        res.writeHead(400)
        res.end('Invalid shared data request')
        return
      }

      persistSharedRecords(collection, records)
      res.writeHead(204)
      res.end()
    } catch {
      res.writeHead(400)
      res.end('Invalid JSON')
    }
  })
}

function sharedDataPlugin() {
  return {
    name: 'itpark-shared-booking-data',
    configureServer(server) {
      server.middlewares.use(sharedDataMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(sharedDataMiddleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sharedDataPlugin()],
})
