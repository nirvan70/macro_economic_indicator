export type ChartImageFormat = "png" | "jpg" | "webp" | "svg";

const FORMAT_META: Record<
  ChartImageFormat,
  { mime: string; ext: string; quality?: number }
> = {
  png: { mime: "image/png", ext: "png" },
  jpg: { mime: "image/jpeg", ext: "jpg", quality: 0.92 },
  webp: { mime: "image/webp", ext: "webp", quality: 0.92 },
  svg: { mime: "image/svg+xml;charset=utf-8", ext: "svg" },
};

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function prepareSvgClone(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const vb = svg.viewBox.baseVal;
  const width = vb.width || svg.clientWidth || 920;
  const height = vb.height || svg.clientHeight || 340;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  // Opaque white backdrop so JPG/WebP do not turn black.
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);

  return clone;
}

function svgToBlob(svg: SVGSVGElement): Blob {
  const xml = new XMLSerializer().serializeToString(svg);
  return new Blob([xml], { type: FORMAT_META.svg.mime });
}

async function rasterizeSvg(
  svg: SVGSVGElement,
  format: Exclude<ChartImageFormat, "svg">,
  scale = 2,
): Promise<Blob> {
  const clone = prepareSvgClone(svg);
  const width = Number(clone.getAttribute("width")) || 920;
  const height = Number(clone.getAttribute("height")) || 340;
  const blob = svgToBlob(clone);
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("SVG 이미지 변환에 실패했습니다."));
      img.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas를 사용할 수 없습니다.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const meta = FORMAT_META[format];
    const out = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("이미지 생성에 실패했습니다."))),
        meta.mime,
        meta.quality,
      );
    });
    return out;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Download the chart SVG as PNG / JPG / WebP / SVG. */
export async function downloadChartSvg(
  svg: SVGSVGElement,
  format: ChartImageFormat,
  basename: string,
): Promise<void> {
  const safe = basename
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  const meta = FORMAT_META[format];
  const filename = `${safe || "chart"}.${meta.ext}`;

  if (format === "svg") {
    triggerDownload(svgToBlob(prepareSvgClone(svg)), filename);
    return;
  }

  const blob = await rasterizeSvg(svg, format);
  triggerDownload(blob, filename);
}

export const CHART_DOWNLOAD_FORMATS: {
  id: ChartImageFormat;
  label: string;
}[] = [
  { id: "png", label: "PNG" },
  { id: "jpg", label: "JPG" },
  { id: "webp", label: "WebP" },
  { id: "svg", label: "SVG" },
];
