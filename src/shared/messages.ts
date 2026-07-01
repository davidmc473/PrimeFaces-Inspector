/**
 * Contrato de mensajería del inspector.
 *
 * Único lugar donde se definen los tipos de mensaje PF_INSPECTOR_* que
 * viajan por window.postMessage entre inject/pageScript.js (contexto de
 * la página) y el content script. Usar siempre las constantes MSG y las
 * factory functions; nunca strings sueltos.
 */

import type { AjaxInfo, ExecResult, PageInfo, Widget } from './types.js';

export const MSG = {
  /** content → page: recolectar widgets */
  COLLECT: 'PF_INSPECTOR_COLLECT',
  /** page → content: datos de widgets + info de la página */
  DATA: 'PF_INSPECTOR_DATA',
  /** page → content: interceptada una llamada PrimeFaces.ab() */
  AJAX: 'PF_INSPECTOR_AJAX',
  /** page → content: ids actualizados en una respuesta Ajax */
  UPDATE: 'PF_INSPECTOR_UPDATE',
  /** content → page: ejecutar un método del Client API */
  EXEC_API: 'PF_INSPECTOR_EXEC_API',
  /** content → page: disparar un evento inline (atributo on*) */
  EXEC_EVENT: 'PF_INSPECTOR_EXEC_EVENT',
  /** page → content: resultado de EXEC_API / EXEC_EVENT */
  EXEC_RESULT: 'PF_INSPECTOR_EXEC_RESULT',
  /** content → page: instalar los hooks de Ajax sin recolectar */
  HOOK_AJAX: 'PF_INSPECTOR_HOOK_AJAX',
  /** page → content: el page script está cargado */
  READY: 'PF_INSPECTOR_READY',
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];

export interface CollectMessage {
  type: typeof MSG.COLLECT;
  showJqueryEvents: boolean;
}

export interface DataMessage {
  type: typeof MSG.DATA;
  data: Widget[];
  info: PageInfo;
}

export interface AjaxMessage {
  type: typeof MSG.AJAX;
  data: AjaxInfo;
}

export interface UpdateMessage {
  type: typeof MSG.UPDATE;
  data: string[];
}

export interface ExecApiMessage {
  type: typeof MSG.EXEC_API;
  widgetVar: string;
  method: string;
  args: unknown[];
  callId: string | null;
}

export interface ExecEventMessage {
  type: typeof MSG.EXEC_EVENT;
  ownerId: string;
  eventAttr: string;
  widgetVar: string | null;
}

export interface ExecResultMessage {
  type: typeof MSG.EXEC_RESULT;
  data: ExecResult;
}

export interface HookAjaxMessage {
  type: typeof MSG.HOOK_AJAX;
}

export interface ReadyMessage {
  type: typeof MSG.READY;
}

export type InspectorMessage =
  | CollectMessage
  | DataMessage
  | AjaxMessage
  | UpdateMessage
  | ExecApiMessage
  | ExecEventMessage
  | ExecResultMessage
  | HookAjaxMessage
  | ReadyMessage;

/* ── Factory functions ── */

export function collectMessage(showJqueryEvents: boolean): CollectMessage {
  return { type: MSG.COLLECT, showJqueryEvents };
}

export function dataMessage(data: Widget[], info: PageInfo): DataMessage {
  return { type: MSG.DATA, data, info };
}

export function ajaxMessage(data: AjaxInfo): AjaxMessage {
  return { type: MSG.AJAX, data };
}

export function updateMessage(updatedIds: string[]): UpdateMessage {
  return { type: MSG.UPDATE, data: updatedIds };
}

export function execApiMessage(
  widgetVar: string,
  method: string,
  args: unknown[],
  callId: string | null
): ExecApiMessage {
  return { type: MSG.EXEC_API, widgetVar, method, args, callId };
}

export function execEventMessage(
  ownerId: string,
  eventAttr: string,
  widgetVar: string | null
): ExecEventMessage {
  return { type: MSG.EXEC_EVENT, ownerId, eventAttr, widgetVar };
}

export function execResultMessage(data: ExecResult): ExecResultMessage {
  return { type: MSG.EXEC_RESULT, data };
}

export function readyMessage(): ReadyMessage {
  return { type: MSG.READY };
}

/** Publica un mensaje del inspector en la ventana (misma página). */
export function postInspectorMessage(msg: InspectorMessage): void {
  window.postMessage(msg, '*');
}
