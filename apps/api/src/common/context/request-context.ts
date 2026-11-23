import { AsyncLocalStorage } from 'async_hooks';

/** Per-request data that deep services (such as the audit log) need without passing it through every call. */
export interface RequestContext {
  requestId?: string;
  ip?: string;
  /** Set when a service has already written a detailed audit entry for this request. */
  audited?: boolean;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const currentRequest = (): RequestContext | undefined => requestContext.getStore();
