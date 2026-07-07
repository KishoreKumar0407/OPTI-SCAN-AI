import React, { useRef, useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { EyeAnalysisCNN, CNNAnalysisResult } from '../services/visionCnnModel';
import { EyeSegmentationService, SegmentationResult } from '../services/eyeSegmentationService';

export const EyeTracker = ({ onUpdate, onCapture }: { onUpdate: (data: any) => void, onCapture?: (image: string, segmentation?: SegmentationResult) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [detector, setDetector] = useState<any>(null);
  const [lighting, setLighting] = useState<number>(0);
  const [blinkCount, setBlinkCount] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [alignmentStatus, setAlignmentStatus] = useState('Aligning...');
  const [tilt, setTilt] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const frameBufferRef = useRef<any[]>([]);
  const BUFFER_SIZE = 20;

  // Store latest landmarks for segmentation
  const latestLandmarksRef = useRef<any>(null);

  // Expose capture method via window for simplicity in this demo structure
  useEffect(() => {
    (window as any).captureEyeImage = async () => {
      if (videoRef.current && captureCanvasRef.current) {
        const ctx = captureCanvasRef.current.getContext('2d');
        if (ctx) {
          const { videoWidth, videoHeight } = videoRef.current;
          // Only draw if we have dimensions
          if (videoWidth > 0 && videoHeight > 0) {
            ctx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
            const dataUrl = captureCanvasRef.current.toDataURL('image/jpeg', 0.8);
            
            let segmentation;
            // Perform Segmentation if landmarks are available
            if (latestLandmarksRef.current) {
              try {
                const { leftEye, rightEye, leftIris, rightIris } = latestLandmarksRef.current;
                segmentation = await EyeSegmentationService.segmentEye(
                  captureCanvasRef.current,
                  [...leftEye, ...rightEye],
                  [...leftIris, ...rightIris]
                );
              } catch (e) {
                console.warn("Segmentation failed during capture", e);
              }
            }

            if (onCapture) onCapture(dataUrl, segmentation);
            return { dataUrl, segmentation };
          }
        }
      }
      return null;
    };
    return () => { delete (window as any).captureEyeImage; };
  }, [onCapture]);

  const [isStarting, setIsStarting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    if (isStarting) return;
    setIsStarting(true);
    setCameraError(null);

    if (!window.isSecureContext) {
      setCameraError("Camera access requires a secure context (HTTPS or localhost). Please ensure you are using a secure connection.");
      setIsStarting(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Your browser does not support camera access or it is blocked by security policy.");
      setIsStarting(false);
      return;
    }

    try {
      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user', 
          width: { ideal: 1280, min: 640 }, 
          height: { ideal: 720, min: 480 } 
        } 
      });
      
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && canvasRef.current && captureCanvasRef.current) {
            const { videoWidth, videoHeight } = videoRef.current;
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;
            captureCanvasRef.current.width = videoWidth;
            captureCanvasRef.current.height = videoHeight;
          }
        };
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      let msg = "Camera access failed.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "Camera access denied. Please enable camera permissions in your browser settings and refresh.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = "No camera found on this device.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = "Camera is already in use by another application or tab.";
      } else if (err.name === 'SecurityError') {
        msg = "Camera access blocked by security policy. Ensure you are using HTTPS.";
      } else {
        msg = `Camera error: ${err.message || 'Unknown error'}`;
      }
      setCameraError(msg);
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      setTilt({ alpha: e.alpha || 0, beta: e.beta || 0, gamma: e.gamma || 0 });
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  useEffect(() => {
    let newDetector: any = null;
    let isMounted = true;
    
    const loadModel = async () => {
      try {
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshTfjsModelConfig = {
          runtime: 'tfjs',
          refineLandmarks: true,
        };
        newDetector = await faceLandmarksDetection.createDetector(model, detectorConfig);
        if (isMounted) setDetector(newDetector);
      } catch (err) {
        if (isMounted) console.error("Failed to load face detector", err);
      }
    };
    loadModel();
    
    return () => {
      isMounted = false;
      if (newDetector && typeof newDetector.dispose === 'function') {
        newDetector.dispose();
      }
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      startCamera();
    }, 500); // Small delay to allow previous component to release camera
    return () => {
      clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const onUpdateRef = useRef(onUpdate);
  const tiltRef = useRef(tilt);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    tiltRef.current = tilt;
  }, [tilt]);

  useEffect(() => {
    let animationId: number;
    let lastUpdate = 0;

    const detect = async () => {
      if (detector && videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          animationId = requestAnimationFrame(detect);
          return;
        }

        // Ensure canvas matches video dimensions if not already set
        if (canvasRef.current.width !== video.videoWidth) {
          canvasRef.current.width = video.videoWidth;
          canvasRef.current.height = video.videoHeight;
        }
        if (captureCanvasRef.current && captureCanvasRef.current.width !== video.videoWidth) {
          captureCanvasRef.current.width = video.videoWidth;
          captureCanvasRef.current.height = video.videoHeight;
        }

        let faces: any[] = [];
        try {
          faces = await detector.estimateFaces(video);
        } catch (tfError) {
          console.error("TFJS FaceMesh Error:", tfError);
          // Instead of crashing the loop forever, we delay retry slightly
          animationId = requestAnimationFrame(detect);
          return;
        }
        
        const ctx = canvasRef.current.getContext('2d');
        
        if (ctx && faces.length > 0) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          const face = faces[0];
          const keypoints = face.keypoints;
          
          // Draw eye landmarks
          const leftEye = keypoints.filter((k: any) => k.name === 'leftEye');
          const rightEye = keypoints.filter((k: any) => k.name === 'rightEye');
          const leftIris = keypoints.filter((k: any) => k.name === 'leftIris');
          const rightIris = keypoints.filter((k: any) => k.name === 'rightIris');
          
          latestLandmarksRef.current = { leftEye, rightEye, leftIris, rightIris };

          // CNN Model Analysis (Implementing Clinical Formulas)
          const cnnResults = EyeAnalysisCNN.classify(
            leftEye, 
            rightEye, 
            leftIris, 
            rightIris, 
            face.box
          );
          
          ctx.fillStyle = '#10b981';
          [...leftEye, ...rightEye].forEach((kp: any) => {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 1, 0, 2 * Math.PI);
            ctx.fill();
          });

          // Blink Detection
          const leftUpper = keypoints[159].y;
          const leftLower = keypoints[145].y;
          const rightUpper = keypoints[386].y;
          const rightLower = keypoints[374].y;
          
          const leftOpenness = Math.abs(leftUpper - leftLower);
          const rightOpenness = Math.abs(rightUpper - rightLower);
          const avgOpenness = (leftOpenness + rightOpenness) / 2;
          
          const faceHeight = face.box.height;
          const threshold = faceHeight * 0.015;
          
          let currentBlinking = isBlinking;
          if (avgOpenness < threshold && !isBlinking) {
            currentBlinking = true;
            setIsBlinking(true);
            setBlinkCount(prev => prev + 1);
          } else if (avgOpenness > threshold * 1.5) {
            currentBlinking = false;
            setIsBlinking(false);
          }

          // Alignment Check
          const noseTip = keypoints[1];
          const centerX = canvasRef.current.width / 2;
          const centerY = canvasRef.current.height / 2;
          const dist = Math.sqrt(Math.pow(noseTip.x - centerX, 2) + Math.pow(noseTip.y - centerY, 2));
          
          let currentAlignment = alignmentStatus;
          if (dist < 60) {
            currentAlignment = 'Perfect Alignment';
            setAlignmentStatus('Perfect Alignment');
          } else {
            currentAlignment = 'Center your face';
            setAlignmentStatus('Center your face');
          }

          // Lighting analysis
          const faceBox = face.box;
          const sx = Math.max(0, faceBox.xMin);
          const sy = Math.max(0, faceBox.yMin);
          const sw = Math.min(faceBox.width, canvasRef.current.width - faceBox.xMin);
          const sh = Math.min(faceBox.height, canvasRef.current.height - faceBox.yMin);

          let avgBrightness = 0;
          if (sw > 0 && sh > 0) {
            const faceData = ctx.getImageData(sx, sy, sw, sh);
            let brightness = 0;
            for (let i = 0; i < faceData.data.length; i += 4) {
              brightness += (faceData.data[i] + faceData.data[i+1] + faceData.data[i+2]) / 3;
            }
            avgBrightness = brightness / (faceData.data.length / 4 || 1);
            setLighting(avgBrightness);
          }

          // Temporal Averaging Logic
          frameBufferRef.current.push({
            leftIris,
            rightIris,
            leftEye,
            rightEye,
            box: face.box,
            timestamp: Date.now()
          });

          if (frameBufferRef.current.length > BUFFER_SIZE) {
            frameBufferRef.current.shift();
          }

          let stabilizedCnnResults = cnnResults;
          if (frameBufferRef.current.length >= 5) {
            // Calculate average pupil positions and remove outliers
            const getAverageIris = (irisType: 'leftIris' | 'rightIris') => {
              const positions = frameBufferRef.current.map(f => {
                const iris = f[irisType];
                if (!iris || iris.length === 0) return null;
                // Use center of iris (average of iris keypoints)
                const sumX = iris.reduce((acc: number, kp: any) => acc + kp.x, 0);
                const sumY = iris.reduce((acc: number, kp: any) => acc + kp.y, 0);
                return { x: sumX / iris.length, y: sumY / iris.length };
              }).filter(p => p !== null) as {x: number, y: number}[];

              if (positions.length === 0) return null;

              const meanX = positions.reduce((acc, p) => acc + p.x, 0) / positions.length;
              const meanY = positions.reduce((acc, p) => acc + p.y, 0) / positions.length;

              // Outlier removal (Standard Deviation)
              const stdX = Math.sqrt(positions.reduce((acc, p) => acc + Math.pow(p.x - meanX, 2), 0) / positions.length);
              const stdY = Math.sqrt(positions.reduce((acc, p) => acc + Math.pow(p.y - meanY, 2), 0) / positions.length);

              const filtered = positions.filter(p => 
                Math.abs(p.x - meanX) <= (stdX * 2 || 1) && 
                Math.abs(p.y - meanY) <= (stdY * 2 || 1)
              );

              if (filtered.length === 0) return { x: meanX, y: meanY };

              return {
                x: filtered.reduce((acc, p) => acc + p.x, 0) / filtered.length,
                y: filtered.reduce((acc, p) => acc + p.y, 0) / filtered.length
              };
            };

            const avgLeftIrisPos = getAverageIris('leftIris');
            const avgRightIrisPos = getAverageIris('rightIris');

            if (avgLeftIrisPos && avgRightIrisPos) {
              // Re-run CNN analysis with averaged positions for higher accuracy
              // We'll use the latest eye contours but the averaged iris centers
              stabilizedCnnResults = EyeAnalysisCNN.classify(
                leftEye,
                rightEye,
                [{ x: avgLeftIrisPos.x, y: avgLeftIrisPos.y, name: 'leftIris' }],
                [{ x: avgRightIrisPos.x, y: avgRightIrisPos.y, name: 'rightIris' }],
                face.box
              );
              (stabilizedCnnResults as any).isStabilized = true;
              (stabilizedCnnResults as any).frameCount = frameBufferRef.current.length;
            }
          }

          // Throttle parent updates to 10fps to prevent re-render loops and performance issues
          const now = Date.now();
          if (now - lastUpdate > 100) {
            if (onUpdateRef.current) {
              onUpdateRef.current({
                faces,
                lighting: avgBrightness,
                blink: currentBlinking,
                blinkCount,
                alignment: currentAlignment,
                tilt: tiltRef.current,
                cnnResults: stabilizedCnnResults // Use stabilized results if available
              });
            }
            lastUpdate = now;
          }
        }
      }
      animationId = requestAnimationFrame(detect);
    };

    if (detector) detect();
    return () => cancelAnimationFrame(animationId);
  }, [detector]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden border-4 border-white shadow-2xl bg-slate-900">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-cover -scale-x-100"
      />
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full -scale-x-100 object-cover"
      />
      <canvas 
        ref={captureCanvasRef} 
        className="hidden"
      />

      {/* Camera Error Overlay */}
      {cameraError && (
        <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-500">
            <Camera size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Camera Error</h3>
            <p className="text-slate-400 text-sm max-w-xs">{cameraError}</p>
          </div>
          <button 
            onClick={startCamera}
            className="px-6 py-3 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-100 transition-all"
          >
            Retry Camera
          </button>
        </div>
      )}

      {/* AR Alignment Guide */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`w-64 h-64 border-2 rounded-full transition-all duration-300 ${alignmentStatus === 'Perfect Alignment' ? 'border-emerald-500 scale-105 bg-emerald-500/10' : 'border-white/20'}`}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-white/40 rounded-full" />
        </div>
      </div>
      
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <div className={`w-2 h-2 rounded-full ${lighting > 50 && lighting < 200 ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-white text-[10px] font-bold uppercase tracking-widest">
              {lighting < 50 ? 'Too Dark' : lighting > 200 ? 'Too Bright' : 'Lighting OK'}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <span className="text-white text-[10px] font-bold uppercase tracking-widest">
              Blinks: {blinkCount}
            </span>
          </div>
        </div>

        <div className="text-right space-y-2">
          <div className={`px-4 py-2 rounded-2xl backdrop-blur-md border ${alignmentStatus === 'Perfect Alignment' ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-black/40 border-white/10'}`}>
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest mb-1">Alignment</p>
            <p className={`text-sm font-bold ${alignmentStatus === 'Perfect Alignment' ? 'text-emerald-400' : 'text-white'}`}>{alignmentStatus}</p>
          </div>
        </div>
      </div>

      {/* Tilt Warning */}
      {(Math.abs(tilt.beta) > 15 || Math.abs(tilt.gamma) > 15) && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-rose-500 text-white px-4 py-2 rounded-full text-[10px] font-bold animate-bounce shadow-lg">
          HOLD PHONE STRAIGHT
        </div>
      )}
    </div>
  );
};
