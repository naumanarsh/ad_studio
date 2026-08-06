export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | void> {
  return { ok: true, data: data as T };
}

export function fail<T = void>(
  error: string,
  fieldErrors?: FieldErrors,
): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}
