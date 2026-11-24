declare const google: any;

export interface AuditEvent {
  action: string;
  actor?: { user?: string; nombre?: string };
  date?: string;
  shift?: string;
  sector?: string;
  entity?: string;
  detail?: string;
}

/**
 * Envía el evento de auditoría en paralelo, sin esperar respuesta.
 * Así el guardado de la unidad no queda detrás de una escritura en Sheets.
 */
export const logAuditEvent = (event: AuditEvent): void => {
  if (typeof google === 'undefined' || !google.script || !google.script.run) return;
  try {
    google.script.run
      .withFailureHandler((err: any) => {
        console.warn('[AUDIT_LOG] No se pudo registrar:', err && err.message ? err.message : err);
      })
      .appendAuditLog(event);
  } catch (e) {
    console.warn('[AUDIT_LOG] No se pudo enviar el evento:', e);
  }
};
