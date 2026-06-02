"""
loadtest.py — Prueba de carga realista via Playwright.

Simula 10 usuarios (pestañas) guardando unidades constantemente.
Usa Chrome con tu perfil y sesión de Google existente.

Requisitos:
  pip install playwright
  python -m playwright install chromium

Uso:
  1. python loadtest.py
  2. Se abre Chrome con tu perfil real (ya logueado)
  3. El script empieza automaticamente al detectar google.script.run
"""

import os
import json
import time
import random
import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

GAS_URL = "https://script.google.com/a/macros/munisurco.gob.pe/s/AKfycbybalFvc2AV_uDUfjyRrobXAkiQD8alJLCn9dYQPLs/dev"
NUM_TABS = 10
SAVES_PER_TAB = 10
DELAY_BETWEEN_SAVES = (1.0, 3.0)
SECTORS = ["1A", "2A", "3A", "4A", "5A", "6A", "RESCATE", "GIR"]
USER_DATA_DIR = os.path.join(os.environ["LOCALAPPDATA"], "Google", "Chrome", "User Data")

stats = {"ok": 0, "fail": 0, "total": 0}
stats_lock = asyncio.Lock()


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def make_unit(tab_id, seq):
    sector = random.choice(SECTORS)
    return {
        "id": f"PYTEST-T{tab_id}-{seq}",
        "type": random.choice(["CHOFER", "MOTO"]),
        "status": random.choice(["ACTIVO", "COMISION", "PATIO"]),
        "kmStart": str(random.randint(100, 500)),
        "sector": sector,
    }


async def find_gs_page(context):
    """Find or create a page with google.script.run available."""
    for page in context.pages:
        try:
            ready = await page.evaluate(
                "typeof google !== 'undefined' && google.script && typeof google.script.run !== 'undefined'"
            )
            if ready:
                return page
        except:
            pass
    page = context.pages[0] if context.pages else await context.new_page()
    await page.goto(GAS_URL, wait_until="domcontentloaded")
    return page


async def find_gs_iframe(page):
    """Find the innermost iframe#userHtmlFrame that contains google.script.run."""
    try:
        outer_iframe_el = await page.wait_for_selector("iframe", timeout=10000)
        outer = await outer_iframe_el.content_frame()
        inner_el = await outer.wait_for_selector("iframe#userHtmlFrame", timeout=10000)
        inner = await inner_el.content_frame()
        return inner
    except:
        try:
            iframe_el = await page.wait_for_selector("iframe", timeout=5000)
            return await iframe_el.content_frame()
        except:
            return page


async def wait_for_google_script_run(page):
    log("=" * 50)
    log("Esperando google.script.run...")
    log("(Si ves login de Google, inicia sesion con @munisurco.gob.pe)")
    log("=" * 50)
    try:
        await page.evaluate("document.title = '>>> ESPERANDO <<<'")
    except:
        pass

    target = page
    last_url = ""
    was_on_login = False
    start = time.time()
    while True:
        try:
            url = page.url
            if url != last_url:
                log(f"URL: {url[:80]}")
                last_url = url

            if "accounts.google.com" in url or "ServiceLogin" in url:
                was_on_login = True
                await page.evaluate("document.title = '>>> INICIA SESION EN GOOGLE <<<'")
                await asyncio.sleep(3)
                continue
            elif was_on_login:
                log("Login detectado - redirigiendo a la app...")
                was_on_login = False
                await page.goto(GAS_URL, wait_until="domcontentloaded")
                await asyncio.sleep(5)
                # Try to find iframe after navigation
                target = await find_gs_iframe(page)
                log("Buscando google.script.run en el iframe...")
                continue

            if target == page and "script.google.com" in url:
                target = await find_gs_iframe(page)
                if target != page:
                    log("Iframe#userHtmlFrame encontrado")

            ready = await target.evaluate(
                "typeof google !== 'undefined' && google.script && typeof google.script.run !== 'undefined'"
            )
            if ready:
                log("¡google.script.run detectado!")
                return target

            elapsed = int(time.time() - start)
            if elapsed > 0 and elapsed % 15 == 0:
                log(f"[{elapsed}s] Esperando google.script.run...")
        except Exception as e:
            pass
        await asyncio.sleep(3)


