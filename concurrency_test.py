"""
concurrency_test.py — Pruebas de concurrencia en Firestore.

Escenarios:
  14u : 14 usuarios, updateUnit (default)
  30u : 30 usuarios, updateUnit (c/u: 10 chofer + 10 moto + 10 sereno)
  30f : 30 usuarios, saveShiftData (c/u: 10 chofer + 10 moto + 10 sereno)
  all : los 3 escenarios en secuencia
"""

import os
import json
import time
import random
import threading
import requests
import sys
from datetime import datetime

EXEC_URL = "https://script.google.com/macros/s/AKfycbwJvmN7e3A8LRSQmcESeum9ohZW_h4M4hTGcC5wZ16UcGewpmgdybDHrCTSQv65We8G/exec"

SECTORS = ['1A', '1B', '2A', '2B', '3', '4', '5', '6', '7', '8', '9A', '9B', 'RESCATE', 'GIR']

STATUSES = ['ACTIVO', 'COMISION', 'PATIO', 'TALLER', 'DESPACHADO']
REASONS = ['TRASLADO', 'MANTENIMIENTO', 'DESCANSO', 'COMBUSTIBLE', 'OTROS']
MODELS = ['TOYOTA HILUX', 'NISSAN NP300', 'HYUNDAI TUCSON', 'KIA SPORTAGE', 'FORD RANGER']
PERSONNEL = ['Juan Perez', 'Maria Garcia', 'Carlos Lopez', 'Ana Martinez', 'Pedro Ramirez', 'Lucia Fernandez']

stats = {"ok": 0, "fail": 0, "total": 0, "errors": []}
stats_lock = threading.Lock()
start_time = None


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def make_units(worker_id, sector, date_str, shift, count_chofer=10, count_moto=10, count_sereno=10):
    """Genera lista de unidades (chofer + moto + sereno) para un sector."""
    units = []
    idx = 0
    for seccion, prefix, count in [('CHOFER', 'C', count_chofer), ('MOTO', 'H', count_moto), ('SERENO', 'S', count_sereno)]:
        if sector == 'RESCATE' and seccion != 'CHOFER':
            continue
        for u in range(1, count + 1):
            idx += 1
            status = random.choice(STATUSES)
            units.append({
                "id": f"CTEST-W{worker_id}-{sector}-{prefix}{u:03d}",
                "type": seccion,
                "model": random.choice(MODELS),
                "personnel1": random.choice(PERSONNEL),
                "personnel2": random.choice(PERSONNEL),
                "plate": f"ABC-{1000 + worker_id * 100 + idx}",
                "indicative": f"{sector}-{prefix}{u:03d}",
                "radio": f"RAD-{1000 + worker_id * 100 + idx}",
                "status": status,
                "reason": random.choice(REASONS) if status != 'ACTIVO' else '',
                "kmStart": str(random.randint(100, 500)),
                "kmEnd": str(random.randint(200, 600)),
                "totalKm": str(random.randint(50, 300)),
                "kmRecarga": str(random.randint(0, 100)),
                "hours": f"{random.randint(1, 12)}H",
                "fuel": f"{random.randint(10, 50)}GL",
                "expense": str(random.randint(20, 200)),
                "sector": sector,
                "partes": "0",
                "quadrant": str(random.randint(1, 4)),
                "mechanics": f"MEC-{100 + worker_id}" if random.random() > 0.7 else "",
                "lugarEstado": f"SECTOR {sector}" if status != 'ACTIVO' else "",
                "motivoEstado": random.choice(REASONS) if status != 'ACTIVO' else "",
            })
    return units


def worker_updateUnit(worker_id):
    """Llama updateUnit ~30 veces (1 unidad por call)."""
    sector = SECTORS[worker_id % len(SECTORS)]
    date_str = datetime.now().strftime("%Y-%m-%d")
    shift = "MAÑANA" if worker_id % 3 == 0 else ("TARDE" if worker_id % 3 == 1 else "NOCHE")

    settings = {
        "nombrePuesto": sector,
        "operador": f"COP-W{worker_id}",
        "supervisor": f"CSUP-W{worker_id}",
        "permanencia": f"{random.randint(1, 8)}H",
    }

    # save settings first
    try:
        requests.post(EXEC_URL, json={
            "action": "saveShiftSettings", "dateStr": date_str, "shift": shift, "settings": settings
        }, timeout=15)
    except:
        pass

    units = make_units(worker_id, sector, date_str, shift)
    random.shuffle(units)

    for unit in units:
        try:
            resp = requests.post(EXEC_URL, json={
                "action": "updateUnit", "dateStr": date_str, "shift": shift, "settings": settings, "unit": unit
            }, timeout=15)
            with stats_lock:
                stats["total"] += 1
                if resp.status_code == 200 and resp.json().get("success"):
                    stats["ok"] += 1
                else:
                    stats["fail"] += 1
        except Exception as e:
            with stats_lock:
                stats["total"] += 1
                stats["fail"] += 1

        time.sleep(random.uniform(1.5, 4))

    log(f"[U{worker_id}:{sector}] {len(units)} units OK ({int(time.time()-start_time)}s)")


