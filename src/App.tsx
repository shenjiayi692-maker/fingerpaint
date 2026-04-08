/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Hands, Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Eraser, 
  Palette, 
  Camera as CameraIcon, 
  RefreshCcw, 
  Download,
  Sparkles,
  MousePointer2,
  Hand,
  LayoutTemplate,
  X,
  ChevronRight,
  Sun,
  Home,
  Heart,
  Star,
  Cloud,
  Cat
} from 'lucide-react';
import { cn } from './lib/utils';

interface Point {
  x: number;
  y: number;
  color: string;
  size: number;
  isNewPath?: boolean;
}

const COLORS = [
  '#FF5F5F', // Red
  '#FFBD5F', // Orange
  '#FFEB5F', // Yellow
  '#5FFF7D', // Green
  '#5FBDFF', // Blue
  '#A35FFF', // Purple
  '#FF5FBD', // Pink
  '#FFFFFF', // White
];

const SIZES = [4, 8, 12, 20];

type Language = 'en' | 'zh';

const TRANSLATIONS = {
  en: {
    title: "Magic Finger Paint",
    subtitle: "Pinch your fingers to paint in the air!",
    help: "Help",
    save: "Save Painting",
    clear: "Clear All",
    templates: "Templates",
    templateTitle: "Drawing Templates",
    templateSub: "Click a template to show a trace guide",
    painting: "PAINTING",
    loadingTitle: "Waking up the Magic...",
    loadingSub: "Please allow camera access to start painting",
    guideTitle: "Welcome to Magic Studio!",
    guideSub: "This is a magical studio where you can paint in the air.",
    guideStep1: "Face the camera and hold up your hand.",
    guideStep2: "Pinch your Thumb and Index Finger together to start drawing!",
    guideStep3: "Separate fingers to stop. You can change colors or use templates anytime.",
    guideBtn: "Start My Creation!",
    confirmTitle: "Switch Template",
    confirmSub: "Save current painting before switching? The canvas will be cleared.",
    confirmSave: "Save and Switch",
    confirmClear: "Clear and Switch",
    confirmCancel: "Cancel",
  },
  zh: {
    title: "魔法手指画",
    subtitle: "捏合手指在空气中作画！",
    help: "帮助",
    save: "保存画作",
    clear: "清空画布",
    templates: "模板库",
    templateTitle: "简笔画模板",
    templateSub: "点击模板在画布上显示临摹参考",
    painting: "正在绘画",
    loadingTitle: "正在唤醒魔法...",
    loadingSub: "请允许摄像头访问以开始绘画",
    guideTitle: "欢迎来到魔法画室！",
    guideSub: "这是一个神奇的画室，你可以用手指在空气中作画。",
    guideStep1: "面对摄像头，举起你的手。",
    guideStep2: "将大拇指和食指捏在一起，就可以开始画画啦！",
    guideStep3: "分开手指即停止绘画。你可以随时更换颜色或使用模板。",
    guideBtn: "开始我的创作！",
    confirmTitle: "切换模板",
    confirmSub: "切换模板前，是否需要保存当前的画作？切换后画布将被清空。",
    confirmSave: "保存并切换",
    confirmClear: "直接清空并切换",
    confirmCancel: "取消",
  }
};

const TEMPLATES = [
  { id: 'sun', name: '太阳 (Sun)', icon: Sun, color: 'text-yellow-400' },
  { id: 'house', name: '房子 (House)', icon: Home, color: 'text-orange-400' },
  { id: 'heart', name: '爱心 (Heart)', icon: Heart, color: 'text-red-400' },
  { id: 'star', name: '星星 (Star)', icon: Star, color: 'text-yellow-200' },
  { id: 'cloud', name: '云朵 (Cloud)', icon: Cloud, color: 'text-blue-200' },
  { id: 'cat', name: '小猫 (Cat)', icon: Cat, color: 'text-pink-300' },
];

