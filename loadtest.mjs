/**
 * Load test for append-only GAS backend.
 *
 * Usage:
 *   node loadtest.mjs <GAS_WEBAPP_URL>
 *   node loadtest.mjs https://script.google.com/macros/s/AAAAAA/exec
 *
 * Options (env vars):
 *   WORKERS=20    concurrent workers (default: 10)
 *   DURATION=120  test duration in seconds (default: 60)
 *   RATE=500      ms between saves per worker (default: 300)
 */

const GAS_URL = process.argv[2];
if (!GAS_URL) {
  console.error('Usage: node loadtest.mjs <GAS_WEBAPP_URL>');
  process.exit(1);
}

const NUM_WORKERS = parseInt(process.env.WORKERS || '20', 10);
const DURATION_SEC = parseInt(process.env.DURATION || '30', 10);
const SAVE_INTERVAL_MS = parseInt(process.env.RATE || '300', 10);
const SAVES_PER_WORKER = parseInt(process.env.SAVES || '10', 10);

const SECTORS = ['1A', '2A', '3A', '4A', '5A', '6A', 'RESCATE', 'GIR'];
const STATUSES = ['ACTIVO', 'COMISION', 'PATIO', 'TALLER'];

const stats = { ok: 0, fail: 0, total: 0, sumMs: 0 };
let running = true;

function randomId() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let id = letters[Math.floor(Math.random() * letters.length)];
  id += Math.floor(Math.random() * 999) + 1;
  return id;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeUnit(workerId, seq) {
  return {
    id: `LOAD-${workerId}-${seq}`,
    type: Math.random() > 0.5 ? 'CHOFER' : 'MOTO',
    status: randomChoice(STATUSES),
    kmStart: String(Math.floor(Math.random() * 500) + 100),
    sector: randomChoice(SECTORS)
  };
}

async function callGAS(action, payload, retry = 2) {
  const body = { action, ...payload };
  const start = Date.now();
  try {
    const url = GAS_URL; // Keep original URL (/dev or /exec as provided)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
    const text = await res.text();

    // HTML means GAS redirected to the app page (cold start / no session)
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      if (retry > 0) {
        // Wait a bit and retry (GAS may need warm-up)
        await new Promise(r => setTimeout(r, 1000));
        return callGAS(action, payload, retry - 1);
      }
      return { ok: false, elapsed: Date.now() - start, error: 'Server returned HTML after retries' };
    }

    const data = JSON.parse(text);
    const elapsed = Date.now() - start;
    return { ok: data.success !== false, elapsed, error: data.error, data };
  } catch (err) {
    if (retry > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return callGAS(action, payload, retry - 1);
    }
    return { ok: false, elapsed: Date.now() - start, error: err.message };
  }
}

/** Warm up GAS with a single request so concurrent workers don't hit cold starts */
async function warmup() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('Warming up GAS...');
  // Just make any request to warm up the GAS runtime
  try {
    const res = await fetch(GAS_URL, { method: 'GET', redirect: 'follow' });
    console.log('Warmup: HTTP ' + res.status + ' (' + res.url.slice(0, 80) + '...)');
  } catch (e) {
    console.log('Warmup: ' + e.message);
  }
  await new Promise(r => setTimeout(r, 3000));
}

function printStats() {
  const avg = stats.total > 0 ? (stats.sumMs / stats.total).toFixed(0) : '-';
  const rate = stats.total > 0 ? (stats.total / DURATION_SEC).toFixed(1) : '-';
  console.log(
    `[${new Date().toISOString().slice(11, 19)}] ` +
    `reqs: ${stats.total} | OK: ${stats.ok} | FAIL: ${stats.fail} | ` +
    `avg: ${avg}ms | rate: ${rate}/s`
  );
}

async function worker(workerId) {
  let seq = 0;
  const dateStr = new Date().toISOString().slice(0, 10);
  const shift = 'MAÑANA';

  while (running && seq < SAVES_PER_WORKER) {
    seq++;
    const unit = makeUnit(workerId, seq);

    // Alternate between updateUnit and saveShiftData
    let result;
    if (seq % 5 === 0) {
      // Every 5th call: full batch save
      const units = [unit, makeUnit(workerId, seq + 1000)];
      result = await callGAS('saveShiftData', {
        dateStr, shift,
        settings: { nombrePuesto: unit.sector, operador: `OP-${workerId}`, supervisor: `SUP-${workerId}` },
        units
      });
    } else {
      // Single unit save (fast path)
      result = await callGAS('updateUnit', {
        dateStr, shift,
        settings: { nombrePuesto: unit.sector, operador: `OP-${workerId}` },
        unit
      });
    }

    stats.total++;
    stats.sumMs += result.elapsed;
    if (result.ok) {
      stats.ok++;
    } else {
      stats.fail++;
      // Only print first error per worker to avoid spam
      if (seq <= 3) console.error(`  [worker ${workerId}] FAIL: ${result.error}`);
    }

    // Wait before next save
    await new Promise(r => setTimeout(r, SAVE_INTERVAL_MS + Math.random() * 200));
  }
}

async function verify() {
  console.log('\n=== VERIFICACIÓN FINAL ===');
  const dateStr = new Date().toISOString().slice(0, 10);

  for (const sector of SECTORS) {
    const res = await callGAS('getSectorData', { dateStr, shift: 'MAÑANA', sector });
    if (res.ok && res.data && res.data.units) {
      const unitIds = res.data.units.map(u => u.unit_id);
      const unique = new Set(unitIds);
      console.log(`  ${sector}: ${res.data.units.length} rows, ${unique.size} unique unit_ids`);
      if (unitIds.length !== unique.size) {
        console.log(`    DUPLICATES: ${unitIds.length - unique.size}`);
      }
    } else {
      console.log(`  ${sector}: ${JSON.stringify(res)}`);
    }
  }
}

async function main() {
  console.log(`=== LOAD TEST ===`);
  console.log(`  URL:      ${GAS_URL}`);
  console.log(`  Workers:  ${NUM_WORKERS}`);
  console.log(`  Duration: ${DURATION_SEC}s`);
  console.log(`  Interval: ${SAVE_INTERVAL_MS}ms per worker`);
  console.log(`  Rate:     ~${(1000 / SAVE_INTERVAL_MS * NUM_WORKERS).toFixed(0)} req/s`);
  console.log('');

  // Warmup first so concurrent workers don't all hit cold starts
  await warmup();

  const workers = [];
  for (let i = 0; i < NUM_WORKERS; i++) {
    workers.push(worker(i));
  }

  // Print stats every 5 seconds
  const statsInterval = setInterval(printStats, 5000);

  // Stop after duration
  setTimeout(() => {
    running = false;
    clearInterval(statsInterval);
  }, DURATION_SEC * 1000);

  // Wait for all workers to finish
  await Promise.all(workers);

  printStats();
  console.log('\n=== TEST COMPLETE ===');
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  running = false;
  console.log('\nStopping workers...');
  setTimeout(() => process.exit(0), 2000);
});

main().catch(console.error);
