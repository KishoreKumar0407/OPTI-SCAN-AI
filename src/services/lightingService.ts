export interface LightingAnalysis {
  brightness: number; // 0-255
  contrast: number; // 0-255
  isAdequate: boolean;
  message: string;
}

export class LightingService {
  private static readonly BRIGHTNESS_THRESHOLD = 80;
  private static readonly CONTRAST_THRESHOLD = 30;

  static analyzeFrame(canvas: HTMLCanvasElement): LightingAnalysis {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { brightness: 0, contrast: 0, isAdequate: false, message: "Could not analyze lighting" };
    }

    if (canvas.width === 0 || canvas.height === 0) {
      return { brightness: 0, contrast: 0, isAdequate: false, message: "Invalid image dimensions" };
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let totalBrightness = 0;
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      // Relative luminance formula: 0.299R + 0.587G + 0.114B
      const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      totalBrightness += brightness;
      histogram[Math.round(brightness)]++;
    }

    const avgBrightness = totalBrightness / (canvas.width * canvas.height);

    // Calculate contrast (standard deviation of brightness)
    let sumSquaredDiff = 0;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sumSquaredDiff += Math.pow(brightness - avgBrightness, 2);
    }
    const contrast = Math.sqrt(sumSquaredDiff / (canvas.width * canvas.height));

    let isAdequate = true;
    let message = "Lighting is optimal";

    if (avgBrightness < this.BRIGHTNESS_THRESHOLD) {
      isAdequate = false;
      message = "Too dark. Please move to a brighter area.";
    } else if (contrast < this.CONTRAST_THRESHOLD) {
      isAdequate = false;
      message = "Low contrast. Ensure light is hitting your face directly.";
    }

    return {
      brightness: avgBrightness,
      contrast,
      isAdequate,
      message
    };
  }
}