// Global singleton for Hands to prevent re-initialization errors
let globalHands: Hands | null = null;

const getHands = () => {
  if (!globalHands) {
    globalHands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    globalHands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });
  }
  return globalHands;
};

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [currentSize, setCurrentSize] = useState(SIZES[1]);
  const [points, setPoints] = useState<Point[]>([]);
  const [showGuide, setShowGuide] = useState(true);
  const [isEraser, setIsEraser] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('zh');

  const t = TRANSLATIONS[language];

  // Refs for drawing state to avoid stale closures in the hand tracking callback
  const pointsRef = useRef<Point[]>([]);
  // Track state for each hand independently (index 0 and 1)
  const isPinchingRef = useRef<{ [key: number]: boolean }>({ 0: false, 1: false });
  const lastPointRef = useRef<{ [key: number]: Point | null }>({ 0: null, 1: null });
  const smoothedPointRef = useRef<{ [key: number]: { x: number, y: number } | null }>({ 0: null, 1: null });
  const pinchGraceRef = useRef<{ [key: number]: number }>({ 0: 0, 1: 0 });
  
  // Settings refs to avoid re-initializing Hands when settings change
  const settingsRef = useRef({
    currentColor,
    currentSize,
    isEraser
  });

  // Update settings ref when state changes
  useEffect(() => {
    settingsRef.current = { currentColor, currentSize, isEraser };
  }, [currentColor, currentSize, isEraser]);

  const clearCanvas = () => {
    setPoints([]);
    pointsRef.current = [];
    lastPointRef.current = { 0: null, 1: null };
    smoothedPointRef.current = { 0: null, 1: null };
    const ctx = drawingCanvasRef.current?.getContext('2d');
    if (ctx && drawingCanvasRef.current) {
      ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
    }
  };

  const downloadImage = () => {
    if (!drawingCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'my-magic-painting.png';
    link.href = drawingCanvasRef.current.toDataURL();
    link.click();
  };

  const handleTemplateClick = (templateId: string) => {
    // If canvas is not empty, ask for confirmation
    if (pointsRef.current.length > 0) {
      setPendingTemplateId(templateId);
      setShowConfirmModal(true);
    } else {
      setActiveTemplate(activeTemplate === templateId ? null : templateId);
    }
  };

  const confirmTemplateSwitch = (exportFirst: boolean) => {
    if (exportFirst) {
      downloadImage();
    }
    clearCanvas();
    if (pendingTemplateId) {
      setActiveTemplate(activeTemplate === pendingTemplateId ? null : pendingTemplateId);
    }
    setShowConfirmModal(false);
    setPendingTemplateId(null);
  };

  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current || !videoRef.current || !drawingCanvasRef.current) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    const drawingCtx = drawingCanvasRef.current.getContext('2d');
    if (!canvasCtx || !drawingCtx) return;

    const { currentColor: color, currentSize: size, isEraser: eraser } = settingsRef.current;

    // Set canvas dimensions to match video
    if (canvasRef.current.width !== videoRef.current.videoWidth) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      drawingCanvasRef.current.width = videoRef.current.videoWidth;
      drawingCanvasRef.current.height = videoRef.current.videoHeight;
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Mirror the video
    canvasCtx.translate(canvasRef.current.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    let anyHandPinching = false;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks, index) => {
        // Draw hand skeleton for feedback
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
        drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 3 });

        // Thumb tip is 4, Index tip is 8
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        // Calculate distance between thumb and index
        const distance = Math.sqrt(
          Math.pow(thumbTip.x - indexTip.x, 2) + 
          Math.pow(thumbTip.y - indexTip.y, 2)
        );

        // Threshold for pinching (lowered for more responsive stop)
        const PINCH_THRESHOLD = 0.04;
        const GRACE_FRAMES = 2; // Reduced frames to keep pinching even if distance exceeds threshold
        
        let currentlyPinching = distance < PINCH_THRESHOLD;
        
        if (currentlyPinching) {
          pinchGraceRef.current[index] = GRACE_FRAMES;
        } else if (pinchGraceRef.current[index] > 0) {
          currentlyPinching = true;
          pinchGraceRef.current[index]--;
        }
        
        if (currentlyPinching) {
          anyHandPinching = true;
          // Raw midpoint of pinch
          const rawPinchPoint = {
            x: (1 - (thumbTip.x + indexTip.x) / 2) * canvasRef.current.width,
            y: ((thumbTip.y + indexTip.y) / 2) * canvasRef.current.height
          };

          // Apply smoothing (Exponential Moving Average)
          const SMOOTHING_FACTOR = 0.4;
          const prevSmoothed = smoothedPointRef.current[index];
          const pinchPoint = prevSmoothed ? {
            x: rawPinchPoint.x * SMOOTHING_FACTOR + prevSmoothed.x * (1 - SMOOTHING_FACTOR),
            y: rawPinchPoint.y * SMOOTHING_FACTOR + prevSmoothed.y * (1 - SMOOTHING_FACTOR)
          } : rawPinchPoint;

          smoothedPointRef.current[index] = pinchPoint;

          // Draw a visual indicator for the "brush"
          canvasCtx.restore();
          canvasCtx.save();
          canvasCtx.beginPath();
          canvasCtx.arc(pinchPoint.x, pinchPoint.y, size / 2 + 5, 0, Math.PI * 2);
          canvasCtx.strokeStyle = color;
          canvasCtx.lineWidth = 2;
          canvasCtx.stroke();
          canvasCtx.restore();
          canvasCtx.save();
          canvasCtx.translate(canvasRef.current.width, 0);
          canvasCtx.scale(-1, 1);

          // Drawing logic for this specific hand
          const newPoint: Point = {
            x: pinchPoint.x,
            y: pinchPoint.y,
            color: eraser ? '#00000000' : color,
            size: size,
            isNewPath: !isPinchingRef.current[index]
          };

          // Draw on the persistent canvas
          drawingCtx.lineCap = 'round';
          drawingCtx.lineJoin = 'round';
          
          if (eraser) {
            drawingCtx.globalCompositeOperation = 'destination-out';
          } else {
            drawingCtx.globalCompositeOperation = 'source-over';
            drawingCtx.strokeStyle = color;
          }
          
          drawingCtx.lineWidth = size;

          const lastPoint = lastPointRef.current[index];
          if (lastPoint && !newPoint.isNewPath) {
            drawingCtx.beginPath();
            drawingCtx.moveTo(lastPoint.x, lastPoint.y);
            drawingCtx.lineTo(newPoint.x, newPoint.y);
            drawingCtx.stroke();
          } else {
            drawingCtx.beginPath();
            drawingCtx.arc(newPoint.x, newPoint.y, size / 2, 0, Math.PI * 2);
            drawingCtx.fill();
          }

          lastPointRef.current[index] = newPoint;
          pointsRef.current.push(newPoint);
        } else {
          lastPointRef.current[index] = null;
          smoothedPointRef.current[index] = null;
        }
        
        isPinchingRef.current[index] = currentlyPinching;
      });
    } else {
      // Reset states if no hands detected
      isPinchingRef.current = { 0: false, 1: false };
      lastPointRef.current = { 0: null, 1: null };
      smoothedPointRef.current = { 0: null, 1: null };
      pinchGraceRef.current = { 0: 0, 1: 0 };
    }

    setIsPinching(anyHandPinching);
    canvasCtx.restore();
  }, []);

  useEffect(() => {
    let isMounted = true;
    let camera: Camera | null = null;
    const hands = getHands();

    const startApp = async () => {
      try {
        hands.onResults((results) => {
          if (isMounted) {
            onResults(results);
          }
        });

        if (videoRef.current && isMounted) {
          camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current && hands && isMounted) {
                try {
                  await hands.send({ image: videoRef.current });
                } catch (e) {
                  // Ignore errors during shutdown
                  if (isMounted) console.error("Hands send error:", e);
                }
              }
            },
            width: 1280,
            height: 720
          });
          
          await camera.start();
          if (isMounted) {
            setIsCameraReady(true);
          }
        }
      } catch (error) {
        console.error("Start app error:", error);
      }
    };

    startApp();

    return () => {
      isMounted = false;
      camera?.stop();
    };
  }, [onResults]);

  return (
    <div className="relative min-h-screen bg-slate-950 overflow-hidden font-sans">
      {/* Main Viewport */}
      <div className="relative w-full h-screen flex items-center justify-center">
        {/* Hidden Video for MediaPipe */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
        />

        {/* Camera Feed with Hand Landmarks */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />

        {/* Drawing Layer */}
        <canvas
          ref={drawingCanvasRef}
          className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
        />

        {/* Trace Overlay */}
        <AnimatePresence>
          {activeTemplate && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.3, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none"
            >
              {(() => {
                const template = TEMPLATES.find(t => t.id === activeTemplate);
                if (!template) return null;
                const Icon = template.icon;
                return <Icon size={400} className={cn("stroke-[1.5]", template.color)} />;
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* UI Overlay */}
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col">
          {/* Header */}
          <header className="p-6 flex justify-between items-start pointer-events-auto">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-display font-extrabold text-white tracking-tight flex items-center gap-2">
                <Sparkles className="text-yellow-400" />
                {t.title}
              </h1>
              <p className="text-slate-300 text-sm font-medium">
                {t.subtitle}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                className="px-4 py-3 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 transition-all border border-white/10 font-bold text-sm"
                title="Switch Language"
              >
                {language === 'en' ? '中文' : 'EN'}
              </button>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className={cn(
                  "p-3 backdrop-blur-md rounded-2xl transition-all border",
                  showTemplates 
                    ? "bg-yellow-400 text-slate-950 border-yellow-400" 
                    : "bg-white/10 text-white border-white/10 hover:bg-white/20"
                )}
                title={t.templates}
              >
                <LayoutTemplate size={20} />
              </button>
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 transition-all border border-white/10"
                title={t.help}
              >
                <Hand size={20} />
              </button>
              <button
                onClick={downloadImage}
                className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white/20 transition-all border border-white/10"
                title={t.save}
              >
                <Download size={20} />
              </button>
              <button
                onClick={clearCanvas}
                className="p-3 bg-red-500/20 backdrop-blur-md rounded-2xl text-red-400 hover:bg-red-500/30 transition-all border border-red-500/20"
                title={t.clear}
              >
                <RefreshCcw size={20} />
              </button>
            </div>
          </header>

          {/* Bottom Toolbar */}
          <div className="mt-auto p-8 flex justify-center pointer-events-auto">
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-[2.5rem] border border-white/10 shadow-2xl flex items-center gap-6"
            >
              {/* Colors */}
              <div className="flex items-center gap-2 px-2 border-r border-white/10">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setCurrentColor(color);
                      setIsEraser(false);
                    }}
                    className={cn(
                      "w-10 h-10 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 border-2",
                      currentColor === color && !isEraser ? "border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <button
                  onClick={() => setIsEraser(true)}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 border-2",
                    isEraser ? "bg-white text-slate-900 border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "bg-white/10 text-white border-transparent"
                  )}
                >
                  <Eraser size={20} />
                </button>
              </div>

              {/* Sizes */}
              <div className="flex items-center gap-4 px-2">
                {SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setCurrentSize(size)}
                    className={cn(
                      "flex items-center justify-center transition-all",
                      currentSize === size ? "text-white" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    <div 
                      className={cn(
                        "rounded-full bg-current",
                        currentSize === size && "ring-2 ring-white ring-offset-4 ring-offset-slate-900"
                      )}
                      style={{ width: size, height: size }}
                    />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Template Gallery Panel */}
        <AnimatePresence>
          {showTemplates && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="absolute top-24 right-6 bottom-24 w-72 z-40 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 flex flex-col pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-display font-bold text-white">{t.templateTitle}</h3>
                <button 
                  onClick={() => setShowTemplates(false)}
                  className="p-2 text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateClick(template.id)}
                      className={cn(
                        "w-full p-4 rounded-2xl border transition-all flex items-center gap-4 group",
                        activeTemplate === template.id
                          ? "bg-yellow-400/20 border-yellow-400/50"
                          : "bg-white/5 border-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className={cn("p-2 rounded-xl bg-slate-800", template.color)}>
                        <Icon size={24} />
                      </div>
                      <span className="text-white font-medium text-left flex-1">
                        {language === 'zh' ? template.name : template.name.split(' (')[1].replace(')', '')}
                      </span>
                      {activeTemplate === template.id && (
                        <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-xs text-slate-400 text-center">
                  {t.templateSub}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Indicator */}
        <div className="absolute top-24 left-6 z-30 pointer-events-none">
          <AnimatePresence>
            {isPinching && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="flex items-center gap-2 bg-green-500/20 backdrop-blur-md px-4 py-2 rounded-full border border-green-500/30 text-green-400 text-sm font-bold"
              >
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                {t.painting}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Loading State */}
        {!isCameraReady && (
          <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 border-4 border-white/10 border-t-yellow-400 rounded-full animate-spin" />
              <Sparkles className="absolute inset-0 m-auto text-yellow-400 animate-pulse" size={32} />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-2">{t.loadingTitle}</h2>
              <p className="text-slate-400">{t.loadingSub}</p>
            </div>
          </div>
        )}

        {/* Guide Modal */}
        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] bg-slate-950/80 backdrop-blur-lg flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900 border border-white/10 p-8 rounded-[3rem] max-w-md w-full shadow-2xl"
              >
                <div className="flex justify-center mb-8">
                  <div className="relative">
                    <div className="w-32 h-32 bg-yellow-400/20 rounded-full flex items-center justify-center">
                      <Hand size={64} className="text-yellow-400" />
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute -top-2 -right-2 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md"
                    >
                      <Sparkles size={24} className="text-yellow-400" />
                    </motion.div>
                  </div>
                </div>

                <h2 className="text-3xl font-display font-extrabold text-white text-center mb-4">
                  {t.guideTitle}
                </h2>
                <p className="text-slate-400 text-center mb-8">
                  {t.guideSub}
                </p>
                
                <div className="space-y-6 mb-8">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-yellow-400/20 rounded-full flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">1</div>
                    <p className="text-slate-300">{t.guideStep1}</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-yellow-400/20 rounded-full flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">2</div>
                    <p className="text-slate-300">{t.guideStep2}</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-yellow-400/20 rounded-full flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">3</div>
                    <p className="text-slate-300">{t.guideStep3}</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowGuide(false)}
                  className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-2xl transition-all active:scale-95 shadow-[0_0_20px_rgba(250,204,21,0.3)]"
                >
                  {t.guideBtn}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {showConfirmModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[70] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl text-center"
              >
                <div className="w-20 h-20 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <LayoutTemplate size={40} className="text-yellow-400" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-2">{t.confirmTitle}</h3>
                <p className="text-slate-400 mb-8">
                  {t.confirmSub}
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => confirmTemplateSwitch(true)}
                    className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    {t.confirmSave}
                  </button>
                  <button
                    onClick={() => confirmTemplateSwitch(false)}
                    className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all active:scale-95"
                  >
                    {t.confirmClear}
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirmModal(false);
                      setPendingTemplateId(null);
                    }}
                    className="w-full py-4 text-slate-500 hover:text-slate-300 font-medium transition-all"
                  >
                    {t.confirmCancel}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
