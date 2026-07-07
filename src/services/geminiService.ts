import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = () => {
  // Check for both standard and user-selected keys
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  
  if (!key || key === 'undefined' || key === 'YOUR_API_KEY_HERE' || key.length < 10) {
    throw new Error("Gemini API key is missing or invalid. Please ensure you have set the GEMINI_API_KEY in your environment or selected a key via the platform.");
  }
  return key;
};

export interface ScreeningData {
  name: string;
  age: number;
  gender: string;
  history: string;
  symptoms: string[];
  images: string[]; // base64 strings
  previousReport?: any;
  trackingData?: any;
  segmentationData?: any[];
  cardCalibration?: any;
}

export const analyzeVision = async (data: ScreeningData) => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  // Using Flash model by default to avoid quota issues and improve speed
  const model = "gemini-3-flash-preview";

  const extraParts: any[] = [];
  let previousReportText = '';
  
  if (data.previousReport) {
    if (typeof data.previousReport === 'string' && data.previousReport.startsWith('data:')) {
      const mimeType = data.previousReport.split(';')[0].split(':')[1];
      const base64Data = data.previousReport.split(',')[1];
      extraParts.push({
        inlineData: { mimeType, data: base64Data }
      });
      previousReportText = "PREVIOUS REPORT DATA: (See attached document/image)";
    } else {
      previousReportText = `PREVIOUS REPORT DATA: ${typeof data.previousReport === 'string' ? data.previousReport : JSON.stringify(data.previousReport)}`;
    }
  }

  let datasetContext = '';
  try {
    const res = await fetch('/dataset/Dry_Eye_Dataset.csv');
    if (res.ok) {
      const csvText = await res.text();
      extraParts.push({
        inlineData: {
          mimeType: "text/csv",
          data: btoa(unescape(encodeURIComponent(csvText.substring(0, 500000)))) 
        }
      });
      datasetContext = "CLINICAL DATASET REFERENCE: Compare patient's symptoms (duration, screen time) with the attached Dry_Eye_Dataset.csv to calculate Dry Eye Risk Probability.";
    }
  } catch(e) { console.error("Could not load dataset", e); }
  
  const prompt = `
    You are an AI preliminary vision-screening assistant. 
    Analyze the following patient data and eye images (provided as base64) from a 3-phase scan:
    Phase 1: Whole Face (Alignment & Symmetry)
    Phase 2: Focused Eyes (High-res iris/pupil)
    Phase 3: Close-up Eye Capture (Detailed surface/closure)
    
    Patient Info:
    Name: ${data.name}
    Age: ${data.age}
    Gender: ${data.gender}
    Eye History: ${data.history}
    Subjective Symptoms: ${data.symptoms.join(", ")}
    Blink Count detected: ${data.trackingData?.blinkCount || 'N/A'}
    
    DEDICATED CNN MODEL ANALYSIS (Clinical Formulas):
    - Status: ${data.trackingData?.cnnResults?.isStabilized ? `Stabilized (Averaged over ${data.trackingData?.cnnResults?.frameCount} frames)` : 'Single Frame'}
    - Myopia Risk: ${data.trackingData?.cnnResults?.myopiaRisk || 'N/A'}
    - Astigmatism Pattern Risk: ${data.trackingData?.cnnResults?.astigmatismRisk || 'N/A'}
    - Pupil Asymmetry: ${data.trackingData?.cnnResults?.pupilAsymmetry || 'N/A'}
    - Abnormal Corneal Reflections: ${data.trackingData?.cnnResults?.cornealReflectionAbnormality || 'N/A'}
    - Classification Insights: ${data.trackingData?.cnnResults?.classifications?.join(", ") || 'N/A'}
    
    PUPILLARY DISTANCE CALIBRATION (Reference Object):
    - Calibration Method: ${data.cardCalibration ? 'Standard Credit Card (85.6mm)' : 'Iris-based Assumption (11.7mm)'}
    - Scaling Factor: ${data.cardCalibration?.scalingFactor ? `${data.cardCalibration.scalingFactor.toFixed(4)} mm/px` : 'N/A'}
    - Confidence: ${data.cardCalibration?.confidence ? `${(data.cardCalibration.confidence * 100).toFixed(0)}%` : 'N/A'}
    
    EYE SEGMENTATION DATA (U-Net/DeepLabV3+ Simulation):
    ${data.segmentationData ? data.segmentationData.map((seg, i) => `
    Image ${i+1}:
    - Iris Diameter: ${seg.irisDiameterPx?.toFixed(2)}px
    - Pupil Diameter: ${seg.pupilDiameterPx?.toFixed(2)}px
    - PD Scaling Factor: ${seg.pdScalingFactor?.toFixed(4)} mm/px
    - Corneal Reflections: ${seg.cornealReflections?.length} detected
    `).join('\n') : 'No segmentation data available.'}
    
    ${previousReportText}
    ${datasetContext}

    IMPORTANT: This is NOT a medical diagnosis. 
    Even if the images are not perfectly clear, provide your best-effort preliminary screening based on the available visual data and patient-reported symptoms. 
    Provide estimates for:
    1. Refractive Error (SPH, CYL, AXIS) for both eyes.
    2. Pupillary Distance (PD).
    3. Probabilities for Myopia, Hyperopia, Astigmatism, Amblyopia, Strabismus.
    4. Advanced Condition Risk (0-100%): Cataract, Glaucoma, Diabetic Retinopathy, Macular Degeneration.
    5. Eye Health Classification (Early Signs Detection):
       - Red Eye: Detect redness in the sclera using color analysis.
       - Cataract Glare: Detect abnormal reflections, cloudiness, or opacities in the lens area.
       - Dry Eye: Analyze tear film stability, surface texture, and lid margin inflammation.
       - Eye Fatigue: Analyze muscle strain patterns, dark circles, and heavy lids.
       - Use your knowledge of "eye disease dataset" and "retinal disease dataset" to identify specific clinical markers for these conditions.
    6. Behavioral notes (Pupil reactivity, Fixation stability, Blink rate).
    7. Recommendations: Lens types, Coatings, and Follow-up urgency.
    8. Simple Explanation: A patient-friendly explanation of the findings.
    9. Comparison: If a previous report is provided, compare the current results with the previous ones.
    10. Diet Chart: A recommended diet plan for eye health.
    
    Return the data in a structured JSON format. 
    DO NOT include any markdown formatting like \`\`\`json. 
    Return ONLY the raw JSON object.
  `;

  const imageParts = data.images.map(img => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: img.split(',')[1]
    }
  }));

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: prompt },
          ...extraParts,
          ...imageParts
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.OBJECT,
              properties: {
                rightEye: {
                  type: Type.OBJECT,
                  properties: {
                    sph: { type: Type.NUMBER },
                    cyl: { type: Type.NUMBER },
                    axis: { type: Type.NUMBER },
                    pd: { type: Type.NUMBER },
                    confidence: { type: Type.STRING }
                  }
                },
                leftEye: {
                  type: Type.OBJECT,
                  properties: {
                    sph: { type: Type.NUMBER },
                    cyl: { type: Type.NUMBER },
                    axis: { type: Type.NUMBER },
                    pd: { type: Type.NUMBER },
                    confidence: { type: Type.STRING }
                  }
                }
              }
            },
            defects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  probability: { type: Type.NUMBER },
                  explanation: { type: Type.STRING }
                }
              }
            },
            advancedConditions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  riskScore: { type: Type.NUMBER },
                  notes: { type: Type.STRING }
                }
              }
            },
            observations: {
              type: Type.OBJECT,
              properties: {
                pupilReactivity: { type: Type.STRING },
                fixationStability: { type: Type.STRING },
                blinkRate: { type: Type.STRING },
                alignment: { type: Type.STRING }
              }
            },
            explanation: { type: Type.STRING },
            eyeHealthIndicators: {
              type: Type.OBJECT,
              properties: {
                redEye: {
                  type: Type.OBJECT,
                  properties: {
                    level: { type: Type.STRING },
                    probability: { type: Type.NUMBER }
                  }
                },
                cataractGlare: {
                  type: Type.OBJECT,
                  properties: {
                    level: { type: Type.STRING },
                    probability: { type: Type.NUMBER }
                  }
                },
                dryEye: {
                  type: Type.OBJECT,
                  properties: {
                    level: { type: Type.STRING },
                    probability: { type: Type.NUMBER }
                  }
                },
                eyeFatigue: {
                  type: Type.OBJECT,
                  properties: {
                    level: { type: Type.STRING },
                    probability: { type: Type.NUMBER }
                  }
                },
                blinkRateStatus: { type: Type.STRING }
              }
            },
            comparison: { type: Type.STRING },
            dietChart: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  meal: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                  benefit: { type: Type.STRING }
                }
              }
            },
            recommendations: {
              type: Type.OBJECT,
              properties: {
                glassesNeeded: { type: Type.STRING },
                lensSuggestions: { type: Type.STRING },
                coatings: { type: Type.ARRAY, items: { type: Type.STRING } },
                followUp: { type: Type.STRING },
                urgency: { type: Type.STRING }
              }
            },
            lifestylePlan: {
              type: Type.OBJECT,
              properties: {
                hygiene: { type: Type.STRING },
                exercises: { type: Type.ARRAY, items: { type: Type.STRING } },
                diet: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      console.error("AI returned an empty response.");
      throw new Error("Empty response from AI");
    }
    
    console.log("Raw AI Response Length:", text.length);
    
    try {
      // Clean up the response text more aggressively
      let cleanedText = text.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      return JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", text);
      // Fallback: try to find the first '{' and last '}'
      try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          return JSON.parse(text.substring(start, end + 1));
        }
      } catch (e) {
        console.error("Fallback JSON parsing failed");
      }
      throw new Error("Invalid JSON response from AI. Please try again.");
    }
  } catch (error: any) {
    console.error("Vision Analysis Error Details:", {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

export const chatWithOpticalAI = async (message: string, image?: string) => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: `You are a specialized Optical and Eye Health Assistant. 
                 Answer the user's question accurately. 
                 If the user asks in a specific language, answer in that same language.
                 User Question: ${message}` },
        ...(image ? [{ inlineData: { mimeType: "image/jpeg", data: image.split(',')[1] } }] : [])
      ]
    }
  });
  return response.text;
};
