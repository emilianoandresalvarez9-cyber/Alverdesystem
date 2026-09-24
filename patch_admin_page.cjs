const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPage.tsx', 'utf8');

// Add the type
code = code.replace(
  '| "barcodes" | "scale" | "branches"',
  '| "barcodes" | "scale" | "scale_manager" | "branches"'
);

// Add the button
code = code.replace(
  '<Button\n            variant={activeTab === "scale" ? "primario" : "fantasma"}\n            onClick={() => setActiveTab("scale")}\n          >\n            ⚖️ Balanza\n          </Button>',
  '<Button\n            variant={activeTab === "scale" ? "primario" : "fantasma"}\n            onClick={() => setActiveTab("scale")}\n          >\n            ⚖️ Balanza\n          </Button>\n          <Button\n            variant={activeTab === "scale_manager" ? "primario" : "fantasma"}\n            onClick={() => setActiveTab("scale_manager")}\n          >\n            ⚙️ Conf. Balanza\n          </Button>'
);

// Add the component
code = code.replace(
  '{activeTab === "scale" && <ScalePresentations />}',
  '{activeTab === "scale" && <ScalePresentations />}\n        {activeTab === "scale_manager" && <ScaleManager />}'
);

fs.writeFileSync('src/pages/AdminPage.tsx', code);
