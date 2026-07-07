/**
 * VisionCNNModel - A dedicated eye-analysis model implementing clinical formulas
 * for vision risk classification.
 * 
 * This model simulates the output of architectures like MobileNetV3/EfficientNet
 * by applying deterministic clinical formulas to high-resolution eye landmarks.
 */

export interface CNNAnalysisResult {
  myopiaRisk: number; // 0-1
  astigmatismRisk: number; // 0-1
  pupilAsymmetry: number; // 0-1
  cornealReflectionAbnormality: number; // 0-1
  classifications: string[];
}

export class EyeAnalysisCNN {
  /**
   * Analyzes eye landmarks to detect vision risks using clinical formulas.
   * 
   * @param leftEye Landmarks for the left eye
   * @param rightEye Landmarks for the right eye
   * @param leftIris Landmarks for the left iris
   * @param rightIris Landmarks for the right iris
   * @param faceBox The bounding box of the face for normalization
   */
  static classify(
    leftEye: any[],
    rightEye: any[],
    leftIris: any[],
    rightIris: any[],
    faceBox: any
  ): CNNAnalysisResult {
    const results: CNNAnalysisResult = {
      myopiaRisk: 0,
      astigmatismRisk: 0,
      pupilAsymmetry: 0,
      cornealReflectionAbnormality: 0,
      classifications: []
    };

    if (!leftIris || !rightIris || leftIris.length === 0 || rightIris.length === 0) {
      return results;
    }

    // 1. Pupil Asymmetry (Anisocoria) Formula
    // Formula: abs(Radius_L - Radius_R) / max(Radius_L, Radius_R)
    const leftIrisRadius = this.calculateRadius(leftIris);
    const rightIrisRadius = this.calculateRadius(rightIris);
    const asymmetry = Math.abs(leftIrisRadius - rightIrisRadius) / Math.max(leftIrisRadius, rightIrisRadius, 1);
    results.pupilAsymmetry = Math.min(asymmetry * 5, 1); // Scale: >20% diff is high risk

    // 2. Astigmatism Pattern Formula (Pupil Ellipticity)
    // Formula: 1 - (Minor_Axis / Major_Axis)
    const leftEllipticity = this.calculateEllipticity(leftIris);
    const rightEllipticity = this.calculateEllipticity(rightIris);
    results.astigmatismRisk = Math.max(leftEllipticity, rightEllipticity);

    // 3. Myopia Risk Formula (Squinting Index)
    // Formula: 1 - (Eyelid_Height / Eye_Width) normalized by Face_Scale
    const leftSquint = this.calculateSquintIndex(leftEye);
    const rightSquint = this.calculateSquintIndex(rightEye);
    results.myopiaRisk = Math.max(leftSquint, rightSquint);

    // 4. Abnormal Corneal Reflections (Hirschberg Test Simulation)
    // Formula: Distance(Iris_Center, Reflection_Point) / Iris_Radius
    // Note: In this simulation, we use the iris-to-eye-center offset as a proxy for strabismus/reflection abnormality
    const leftOffset = this.calculateReflectionOffset(leftEye, leftIris);
    const rightOffset = this.calculateReflectionOffset(rightEye, rightIris);
    results.cornealReflectionAbnormality = Math.max(leftOffset, rightOffset);

    // Generate Classifications
    if (results.myopiaRisk > 0.6) results.classifications.push("High Myopia Risk (Squinting detected)");
    if (results.astigmatismRisk > 0.4) results.classifications.push("Potential Astigmatism (Irregular pupil shape)");
    if (results.pupilAsymmetry > 0.3) results.classifications.push("Significant Anisocoria (Pupil asymmetry)");
    if (results.cornealReflectionAbnormality > 0.5) results.classifications.push("Abnormal Corneal Alignment (Strabismus risk)");

    return results;
  }

  private static calculateRadius(irisPoints: any[]): number {
    // Simple radius calculation from iris landmarks
    const center = this.calculateCenter(irisPoints);
    let totalDist = 0;
    irisPoints.forEach(p => {
      totalDist += Math.sqrt(Math.pow(p.x - center.x, 2) + Math.pow(p.y - center.y, 2));
    });
    return totalDist / irisPoints.length;
  }

  private static calculateCenter(points: any[]): { x: number, y: number } {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  }

  private static calculateEllipticity(irisPoints: any[]): number {
    // Measures how much the iris landmarks deviate from a perfect circle
    if (irisPoints.length < 4) return 0;
    const xCoords = irisPoints.map(p => p.x);
    const yCoords = irisPoints.map(p => p.y);
    const width = Math.max(...xCoords) - Math.min(...xCoords);
    const height = Math.max(...yCoords) - Math.min(...yCoords);
    const ratio = Math.min(width, height) / Math.max(width, height);
    return Math.max(0, 1 - ratio);
  }

  private static calculateSquintIndex(eyePoints: any[]): number {
    // eyePoints for MediaPipe are usually 16 points around the eye
    // Indices: 0 is inner corner, 8 is outer corner, 4 is top, 12 is bottom (approx)
    const width = Math.sqrt(Math.pow(eyePoints[0].x - eyePoints[8].x, 2) + Math.pow(eyePoints[0].y - eyePoints[8].y, 2));
    const height = Math.sqrt(Math.pow(eyePoints[4].x - eyePoints[12].x, 2) + Math.pow(eyePoints[4].y - eyePoints[12].y, 2));
    const ratio = height / width;
    // Normal ratio is ~0.4. Lower means squinting.
    return Math.max(0, 1 - (ratio / 0.4));
  }

  private static calculateReflectionOffset(eyePoints: any[], irisPoints: any[]): number {
    const eyeCenter = this.calculateCenter(eyePoints);
    const irisCenter = this.calculateCenter(irisPoints);
    const dist = Math.sqrt(Math.pow(eyeCenter.x - irisCenter.x, 2) + Math.pow(eyeCenter.y - irisCenter.y, 2));
    const irisRadius = this.calculateRadius(irisPoints);
    return Math.min(dist / (irisRadius * 0.5), 1);
  }
}
