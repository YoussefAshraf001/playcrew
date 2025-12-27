export default function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  maxWidth = 1280, // optional max width
  quality = 0.7 // JPEG quality 0-1
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = imageSrc;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) return reject(new Error("Canvas context not found"));

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      // Scale down if too wide
      let finalCanvas = canvas;
      if (canvas.width > maxWidth) {
        const scale = maxWidth / canvas.width;
        const scaledCanvas = document.createElement("canvas");
        scaledCanvas.width = canvas.width * scale;
        scaledCanvas.height = canvas.height * scale;
        scaledCanvas
          .getContext("2d")!
          .drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        finalCanvas = scaledCanvas;
      }

      // Export compressed JPEG
      const base64 = finalCanvas.toDataURL("image/jpeg", quality);
      resolve(base64);
    };

    image.onerror = (err) => reject(err);
  });
}
