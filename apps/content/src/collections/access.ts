import type { Access, PayloadRequest } from 'payload';
export function operator(req: PayloadRequest) {
  return req.user?.collection === 'admins';
}
export function administrator(req: PayloadRequest) {
  return operator(req) && 'role' in (req.user ?? {}) && req.user?.role === 'admin';
}
export const isOperator: Access = ({ req }) => operator(req);
export const isAdministrator: Access = ({ req }) => administrator(req);