async def run_tab(context, tab_id):
    try:
        page = await context.new_page()
        await page.goto(GAS_URL, wait_until="domcontentloaded")
        log(f"[Tab {tab_id}] Cargando...")

        # Navigate into GAS iframe stack to reach google.script.run
        page = await find_gs_iframe(page)
        log(f"[Tab {tab_id}] Iframe encontrado")

        # Wait for google.script.run
        await page.wait_for_function(
            "typeof google !== 'undefined' && google.script && typeof google.script.run !== 'undefined'",
            timeout=30000
        )
        log(f"[Tab {tab_id}] google.script.run disponible")

        date_str = datetime.now().strftime("%Y-%m-%d")
        shift = "MAÑANA"

        for seq in range(1, SAVES_PER_TAB + 1):
            unit = make_unit(tab_id, seq)
            settings = {"nombrePuesto": unit["sector"], "operador": f"PYOP-T{tab_id}"}

            try:
                result = await page.evaluate(
                    """
                    ([date, shift, settings, unit]) => new Promise((resolve) => {
                        google.script.run
                            .withSuccessHandler(resolve)
                            .withFailureHandler((err) => resolve({success: false, error: String(err)}))
                            .updateUnit(date, shift, settings, unit);
                    })
                    """,
                    [date_str, shift, settings, unit]
                )

                async with stats_lock:
                    stats["total"] += 1
                    if result.get("success"):
                        stats["ok"] += 1
                    else:
                        stats["fail"] += 1
                        log(f"[Tab {tab_id}] FAIL seq={seq}: {result.get('error', 'unknown')}")

            except Exception as e:
                async with stats_lock:
                    stats["total"] += 1
                    stats["fail"] += 1
                log(f"[Tab {tab_id}] ERROR seq={seq}: {e}")

            await asyncio.sleep(random.uniform(*DELAY_BETWEEN_SAVES))

    except Exception as e:
        log(f"[Tab {tab_id}] FATAL: {e}")
    finally:
        try:
            await page.close()
        except:
            pass


async def main():
    log(f"=== PRUEBA DE CARGA: {NUM_TABS} USUARIOS, {SAVES_PER_TAB} SAVES C/U ===")
    log(f"Total: {NUM_TABS * SAVES_PER_TAB} saves")
    log(f"URL: {GAS_URL}\n")

    async with async_playwright() as p:
        log("Iniciando Chrome con tu perfil...")
        context = await p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=False,
            args=["--no-first-run", "--disable-search-engine-choice-screen"]
        )

        page = await find_gs_page(context)
        page = await wait_for_google_script_run(page)

        tasks = []
        for tab_id in range(1, NUM_TABS + 1):
            task = asyncio.create_task(run_tab(context, tab_id))
            tasks.append(task)
            await asyncio.sleep(0.5)

        last_total = 0
        while any(not t.done() for t in tasks):
            await asyncio.sleep(3)
            async with stats_lock:
                if stats["total"] > last_total:
                    pct = stats["total"] / (NUM_TABS * SAVES_PER_TAB) * 100
                    log(f"Progreso: {stats['total']}/{NUM_TABS * SAVES_PER_TAB} ({pct:.0f}%) | OK: {stats['ok']} FAIL: {stats['fail']}")
                    last_total = stats["total"]

        await asyncio.gather(*tasks)

        log("")
        log("=== RESULTADOS FINALES ===")
        log(f"Total: {stats['total']} | OK: {stats['ok']} | FAIL: {stats['fail']}")

        await context.close()
        log("Chrome cerrado.")


if __name__ == "__main__":
    asyncio.run(main())
