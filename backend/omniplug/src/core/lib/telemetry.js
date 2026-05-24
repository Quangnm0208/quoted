/**
 * core/lib/telemetry.js - Phone-home heartbeat.
 *
 * Sends to OMNIPLUG_TELEMETRY_URL on boot + every 24h.
 *
 * Payload (no PII):
 *   - instance_uuid (random, generated on first boot)
 *   - version
 *   - node_env
 *   - tenant_count (active tenants)
 *   - domain (TENANT_DEFAULT_DOMAIN, fallback to FLY_APP_NAME)
 *   - node_version
 *   - timestamp
 *
 * Opt-out: TELEMETRY_ENABLED=false
 *
 * Failure mode: best-effort. Network error -> console.warn + retry next interval.
 * Never blocks boot. Never throws.
 */

import crypto from 'node:crypto';
import db from '../db/connection.js';
import { env } from '../config/env.js';

const TELEMETRY_URL = process.env.OMNIPLUG_TELEMETRY_URL || 'https://telemetry.omniplug.com/v1/heartbeat';
const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

let _intervalHandle = null;

function getOrCreateInstanceUuid() {
  const row = db.prepare('SELECT instance_uuid FROM instance_identity WHERE id = 1').get();
  if (row) return row.instance_uuid;

  const uuid = crypto.randomUUID();
  db.prepare('INSERT INTO instance_identity (id, instance_uuid) VALUES (1, ?)').run(uuid);
  return uuid;
}

function buildPayload(version) {
  const tenantCount = db.prepare(
    "SELECT COUNT(*) AS c FROM tenants WHERE status = 'active'"
  ).get().c;

  const domain =
    process.env.TENANT_DEFAULT_DOMAIN ||
    (process.env.FLY_APP_NAME ? `${process.env.FLY_APP_NAME}.fly.dev` : 'unknown');

  return {
    instance_uuid: getOrCreateInstanceUuid(),
    product: 'omniplug-cms-core',
    version,
    node_env: env.NODE_ENV,
    node_version: process.versions.node,
    tenant_count: tenantCount,
    domain,
    timestamp: new Date().toISOString(),
  };
}

async function sendHeartbeat(version) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const payload = buildPayload(version);

    await fetch(TELEMETRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if (env.NODE_ENV !== 'production') {
      console.warn('[telemetry] heartbeat failed:', err.message);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Ensure instance UUID exists in DB. Idempotent.
 *
 * v1.4.3 fix: this must run on EVERY boot, regardless of TELEMETRY_ENABLED.
 * The UUID is used for licensing, audit trails, and future
 * self-identification — not just telemetry. Previously this was only called
 * from startTelemetry() which returns early when TELEMETRY_ENABLED=false,
 * causing the instance_identity table to be permanently empty in
 * telemetry-disabled installs and smoke tests to fail.
 */
export function ensureInstanceIdentity() {
  try {
    getOrCreateInstanceUuid();
  } catch (err) {
    if (env.NODE_ENV !== 'production') {
      console.warn('[telemetry] identity setup failed:', err.message);
    }
  }
}

/**
 * Start telemetry. Call once from server boot.
 * No-op if TELEMETRY_ENABLED=false (but UUID still created — call
 * ensureInstanceIdentity() separately on boot to guarantee that).
 */
export function startTelemetry(version) {
  // Always create the UUID — even if telemetry is disabled — so the row
  // exists for licensing/audit/smoke purposes. Cheap (one SELECT, possibly
  // one INSERT on first boot only).
  ensureInstanceIdentity();

  if (process.env.TELEMETRY_ENABLED === 'false' || process.env.TELEMETRY_URL === 'disabled') {
    console.log('[telemetry] disabled (UUID still created)');
    return;
  }

  // Initial heartbeat after 30s (give server time to settle)
  setTimeout(() => sendHeartbeat(version), 30_000).unref();

  // Recurring every 24h
  _intervalHandle = setInterval(() => sendHeartbeat(version), HEARTBEAT_INTERVAL_MS);
  _intervalHandle.unref();
}

export function stopTelemetry() {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}
