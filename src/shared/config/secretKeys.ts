/**
 * Claves de Supabase que NUNCA pueden llegar al navegador.
 *
 * Todo lo que empieza con `VITE_` queda escrito dentro del JavaScript publicado: lo puede leer
 * cualquiera que abra el sitio. Eso está bien para la clave pública (anon/publishable), porque
 * lo que protege los datos es RLS. Una clave secreta (`service_role` o `sb_secret_…`) saltea
 * RLS: con ella, cualquiera lee y escribe toda la base. Este módulo la reconoce para que la build
 * se corte antes de publicarla (vite.config.ts) y el cliente se niegue a usarla.
 *
 * Sin APIs del navegador ni de Node: lo usan la app y vite.config.ts.
 */

const SECRET_ROLES = new Set(["service_role", "supabase_admin"]);
const JWT = /^[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}$/;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Decodifica base64url a texto (los JWT de Supabase son ASCII). */
function decodeBase64Url(segment: string): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const char of segment.replace(/=+$/, "")) {
    const index = B64.indexOf(char === "+" ? "-" : char === "/" ? "_" : char);
    if (index < 0) return "";
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  return out;
}

/** El rol que declara un JWT de Supabase, o null si no es un JWT legible. */
export function jwtRole(token: string): string | null {
  const segment = JWT.exec(token.trim())?.[1];
  if (!segment) return null;
  try {
    const payload: unknown = JSON.parse(decodeBase64Url(segment));
    if (payload && typeof payload === "object" && "role" in payload && typeof payload.role === "string") {
      return payload.role;
    }
  } catch {
    return null;
  }
  return null;
}

/** true si la clave saltea RLS: `sb_secret_…` o un JWT con rol `service_role`. */
export function isSecretSupabaseKey(key: string | undefined | null): boolean {
  const value = (key ?? "").trim();
  if (!value) return false;
  if (value.startsWith("sb_secret_")) return true;
  const role = jwtRole(value);
  return role !== null && SECRET_ROLES.has(role);
}

const SECRET_KEY_IN_TEXT = /sb_secret_[A-Za-z0-9_-]{8,}/g;
const JWT_IN_TEXT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

/**
 * Busca claves secretas dentro de un texto (un archivo de la build). Devuelve cuántas encontró
 * de cada tipo, nunca la clave: el mensaje de error de la build no tiene que repetirla.
 */
export function findSecretKeys(text: string): string[] {
  const found: string[] = [];
  const secrets = text.match(SECRET_KEY_IN_TEXT)?.length ?? 0;
  if (secrets > 0) found.push(`${secrets} clave(s) sb_secret_`);
  const serviceJwts = (text.match(JWT_IN_TEXT) ?? []).filter((token) => isSecretSupabaseKey(token)).length;
  if (serviceJwts > 0) found.push(`${serviceJwts} JWT con rol service_role`);
  return found;
}
