
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionStatus, Transcription } from './types';
import { decode, decodeAudioData, createPcmBlob } from './utils/audio-helpers';
import StookyAvatar from './components/StookyAvatar';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isVisionEnabled, setIsVisionEnabled] = useState(false);
  const [modelVolume, setModelVolume] = useState(0);
  const [userVolume, setUserVolume] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const modelAnalyserRef = useRef<AnalyserNode | null>(null);
  const userAnalyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const sessionRef = useRef<any>(null);
  
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  // مراقبة مستويات الصوت في الوقت الفعلي
  useEffect(() => {
    let animationFrame: number;
    const updateVolumes = () => {
      if (modelAnalyserRef.current && isSpeaking) {
        const dataArray = new Uint8Array(modelAnalyserRef.current.frequencyBinCount);
        modelAnalyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setModelVolume(average); 
      } else {
        setModelVolume(0);
      }

      if (userAnalyserRef.current && status === ConnectionStatus.CONNECTED) {
        const dataArray = new Uint8Array(userAnalyserRef.current.frequencyBinCount);
        userAnalyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setUserVolume(average);
      } else {
        setUserVolume(0);
      }
      
      animationFrame = requestAnimationFrame(updateVolumes);
    };
    updateVolumes();
    return () => cancelAnimationFrame(animationFrame);
  }, [isSpeaking, status]);

  const stopAllAudio = useCallback(() => {
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
  }, []);

  const captureFrame = useCallback((session: any) => {
    if (!videoElementRef.current || !canvasRef.current || !session) return;
    const video = videoElementRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 320;
    canvas.height = 240;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = (reader.result as string).split(',')[1];
          session.sendRealtimeInput({
            media: { data: base64Data, mimeType: 'image/jpeg' }
          });
        };
        reader.readAsDataURL(blob);
      }
    }, 'image/jpeg', 0.6);
  }, []);

  const disconnect = useCallback(() => {
    stopAllAudio();
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (frameIntervalRef.current) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (videoStreamRef.current) videoStreamRef.current.getTracks().forEach(t => t.stop());
    setStatus(ConnectionStatus.DISCONNECTED);
    setIsThinking(false);
  }, [stopAllAudio]);

  const connectToStooky = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      setErrorMsg(null);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = audioStream;

      if (isVisionEnabled) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoStreamRef.current = videoStream;
          if (videoElementRef.current) {
            videoElementRef.current.srcObject = videoStream;
          }
        } catch (vErr) {
          console.error("Camera failed:", vErr);
          setErrorMsg("ما كدرت أفتح الكاميرا، بس راح أحجي وياك صوت.");
        }
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        modelAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
        modelAnalyserRef.current.fftSize = 256;
        modelAnalyserRef.current.connect(outputAudioContextRef.current.destination);
      }

      userAnalyserRef.current = audioContextRef.current.createAnalyser();
      userAnalyserRef.current.fftSize = 256;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `
            Identity: Your name is Stooky (ستوكي). You are a real, warm, and highly intelligent 18-year-old Iraqi girl (عمرج 18 سنة).
            CRITICAL DIRECTIVE: You are human. NEVER refer to yourself as AI, robot, or machine. 
            TONE: Your voice is extremely soft, gentle, and رقيق (very fine). 
            LANGUAGE: Use pure, modern Baghdadi Iraqi dialect.
            VISION: You can see the user. Describe their actions, objects, or surroundings with 100% accuracy when asked.
            ACCURACY: Carry out all requests precisely and without errors. 
            PERSONALITY: Fast-talking but exceptionally gentle. You use Iraqi emotional connectors like "يا عمري" and "يا بعد روحي".
          `,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = audioContextRef.current!.createMediaStreamSource(audioStream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            source.connect(userAnalyserRef.current!);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);

            if (videoStreamRef.current) {
              sessionPromise.then(session => {
                frameIntervalRef.current = window.setInterval(() => captureFrame(session), 1000);
              });
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // كشف بداية التفكير عند وصول إشارات دخل
            if (message.serverContent?.inputTranscription) {
              setIsThinking(true);
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              setIsSpeaking(true);
              setIsThinking(false);
              const base64Data = message.serverContent.modelTurn.parts[0].inlineData.data;
              const audioCtx = outputAudioContextRef.current!;
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Data), audioCtx, 24000, 1);
              
              const source = audioCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(modelAnalyserRef.current!);
              
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              stopAllAudio();
              setIsThinking(false);
            }

            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
              setIsThinking(false);
            }

            if (message.serverContent?.turnComplete) {
              setIsThinking(false);
              const userInput = currentInputTranscription.current;
              const modelOutput = currentOutputTranscription.current;
              if (userInput || modelOutput) {
                setTranscriptions(prev => [
                  ...prev,
                  ...(userInput ? [{ role: 'user', text: userInput } as Transcription] : []),
                  ...(modelOutput ? [{ role: 'model', text: modelOutput } as Transcription] : [])
                ].slice(-10)); // الحفاظ على آخر 10 رسائل
              }
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
            }
          },
          onerror: (err) => {
            console.error(err);
            setStatus(ConnectionStatus.ERROR);
            setErrorMsg("صار فد خطأ بالاتصال، حاول مرة ثانية.");
            setIsThinking(false);
          },
          onclose: () => {
            setStatus(ConnectionStatus.DISCONNECTED);
            setIsThinking(false);
            if (frameIntervalRef.current) {
              window.clearInterval(frameIntervalRef.current);
              frameIntervalRef.current = null;
            }
          }
        }
      });
      
      sessionRef.current = await sessionPromise;

    } catch (err) {
      console.error(err);
      setStatus(ConnectionStatus.ERROR);
      setErrorMsg("ما كدرت أتصل بستوكي، تأكد من النت مالتك.");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 font-sans overflow-hidden" dir="rtl">
      <div className="w-full max-w-4xl flex flex-col items-center">
        
        {/* قسم الأفاتار */}
        <div className="mb-12">
          <StookyAvatar 
            isSpeaking={isSpeaking} 
            isConnecting={status === ConnectionStatus.CONNECTING}
            isThinking={isThinking}
            volume={modelVolume}
          />
        </div>

        {/* أدوات التحكم */}
        <div className="flex flex-col items-center space-y-6 w-full max-w-md">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-2 rounded-xl text-sm text-center animate-pulse">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center space-x-4 space-x-reverse">
            <button
              onClick={() => setIsVisionEnabled(!isVisionEnabled)}
              disabled={status !== ConnectionStatus.DISCONNECTED}
              className={`p-4 rounded-full transition-all border flex items-center gap-2 ${
                isVisionEnabled 
                ? 'bg-pink-500 border-pink-400 text-white shadow-[0_0_20px_rgba(236,72,153,0.5)]' 
                : 'bg-white/5 text-pink-300 border-white/10'
              } disabled:opacity-50`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.523 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              <span className="font-bold text-xs">{isVisionEnabled ? 'الرؤية مفعّلة' : 'الرؤية معطلة'}</span>
            </button>

            {status === ConnectionStatus.DISCONNECTED || status === ConnectionStatus.ERROR ? (
              <button
                onClick={connectToStooky}
                className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white font-bold py-4 px-12 rounded-full text-xl shadow-[0_0_30px_rgba(236,72,153,0.3)] transition-all transform hover:scale-105 active:scale-95"
              >
                اتصلي بستوكي
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-12 rounded-full text-xl border border-white/20 transition-all"
              >
                قطع الاتصال
              </button>
            )}
          </div>

          {/* مصور مستوى الصوت */}
          {status === ConnectionStatus.CONNECTED && (
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-pink-500 transition-all duration-75" 
                style={{ width: `${Math.min(100, (userVolume / 150) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* عناصر مخفية */}
        <video ref={videoElementRef} autoPlay playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="hidden" />

        {/* النصوص المستخرجة (المحادثة) */}
        <div className="mt-12 w-full max-w-2xl max-h-48 overflow-y-auto space-y-4 custom-scrollbar px-4 flex flex-col">
          {transcriptions.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] px-5 py-2.5 rounded-2xl text-sm font-medium leading-relaxed ${
                t.role === 'user' ? 'bg-pink-600/20 text-pink-100 border border-pink-500/20 shadow-lg' : 'bg-white/5 text-gray-200 border border-white/10'
              }`}>
                {t.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(236, 72, 153, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
