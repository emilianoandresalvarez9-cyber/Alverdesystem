import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);

if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error("Alverde requiere Node.js 22 o superior. Instala Node.js LTS y vuelve a abrir Iniciar-Alverde.cmd.");
  process.exit(1);
}

const envPath = join(root, ".env.local");
const envKeys = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function readEnvFile() {
  if (!existsSync(envPath)) return new Map();
  const values = new Map();
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

function validConfig(url, key) {
  if (!url || !key || key.trim().length <= 20 || /replace-with|your-project/i.test(key)) return false;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    if (parsed.protocol === "https:") return true;
    return parsed.protocol === "http:" && localHosts.has(parsed.hostname);
  } catch {
    return false;
  }
}

function saveConfig(url, key) {
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  for (const name of envKeys) {
    const value = name === envKeys[0] ? url : key;
    const pattern = new RegExp("^\\s*" + name + "\\s*=");
    const index = lines.findIndex((line) => pattern.test(line));
    if (index >= 0) lines[index] = name + "=" + value;
    else lines.push(name + "=" + value);
  }
  mkdirSync(root, { recursive: true });
  writeFileSync(envPath, lines.join("\n").replace(/\n*$/, "\n"), { encoding: "utf8", mode: 0o600 });
}

async function ensureConfig() {
  const fileValues = readEnvFile();
  const urlFromProcess = process.env.VITE_SUPABASE_URL?.trim();
  const keyFromProcess = process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if ((urlFromProcess && !validConfig(urlFromProcess, keyFromProcess || fileValues.get(envKeys[1]))) ||
      (keyFromProcess && !validConfig(urlFromProcess || fileValues.get(envKeys[0]), keyFromProcess))) {
    console.error("Las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY del entorno no son válidas. Corrígelas o quítalas y vuelve a iniciar.");
    process.exit(1);
  }

  let url = urlFromProcess || fileValues.get(envKeys[0]) || "";
  let key = keyFromProcess || fileValues.get(envKeys[1]) || "";
  if (validConfig(url, key)) return { url, key };

  if (!stdin.isTTY || !stdout.isTTY) {
    console.error("Falta configurar Supabase. Ejecuta npm run local en una terminal interactiva; la primera vez te pedirá la URL y la clave pública (anon/publishable).");
    process.exit(1);
  }

  console.log("Primera ejecución: configura una vez el acceso al proyecto Supabase.");
  console.log("Usa la URL del proyecto y su clave pública anon/publishable. Nunca pegues una service_role key.");
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    url = (await prompt.question("URL de Supabase: ")).trim();
    key = (await prompt.question("Clave pública anon/publishable: ")).trim();
  } finally {
    prompt.close();
  }

  if (!validConfig(url, key)) {
    console.error("La URL o la clave no parece válida. No guardé la configuración.");
    process.exit(1);
  }

  saveConfig(url, key);
  console.log("Configuración guardada en .env.local (archivo ignorado por Git).");
  return { url, key };
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd")
    });
    child.on("error", (error) => {
      console.error("No se pudo iniciar " + command + ": " + error.message);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const config = await ensureConfig();
const parsedUrl = new URL(config.url);
if (!localHosts.has(parsedUrl.hostname)) {
  console.warn("AVISO: conectado a Supabase remoto (" + parsedUrl.host + "). Las operaciones de la web se guardan en ese proyecto.");
  console.warn("Para pruebas destructivas, usa un proyecto o datos de prueba; este comando no crea una base aislada.");
}

const lockPath = join(root, "package-lock.json");
const markerPath = join(root, "node_modules", ".alverde-package-lock.sha256");
const lockHash = createHash("sha256").update(readFileSync(lockPath)).digest("hex");
let installedHash = "";
if (existsSync(markerPath)) installedHash = readFileSync(markerPath, "utf8").trim();

if (!existsSync(join(root, "node_modules", "vite", "bin", "vite.js")) || installedHash !== lockHash) {
  console.log("Instalando dependencias fijadas por package-lock.json (solo hace falta de nuevo si cambian).");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const installCode = await run(npm, ["ci"]);
  if (installCode !== 0) process.exit(installCode);
  writeFileSync(markerPath, lockHash + "\n", "utf8");
}

const networkHost = process.argv.includes("--network");
if (networkHost) console.warn("Acceso habilitado para otros dispositivos de la red local; úsalo solo en una red privada.");
console.log("Abriendo Alverde en http://localhost:5173 (Ctrl+C para detener).");
const vitePath = join(root, "node_modules", "vite", "bin", "vite.js");
const host = networkHost ? "0.0.0.0" : "127.0.0.1";
const serverCode = await run(process.execPath, [vitePath, "--host", host, "--open"]);
process.exitCode = serverCode;
