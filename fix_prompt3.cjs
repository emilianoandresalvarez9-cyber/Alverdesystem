const fs = require('fs');
let c = fs.readFileSync('src/modules/admin/ProductsManager.tsx', 'utf8');

const regex = /const handleUpdatePrice = async \(presId: string, oldPrice: number\) => \{[\s\S]*?setSuccessMsg\("Precio actualizado"\);\s*handleSelectProduct\(selectedProduct\);\s*\}\s*\};/m;
const newHandle = `const handleUpdatePrice = (presId: string, oldPrice: number) => {
    setPricePrompt({presId, oldPrice});
    setNewPriceInput(oldPrice.toString());
  };

  const confirmUpdatePrice = async () => {
    if (!pricePrompt) return;
    const { error } = await sb.from("product_presentations").update({ sale_price: parseFloat(newPriceInput) }).eq("id", pricePrompt.presId);
    if (error) setErrorMsg(error.message);
    else {
      setSuccessMsg("Precio actualizado");
      handleSelectProduct(selectedProduct);
    }
    setPricePrompt(null);
  };`;

c = c.replace(regex, newHandle);

c = c.replace('const [errorMsg, setErrorMsg] = useState("");', 'const [errorMsg, setErrorMsg] = useState("");\n  const [pricePrompt, setPricePrompt] = useState<{presId: string, oldPrice: number} | null>(null);\n  const [newPriceInput, setNewPriceInput] = useState("");');

const modal = `</div>

      {pricePrompt && (
        <div className="modal-overlay">
          <GlassCard className="modal-content">
            <h3>Actualizar Precio (RF-27)</h3>
            <TextField label="Nuevo Precio" type="number" value={newPriceInput} onChange={e => setNewPriceInput(e.target.value)} autoFocus />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--esp-xs)", marginTop: "var(--esp-m)" }}>
              <Button variant="fantasma" onClick={() => setPricePrompt(null)}>Cancelar</Button>
              <Button onClick={confirmUpdatePrice}>Guardar</Button>
            </div>
          </GlassCard>
        </div>
      )}

    </GlassCard>`;

c = c.replace(/<\/div>\s*<\/GlassCard>\s*$/m, modal);

fs.writeFileSync('src/modules/admin/ProductsManager.tsx', c, 'utf8');
