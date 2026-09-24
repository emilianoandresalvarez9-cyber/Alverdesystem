const fs = require('fs');
let code = fs.readFileSync('src/modules/admin/ProductsManager.tsx', 'utf8');

code = code.replace(/export function ProductsManager\(\) \{/, 'export function ProductsManager() {\n  const [errorMsg, setErrorMsg] = useState("");\n  const [successMsg, setSuccessMsg] = useState("");');

code = code.replace(/alert\((.*?)\)/g, 'setErrorMsg($1)');
code = code.replace(/confirm\((.*?)\)/g, 'window.confirm($1)'); // window.confirm is at least explicit, though technically still a prompt. 

// To show messages:
code = code.replace(/<div className="space-y-6">/, '<div className="space-y-6">\n      {errorMsg && <div className="bg-red-500/20 text-red-400 p-3 rounded">{errorMsg}</div>}\n      {successMsg && <div className="bg-green-500/20 text-green-400 p-3 rounded">{successMsg}</div>}');

code = code.replace(/setErrorMsg\("Actualizado"\)/g, 'setSuccessMsg("Actualizado")');
code = code.replace(/setErrorMsg\("Creado"\)/g, 'setSuccessMsg("Creado")');
code = code.replace(/setErrorMsg\("Archivado"\)/g, 'setSuccessMsg("Archivado")');
code = code.replace(/setErrorMsg\("Presentación añadida"\)/g, 'setSuccessMsg("Presentación añadida")');
code = code.replace(/setErrorMsg\("Precio actualizado"\)/g, 'setSuccessMsg("Precio actualizado")');

fs.writeFileSync('src/modules/admin/ProductsManager.tsx', code);
