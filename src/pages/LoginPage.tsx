import { type FormEvent, useState } from "react";
import { hasSupabaseConfig } from "../shared/config/env";
import { signIn, currentSession } from "../shared/auth/session";
import { getSupabase } from "../shared/supabase/client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(undefined);

    try {
      await signIn(email, password);

      // Redirigir según el rol: administrador va a /admin.html, empleado a /catalog.html
      const { data } = await getSupabase()
        .from("profiles")
        .select("role")
        .single();

      const destination = data?.role === "administrator" ? "/admin.html" : "/catalog.html";
      location.assign(destination);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card glass">
        <div className="brand lockup"><span className="brand-mark">A</span><span>Alverde</span></div>
        <p className="eyebrow">Sistema de gestión para dietética</p>
        <h1>Todo el local, claro y en orden.</h1>
        {!hasSupabaseConfig ? (
          <div className="notice">
            <strong>Configuración pendiente.</strong>
            <p>Copiá <code>.env.example</code> a <code>.env.local</code> y cargá las credenciales públicas de Supabase.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>Correo electrónico<input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Contraseña<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {message && <p className="form-error" role="alert">{message}</p>}
            <button className="button" disabled={loading} type="submit">{loading ? "Ingresando…" : "Ingresar"}</button>
          </form>
        )}
      </section>
    </main>
  );
}