def worker_saveShiftData(worker_id):
    """Llama saveShiftData con ~30 unidades en un solo call (flujo completo con KM bridge)."""
    sector = SECTORS[worker_id % len(SECTORS)]
    date_str = datetime.now().strftime("%Y-%m-%d")
    shift = "MAÑANA" if worker_id % 3 == 0 else ("TARDE" if worker_id % 3 == 1 else "NOCHE")

    settings = {
        "nombrePuesto": sector,
        "operador": f"FULL-W{worker_id}",
        "supervisor": f"FSUP-W{worker_id}",
        "permanencia": f"{random.randint(1, 8)}H",
    }

    units = make_units(worker_id, sector, date_str, shift)

    try:
        resp = requests.post(EXEC_URL, json={
            "action": "saveShiftData", "dateStr": date_str, "shift": shift, "settings": settings, "units": units
        }, timeout=60)
        with stats_lock:
            stats["total"] += 1
            if resp.status_code == 200 and resp.json().get("success"):
                stats["ok"] += 1
            else:
                stats["fail"] += 1
    except Exception as e:
        with stats_lock:
            stats["total"] += 1
            stats["fail"] += 1

    log(f"[U{worker_id}:{sector}] {len(units)} units OK ({int(time.time()-start_time)}s)")


def run_scenario(num_users, worker_fn, label):
    global start_time
    log(f"\n--- {label} ({num_users} usuarios) ---")

    start_time = time.time()
    threads = []
    for wid in range(1, num_users + 1):
        t = threading.Thread(target=worker_fn, args=(wid,))
        threads.append(t)
        t.start()
        time.sleep(random.uniform(0.2, 1))

    last_total = 0
    while any(t.is_alive() for t in threads):
        time.sleep(3)
        with stats_lock:
            if stats["total"] > last_total:
                elapsed = int(time.time() - start_time)
                log(f"  [{elapsed}s] {stats['total']} req | OK: {stats['ok']} FAIL: {stats['fail']}")
                last_total = stats["total"]

    for t in threads:
        t.join()

    elapsed = int(time.time() - start_time)
    log(f"\n=== RESULTADOS: {label} ===")
    log(f"Duracion: {elapsed}s")
    log(f"Total: {stats['total']} | OK: {stats['ok']} | FAIL: {stats['fail']}")
    if stats["total"] > 0:
        log(f"Tasa: {stats['ok']/elapsed:.1f} ops/s")
    if stats["errors"]:
        log(f"Errores ({len(stats['errors'])}):")
        for e in stats["errors"][:5]:
            log(f"  {e}")
    log("")


def main():
    log("=" * 50)
    log("PRUEBAS DE CONCURRENCIA - FIREBASE")
    log("=" * 50)

    try:
        r = requests.post(EXEC_URL, json={"action": "ping"}, timeout=10)
        if r.status_code != 200:
            log(f"ERROR: /exec responde HTTP {r.status_code}")
            return
        log("OK - /exec responde\n")
    except Exception as e:
        log(f"ERROR conectando a /exec: {e}")
        return

    arg = sys.argv[1] if len(sys.argv) > 1 else "14u"

    scenarios = {
        "14u": (14, worker_updateUnit, "14 usuarios - updateUnit"),
        "30u": (30, worker_updateUnit, "30 usuarios - updateUnit (10C+10M+10S c/u)"),
        "30f": (30, worker_saveShiftData, "30 usuarios - saveShiftData (10C+10M+10S c/u)"),
    }

    if arg == "all":
        for key in ["14u", "30u", "30f"]:
            n, fn, label = scenarios[key]
            run_scenario(n, fn, label)
            stats.update({"ok": 0, "fail": 0, "total": 0, "errors": []})
    elif arg in scenarios:
        n, fn, label = scenarios[arg]
        run_scenario(n, fn, label)
    else:
        log(f"Uso: python concurrency_test.py [14u|30u|30f|all]")
        log("  14u: 14 usuarios, updateUnit (default)")
        log("  30u: 30 usuarios, updateUnit")
        log("  30f: 30 usuarios, saveShiftData (flujo completo)")
        log("  all: los 3 en secuencia")


if __name__ == "__main__":
    main()
