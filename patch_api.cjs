const fs = require('fs');

let code = fs.readFileSync('src/modules/customers/api.ts', 'utf8');
const startIdx = code.indexOf('/** Alta de cliente');
const endIdx = code.indexOf('/**', startIdx + 10);

const newCode = `/** Alta de cliente (RF-45). Soporta offline (T-13). */
export async function createCustomer(input: { name: string; phone?: string; creditLimit?: number | null }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("El nombre es obligatorio.");

  await enqueueOperation({
    kind: "customer",
    payload: {
      name,
      phone: input.phone?.trim() || null,
      creditLimit: input.creditLimit
    }
  });

  synchronizePendingOperations().catch(console.error);
}

`;

fs.writeFileSync('src/modules/customers/api.ts', code.substring(0, startIdx) + newCode + code.substring(endIdx));
