import QRCode from "qrcode";

/** QR dibujado como SVG (sin imágenes externas ni innerHTML). */
export default function QrJuego({ texto, titulo }) {
  const qr = QRCode.create(texto, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const datos = qr.modules.data;
  const margen = 3;
  let ruta = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (datos[y * n + x]) ruta += `M${x + margen} ${y + margen}h1v1h-1z`;
    }
  }
  const lado = n + margen * 2;
  return (
    <svg className="adm-qr" viewBox={`0 0 ${lado} ${lado}`} role="img" aria-label={titulo} shapeRendering="crispEdges">
      <rect width={lado} height={lado} fill="#ffffff" />
      <path d={ruta} fill="#1b1410" />
    </svg>
  );
}
