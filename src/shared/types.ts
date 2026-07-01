/**
 * Tipos compartidos entre el page script, el content script y la UI.
 * El objeto Widget viaja por postMessage entre los tres contextos:
 * este es su contrato.
 */

export interface WidgetEventParam {
  letter: string;
  name: string;
  desc: string;
  value: string;
}

export type WidgetEventSource = 'inline' | 'jquery';

export interface WidgetEvent {
  source: WidgetEventSource;
  event: string;
  raw: string;
  parsedParams: WidgetEventParam[];
  ownerId: string | null;
}

export interface ClientAPIMethod {
  name: string;
  arity: number;
  callable: boolean;
}

export type WidgetMetadata = Record<string, string | number | boolean | null>;

export interface Widget {
  widgetVar: string;
  id: string;
  type: string;
  clientAPI: ClientAPIMethod[];
  targetId: string | null;
  events: WidgetEvent[];
  metadata: WidgetMetadata;
  exists: boolean;
}

export interface PageInfo {
  hasPrimeFaces: boolean;
  version: string | null;
  hasPrimeFacesExt: boolean;
  versionExt: string | null;
  hasJQuery: boolean;
  widgetCount: number;
}

/** Parámetros interceptados de una llamada PrimeFaces.ab() */
export interface AjaxInfo {
  source: string | null;
  formId: string | null;
  process: string | null;
  update: string | null;
}

/** Inicio de una petición Ajax JSF interceptada a nivel de XHR (timeline) */
export interface AjaxRequestStart {
  /** Identificador único de la petición dentro de la página */
  id: string;
  url: string;
  method: string;
  source: string | null;
  process: string | null;
  update: string | null;
  event: string | null;
  /** Payload de la petición (urlencoded, truncado) */
  requestBody: string;
  /** Timestamp epoch ms del envío */
  ts: number;
}

/** Finalización de una petición Ajax JSF interceptada (timeline) */
export interface AjaxRequestDone {
  id: string;
  /** Código de estado HTTP (0 si la petición falló en red) */
  status: number;
  /** true si HTTP 2xx y la partial-response no contiene <error> */
  ok: boolean;
  durationMs: number;
  /** IDs de los <update id="..."> aplicados por la respuesta */
  updates: string[];
  errorName: string | null;
  errorMessage: string | null;
  redirect: string | null;
  /** Cuerpo de la respuesta (truncado) */
  responseBody: string;
}

/** Entrada del historial Ajax: inicio + (cuando llega) el resultado */
export interface AjaxLogEntry extends AjaxRequestStart {
  pending: boolean;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  updates?: string[];
  errorName?: string | null;
  errorMessage?: string | null;
  redirect?: string | null;
  responseBody?: string;
}

/** Disparo de un evento capturado en vivo por el monitor */
export interface FiredEvent {
  widgetVar: string | null;
  ownerId: string | null;
  /** Tipo de evento DOM (click, change, keyup…) */
  event: string;
  source: WidgetEventSource;
  /** Timestamp epoch ms del disparo */
  ts: number;
  /** Resumen legible de los argumentos del evento */
  detail: string;
}

/** Resultado de ejecutar un método del Client API o un evento inline */
export interface ExecResult {
  success: boolean;
  widgetVar: string;
  method: string;
  hasResult?: boolean;
  result?: string;
  error?: string;
  callId?: string | null;
  argsCount?: number;
}
