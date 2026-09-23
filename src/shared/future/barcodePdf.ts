export interface LabelData {
  productName: string;
  barcode: string;
  price: number;
  weightOrUnit: string;
}

/**
 * Servicio futuro para exportación de etiquetas de góndola a PDF (RF-33b)
 * o impresión directa en ventana HTML.
 */
export class BarcodePdfService {
  /**
   * Abre una ventana simple de impresión HTML con la etiqueta.
   */
  public static printLabelHtml(label: LabelData): void {
    const printWindow = window.open('', '_blank', 'width=400,height=300');
    if (!printWindow) {
      console.error('No se pudo abrir la ventana de impresión. Verifique los bloqueadores de pop-ups.');
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Imprimir Etiqueta</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
            .label-container { border: 1px solid #000; padding: 20px; width: 300px; margin: auto; }
            .product-name { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
            .price { font-size: 20px; margin-bottom: 10px; }
            .barcode { font-family: 'Courier New', Courier, monospace; font-size: 18px; margin-bottom: 5px; }
            .weight { font-size: 12px; color: #555; }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="product-name">${label.productName}</div>
            <div class="price">$${label.price.toFixed(2)}</div>
            <div class="barcode">*${label.barcode}*</div>
            <div class="weight">${label.weightOrUnit}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  /**
   * Genera un PDF con la etiqueta de góndola.
   * Requiere librería externa como jspdf en el futuro.
   */
  public static async exportToPdf(label: LabelData): Promise<void> {
    console.warn('exportToPdf: Método a implementar con librerías de terceros (ej. jspdf).', label);
    // TODO: Implementar lógica de generación de PDF.
    throw new Error('Not implemented yet. Ready for future integration.');
  }
}
