"""
loadtest.py — Prueba de carga realista via Selenium.

Simula 10 usuarios (pestañas) guardando unidades constantemente.
Usa Chrome con tu sesión de Google existente.

Requisitos:
  pip install selenium webdriver-manager

Uso:
  1. Cierra Chrome completamente
  2. python loadtest.py
  3. En la ventana de Chrome que se abre, loguéate en Google si es necesario
  4. El script empieza automáticamente al detectar google.script.run
"""

import os
import json
import time
import random
import threading
import subprocess
import psutil
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, JavascriptException
from webdriver_manager.chrome import ChromeDriverManager

GAS_URL = "https://script.google.com/a/macros/munisurco.gob.pe/s/AKfycbybalFvc2AV_uDUfjyRrobXAkiQD8alJLCn9dYQPLs/dev"
NUM_TABS = 10
SAVES_PER_TAB = 10
DELAY_BETWEEN_SAVES = (1.0, 3.0)
SECTORS = ["1A", "2A", "3A", "4A", "5A", "6A", "RESCATE", "GIR"]

stats = {"ok": 0, "fail": 0, "total": 0}
stats_lock = threading.Lock()

TEST_PROFILE_DIR = os.path.join(os.environ["LOCALAPPDATA"], "Google", "Chrome", "User Data", "LoadTestProfile")


def kill_chrome():
    import psutil
    for proc in ["chrome.exe", "chromedriver.exe"]:
        for p in psutil.process_iter(["name", "pid"]):
            try:
                if p.info["name"] == proc:
                    p.kill()
                    p.wait(3)
            except:
                pass
    time.sleep(3)
    for f in ["LOCK", "SingletonLock", "SingletonSocket"]:
        p = os.path.join(TEST_PROFILE_DIR, f)
        try:
            if os.path.exists(p):
                os.remove(p)
        except:
            pass
    remaining = [p for p in psutil.process_iter(["name"]) if p.info["name"] == "chrome.exe"]
    if remaining:
        log(f"ADVERTENCIA: {len(remaining)} procesos Chrome siguen activos")


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


def run_tab(driver, tab_id):
    try:
        driver.switch_to.new_window("tab")
        driver.get(GAS_URL)
        log(f"[Tab {tab_id}] Cargando...")

        wait = WebDriverWait(driver, 20)

        try:
            iframe = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "iframe")))
            driver.switch_to.frame(iframe)
            log(f"[Tab {tab_id}] Iframe encontrado")
        except:
            log(f"[Tab {tab_id}] Sin iframe, probando ventana principal...")

        try:
            nested = driver.find_elements(By.CSS_SELECTOR, "iframe")
            if nested:
                driver.switch_to.frame(nested[0])
                log(f"[Tab {tab_id}] Iframe anidado encontrado")
        except:
            pass

        log(f"[Tab {tab_id}] Esperando google.script.run...")

        def google_ready(d):
            return d.execute_script(
                "return typeof google !== 'undefined' && google.script && typeof google.script.run !== 'undefined'"
            )

        wait.until(google_ready)
        log(f"[Tab {tab_id}] google.script.run disponible")

        date_str = datetime.now().strftime("%Y-%m-%d")
        shift = "MAÑANA"

        for seq in range(1, SAVES_PER_TAB + 1):
            unit = make_unit(tab_id, seq)
            settings = {"nombrePuesto": unit["sector"], "operador": f"PYOP-T{tab_id}"}

            try:
                result = driver.execute_script(
                    """
                    return new Promise((resolve) => {
                        google.script.run
                            .withSuccessHandler(resolve)
                            .withFailureHandler((err) => resolve({success: false, error: String(err)}))
                            .updateUnit(arguments[0], arguments[1], arguments[2], arguments[3]);
                    });
                    """,
                    date_str, shift, settings, unit
                )

                with stats_lock:
                    stats["total"] += 1
                    if result.get("success"):
                        stats["ok"] += 1
                    else:
                        stats["fail"] += 1
                        log(f"[Tab {tab_id}] FAIL seq={seq}: {result.get('error', 'unknown')}")

            except JavascriptException as e:
                with stats_lock:
                    stats["total"] += 1
                    stats["fail"] += 1
                log(f"[Tab {tab_id}] JS ERROR seq={seq}: {e}")

            delay = random.uniform(*DELAY_BETWEEN_SAVES)
            time.sleep(delay)

    except Exception as e:
        log(f"[Tab {tab_id}] FATAL: {e}")
    finally:
        try:
            driver.close()
        except:
            pass


