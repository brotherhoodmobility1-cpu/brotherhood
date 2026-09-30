type Detector = { detect(src: ImageBitmap): Promise<{ rawValue: string }[]> };
type DetectorClass = new (opts?: { formats?: string[] }) => Detector;

/** True if this phone's browser can read barcodes from photos (most Android phones can). */
export const canReadBarcodes = () => typeof window !== "undefined" && "BarcodeDetector" in window;

/** Reads the first barcode or QR code found in a photo. Returns "" if none could be read. */
export async function readBarcode(file: File | Blob): Promise<string> {
  try {
    const BD = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    if (!BD) return "";
    const bmp = await createImageBitmap(file);
    const codes = await new BD().detect(bmp);
    return codes[0]?.rawValue?.trim() ?? "";
  } catch {
    return "";
  }
}
