import { type FormEvent, useState } from "react";
import { hasSupabaseConfig } from "../shared/config/env";
import { signIn, signOut, currentSession, currentProfile, storeLastProfile } from "../shared/auth/session";
import { homeFor } from "../shared/auth/roles";
import { ThemeToggle } from "../shared/theme/ThemeToggle";
import { Button, Message, TextField } from "../shared/ui";

/**
 * Ingresar (IngresarEscritorio / IngresarCelular del sistema de diseño): marca, título, correo,
 * contraseña e Ingresar. El tema se elige abajo, antes de entrar.
 */
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
      const session = await currentSession();
      if (!session) throw new Error("No se pudo iniciar la sesión. Probá de nuevo.");

      const profile = await currentProfile(session);
      if (!profile.active) {
        await signOut();
        throw new Error("Tu usuario está desactivado. Pedile a la administradora que lo reactive.");
      }
      storeLastProfile(profile); // la primera página ya se dibuja con su marco (RNF-08)
      location.assign(homeFor(profile.role));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <section className="carta login__carta" aria-labelledby="login-titulo">
        <div className="marca">
          <span className="marca__nombre">alverde</span>
          <span className="marca__bajada">Dietética natural</span>
        </div>
        <h1 className="titulo-modal" id="login-titulo">Todo el local, claro y en orden.</h1>
        {!hasSupabaseConfig ? (
          <Message tone="aviso">
            Falta configurar la conexión. Copiá <span className="codigo">.env.example</span> a{" "}
            <span className="codigo">.env.local</span> y cargá las credenciales públicas de Supabase.
          </Message>
        ) : (
          <form className="pila" onSubmit={submit}>
            <TextField label="Correo electrónico" type="email" autoComplete="email" required
              value={email} onChange={(event) => setEmail(event.target.value)} />
            <TextField label="Contraseña" type="password" autoComplete="current-password" required
              value={password} onChange={(event) => setPassword(event.target.value)} />
            {message && <Message tone="error">{message}</Message>}
            <Button type="submit" block loading={loading}>{loading ? "Ingresando…" : "Ingresar"}</Button>
          </form>
        )}
        <div className="fila login__tema"><ThemeToggle /></div>
      </section>
    </main>
  );
}
