"""
loadtest.py — Prueba de carga para Reporte servicio.

Ejecuta runLoadTest(workers, savesPerWorker) en el servidor (GAS → Firestore).

USO:
  1. Desde el editor de GAS (recomendado):
       En el editor, selecciona runLoadTest y haz clic en "Ejecutar"
       O ejecuta en la consola: runLoadTest(10, 10)

  2. Desde la consola del navegador en la app (ya autenticado):
       google.script.run
         .withSuccessHandler(console.log)
         .withFailureHandler(console.error)
         .runLoadTest(10, 10);

  3. Via HTTP POST a /exec (si esta configurado como Anyone):
       python loadtest.py

  Resultado ejemplo:
    { total: 200, ok: 200, fail: 0, elapsedSeconds: 3.2, opsPerSecond: 62 }
"""

import json
import sys
import requests

EXEC_URL = "https://script.google.com/macros/s/AKfycbwJvmN7e3A8LRSQmcESeum9ohZW_h4M4hTGcC5wZ16UcGewpmgdybDHrCTSQv65We8G/exec"

try:
    import http.client as http_client
    http_client.HTTPConnection.debuglevel = 1
except:
    pass

resp = requests.post(EXEC_URL, json={
    "action": "runLoadTest",
    "numWorkers": 10,
    "savesPerWorker": 10
}, timeout=120)

print(f"HTTP {resp.status_code}")
if resp.status_code == 200:
    result = resp.json()
    print(json.dumps(result, indent=2))
else:
    print(resp.text[:500])
    print()
    print("=" * 50)
    print("No se pudo llamar a /exec (requiere autenticacion).")
    print("Usa el metodo 1 o 2 descritos arriba.")