def wait_for_google_script_run(driver):
    log("=" * 50)
    log("INSTRUCCIONES:")
    log("  En la ventana de Chrome que se abrio:")
    log("  1. Ya estamos en la app. Si ves login de Google, inicia sesion con @munisurco.gob.pe")
    log("  2. Espera a que cargue la pantalla principal de Reporte")
    log("  3. El script empezara automaticamente")
    log("  (espera activa - no hay timeout)")
    log("=" * 50)

    try:
        driver.execute_script("document.title = '>>> INICIA SESION EN GOOGLE <<<'")
    except:
        pass

    start = time.time()
    last_url_log = ""
    while True:
        try:
            url = driver.current_url
            if url != last_url_log:
                log(f"URL actual: {url[:80]}")
                last_url_log = url

            if "accounts.google.com" in url:
                elapsed = int(time.time() - start)
                driver.execute_script("document.title = '>>> LOGIN DE GOOGLE - Inicia sesion @munisurco.gob.pe <<<'")
                log(f"[{elapsed}s] Redirigido al login de Google. Inicia sesion en la ventana de Chrome...")
            else:
                driver.execute_script("document.title = '>>> CARGANDO... <<<'")

            ready = driver.execute_script(
                "return typeof google !== 'undefined' && google.script && typeof google.script.run !== 'undefined'"
            )
            if ready:
                elapsed = int(time.time() - start)
                log(f"¡google.script.run detectado! ({elapsed}s) Comenzando prueba...")
                return True
        except Exception as e:
            elapsed = int(time.time() - start)
            if elapsed % 30 == 0:
                log(f"[{elapsed}s] Esperando... (error: {str(e)[:50]})")
        time.sleep(3)


def main():
    log("=== PRUEBA DE CARGA: 10 USUARIOS, 10 SAVES C/U ===")
    log(f"Total: {NUM_TABS * SAVES_PER_TAB} saves")
    log(f"URL: {GAS_URL}\n")

    kill_chrome()

    log("=" * 50)
    log("INICIANDO CHROME CON PERFIL DE PRUEBA")
    log("(PRIMERA VEZ: Debes iniciar sesion manualmente en Google)")
    log("=" * 50)

    options = webdriver.ChromeOptions()
    options.add_argument(f"--user-data-dir={TEST_PROFILE_DIR}")
    options.add_argument("--no-first-run")
    options.add_argument("--disable-search-engine-choice-screen")
    options.add_argument("--start-maximized")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])

    retries = 3
    driver = None
    for attempt in range(retries):
        try:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            driver.set_page_load_timeout(60)
            break
        except Exception as e:
            log(f"Intento {attempt+1}/{retries} falló: {e}")
            kill_chrome()
            time.sleep(5)
    else:
        log("ERROR: No se pudo iniciar Chrome después de varios intentos.")
        return

    driver.get(GAS_URL)
    log("Navegando a la app...")
    time.sleep(5)

    wait_for_google_script_run(driver)

    threads = []
    for tab_id in range(1, NUM_TABS + 1):
        t = threading.Thread(target=run_tab, args=(driver, tab_id))
        threads.append(t)
        t.start()
        time.sleep(0.5)

    last_total = 0
    while any(t.is_alive() for t in threads):
        time.sleep(3)
        with stats_lock:
            if stats["total"] > last_total:
                pct = stats["total"] / (NUM_TABS * SAVES_PER_TAB) * 100
                log(f"Progreso: {stats['total']}/{NUM_TABS * SAVES_PER_TAB} ({pct:.0f}%) | OK: {stats['ok']} FAIL: {stats['fail']}")
                last_total = stats["total"]

    for t in threads:
        t.join()

    log("\n=== RESULTADOS FINALES ===")
    log(f"Total: {stats['total']} | OK: {stats['ok']} | FAIL: {stats['fail']}")

    driver.quit()
    log("Chrome cerrado.")


if __name__ == "__main__":
    main()
