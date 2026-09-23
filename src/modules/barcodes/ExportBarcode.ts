export async function downloadSvgAsPng(svgElementId: string, filename: string): Promise<void> {
  const svg = document.getElementById(svgElementId);
  if (!svg) throw new Error("SVG element not found");

  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  // Set dimensions based on SVG bounding box or explicit attributes
  const svgSize = svg.getBoundingClientRect();
  const width = svgSize.width || 300;
  const height = svgSize.height || 100;
  
  // Scale for higher resolution print (RF-33c)
  const scale = 4;
  canvas.width = width * scale;
  canvas.height = height * scale;

  if (!ctx) throw new Error("Could not get 2d context");
  
  // Fill background
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width * scale, height * scale);
      URL.revokeObjectURL(url);
      
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas to Blob failed"));
          return;
        }
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = filename;
        link.href = pngUrl;
        link.click();
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}
