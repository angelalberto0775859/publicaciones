import { jsPDF } from "jspdf";
import { ExportFormat, OutputSize } from "@/lib/studio-options";

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("No se pudo preparar la imagen para exportar"));
  });
  return image;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function exportVariationImage(
  previewUrl: string,
  variationId: string,
  outputSizes: OutputSize[],
  exportFormats: ExportFormat[]
) {
  const image = await loadImage(previewUrl);

  for (const outputSize of outputSizes) {
    const width = Math.max(outputSize.width, 320);
    const height = Math.max(outputSize.height, 320);
    const hdMultiplier = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * hdMultiplier;
    canvas.height = height * hdMultiplier;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo crear el contexto de exportacion");

    context.setTransform(hdMultiplier, 0, 0, hdMultiplier, 0, 0);
    const fitsContain = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * fitsContain;
    const drawHeight = image.height * fitsContain;
    const dx = (width - drawWidth) / 2;
    const dy = (height - drawHeight) / 2;

    for (const format of exportFormats) {
      if (format === "jpg" || format === "pdf") {
        context.fillStyle = "#090c16";
        context.fillRect(0, 0, width, height);
      } else {
        context.clearRect(0, 0, width, height);
      }
      context.drawImage(image, dx, dy, drawWidth, drawHeight);

      if (format === "pdf") {
        const jpegData = canvas.toDataURL("image/jpeg", 0.95);
        const pdf = new jsPDF({
          orientation: width >= height ? "landscape" : "portrait",
          unit: "px",
          format: [width, height]
        });
        pdf.addImage(jpegData, "JPEG", 0, 0, width, height);
        pdf.save(`${variationId}-${outputSize.key}-${width}x${height}.pdf`);
        continue;
      }

      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      const quality = format === "jpg" ? 0.95 : undefined;
      const finalDataUrl = canvas.toDataURL(mime, quality);
      downloadDataUrl(finalDataUrl, `${variationId}-${outputSize.key}-${width}x${height}.${format}`);
    }
  }
}

