import React, { useState, useRef, useEffect } from 'react';
import ToolFAQ from './components/ToolFAQ';

import BrandedNav from './components/BrandedNav';
import BrandedFooter from './components/BrandedFooter';
import { 
  Upload, Play, Pause, Volume2, VolumeX,
  Settings, Stamp, Video, Image as ImageIcon, MapPin,
  SkipBack, SkipForward, Repeat, Loader2, CheckCircle2, AlertCircle, AlertTriangle
} from 'lucide-react';
import { useToolUsage } from './hooks/useToolUsage';

export default function VideoWatermarker() {
  const { checkUsage, incrementUsage } = useToolUsage();

  const faqs = [
    {
      "question": "What happens if my logo is too big?",
      "answer": "Don't worry! We automatically scale down your watermark image so that it has a maximum width of 100 pixels. This prevents it from accidentally covering up your entire video."
    },
    {
      "question": "Does this work with transparent PNGs?",
      "answer": "Yes! We highly recommend uploading a PNG file with a transparent background for the best watermarking results."
    },
    {
      "question": "Are my files uploaded to a server?",
      "answer": "No, all processing happens locally on your device. Your videos and logos never leave your browser, ensuring complete privacy."
    }
  ];

  const [position, setPosition] = useState('bottom-right');
  
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  
  // Video state
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isLooping, setIsLooping] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('Booting Engine...');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [resultVideoUrl, setResultVideoUrl] = useState(null);
  const [downloadFileName, setDownloadFileName] = useState("");

  const ffmpegRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const loadStarted = useRef(false);

  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;

    const loadFFmpeg = async () => {
      try {
        setLoadingMsg("Fetching Engine...");
        const { createFFmpeg } = window.FFmpeg;
        const ffmpeg = createFFmpeg({
           log: true,
           corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
        });
        ffmpegRef.current = ffmpeg;
        await ffmpeg.load();
        setIsReady(true);
        setLoadingMsg('Engine Loaded');
        setError(null);
      } catch (err) {
        console.error("FFmpeg load error:", err);
        setError("Error: " + (err.message || "Failed to initialize WebAssembly."));
        setLoadingMsg("Failed to Load");
      }
    };
    
    setTimeout(() => {
        if (window.FFmpeg) {
            loadFFmpeg();
        } else {
            setError("Global FFmpeg library failed to inject.");
        }
    }, 500);
  }, []);

  const handleVideoDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('video/')) {
        setVideoFile(f);
        setVideoUrl(URL.createObjectURL(f));
        setError(null);
    } else {
        setError('Please upload a valid video file.');
    }
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) {
        setImageFile(f);
        setImageUrl(URL.createObjectURL(f));
        setError(null);
    } else {
        setError('Please upload a valid image file (PNG or JPG).');
    }
  };

  const handleVideoFileChange = (e) => {
    const f = e.target.files[0];
    if (f && f.type.startsWith('video/')) {
        setVideoFile(f);
        setVideoUrl(URL.createObjectURL(f));
        setError(null);
    } else {
        setError('Please upload a valid video file.');
    }
  };

  const handleImageFileChange = (e) => {
    const f = e.target.files[0];
    if (f && f.type.startsWith('image/')) {
        setImageFile(f);
        setImageUrl(URL.createObjectURL(f));
        setError(null);
    } else {
        setError('Please upload a valid image file (PNG or JPG).');
    }
  };

  // Video controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setVideoProgress(p);
    }
  };

  const handleScrub = (e) => {
    if (videoRef.current) {
      const scrubTime = (e.target.value / 100) * videoRef.current.duration;
      videoRef.current.currentTime = scrubTime;
      setVideoProgress(e.target.value);
    }
  };

  const stepFrame = (forward) => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      videoRef.current.currentTime += forward ? 0.033 : -0.033;
    }
  };

  const handleProcess = async () => {
    if (!checkUsage()) {
      setError("Daily limit reached. Free users can process tools 3 times a day. Please upgrade for unlimited access.");
      return;
    }
    incrementUsage();

    if (!videoFile || !imageFile || !isReady) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setResultVideoUrl(null);
    setProcessProgress(0);
    setDownloadFileName(`watermarked_${videoFile.name.split('.')[0]}`);

    try {
      const ffmpeg = ffmpegRef.current;
      const { fetchFile } = window.FFmpeg;
      
      setLoadingMsg('Uploading to virtual filesystem...');
      
      const ext = imageFile.name.split('.').pop().toLowerCase();
      const imageFileName = `watermark.${ext}`;
      
      ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));
      ffmpeg.FS('writeFile', imageFileName, await fetchFile(imageFile));

      setLoadingMsg('Applying watermark overlay...');
      
      ffmpeg.setProgress(({ ratio }) => {
         if (ratio !== undefined && !isNaN(ratio)) {
             setProcessProgress(Math.min(Math.max(Math.round(ratio * 100), 0), 100));
         }
      });
      
      let overlayPos = '';
      switch (position) {
          case 'top-left': overlayPos = '10:10'; break;
          case 'top-right': overlayPos = 'W-w-10:10'; break;
          case 'bottom-left': overlayPos = '10:H-h-10'; break;
          case 'bottom-right': overlayPos = 'W-w-10:H-h-10'; break;
          default: overlayPos = 'W-w-10:H-h-10';
      }

      // Filter: scale watermark to max 100x100px, then overlay
      const filterComplex = `[1:v]scale=100:100:force_original_aspect_ratio=decrease[wm];[0:v][wm]overlay=${overlayPos}`;
      
      await ffmpeg.run(
        '-i', 'input.mp4',
        '-i', imageFileName,
        '-filter_complex', filterComplex,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-c:a', 'copy', // Copy audio
        'output.mp4'
      );

      setProcessProgress(100);
      setLoadingMsg("Finalizing download...");

      const data = ffmpeg.FS('readFile', 'output.mp4');
      const localVideoUrl = window.URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
      setResultVideoUrl(localVideoUrl);
      
      const sizeMB = (data.buffer.byteLength / (1024 * 1024)).toFixed(2);
      setResult({ message: `Success! Watermark applied (${sizeMB}MB)` });

      ffmpeg.setProgress(() => {});
      ffmpeg.FS('unlink', 'input.mp4');
      ffmpeg.FS('unlink', imageFileName);
      ffmpeg.FS('unlink', 'output.mp4');

    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during watermarking.');
    } finally {
      setIsProcessing(false);
      setProcessProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12">
      
      <BrandedNav />
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
              <Stamp className="text-sky-500" /> AI Video Watermarker
            </h1>
            <p className="text-gray-400 font-medium">Protect and brand your content directly in your browser.</p>
          </div>
          {(videoUrl || imageUrl) && !isProcessing && (
            <button 
              onClick={() => { setVideoFile(null); setVideoUrl(null); setImageFile(null); setImageUrl(null); setResult(null); setError(null); }}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full font-bold text-sm transition-colors border border-white/10"
            >
              Start Over
            </button>
          )}
        </div>

        {(!videoUrl || !imageUrl) ? (
          <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto h-auto min-h-[50vh]">
            {/* Video Dropzone */}
            <div 
              className={`border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center p-8 text-center transition-all cursor-pointer group ${videoUrl ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/10 hover:bg-white/5 hover:border-sky-500/50'}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleVideoDrop}
            >
              {videoUrl ? (
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={32} /></div>
                    <p className="font-bold text-white text-lg px-2 text-center break-all">{videoFile.name}</p>
                    <p className="text-gray-400 text-sm mt-1">Ready for watermark</p>
                </div>
              ) : (
                <>
                    <input type="file" id="video-input" accept="video/*" className="hidden" onChange={handleVideoFileChange} />
                    <label htmlFor="video-input" className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
                        <div className="w-20 h-20 bg-sky-500/10 text-sky-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Video size={32} />
                        </div>
                        <h2 className="text-xl font-black mb-2">Select a Video</h2>
                        <p className="text-gray-400 max-w-xs text-sm">Drag and drop your video file here.</p>
                    </label>
                </>
              )}
            </div>

            {/* Image Dropzone */}
            <div 
              className={`border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center p-8 text-center transition-all cursor-pointer group ${imageUrl ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/10 hover:bg-white/5 hover:border-sky-500/50'}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleImageDrop}
            >
              {imageUrl ? (
                <div className="flex flex-col items-center">
                    <img src={imageUrl} alt="Watermark preview" className="w-24 h-24 object-contain mb-4 rounded-xl border border-white/20" />
                    <p className="font-bold text-white text-lg px-2 text-center break-all">{imageFile.name}</p>
                    <p className="text-gray-400 text-sm mt-1">Logo selected</p>
                </div>
              ) : (
                <>
                    <input type="file" id="image-input" accept="image/*" className="hidden" onChange={handleImageFileChange} />
                    <label htmlFor="image-input" className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
                        <div className="w-20 h-20 bg-sky-500/10 text-sky-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <ImageIcon size={32} />
                        </div>
                        <h2 className="text-xl font-black mb-2">Select Logo</h2>
                        <p className="text-gray-400 max-w-xs text-sm">Drop your PNG logo here (transparent recommended).</p>
                    </label>
                </>
              )}
            </div>
            
            {!videoUrl || !imageUrl ? (
              <div className="md:col-span-2 text-center mt-4">
                  <div className="inline-block px-4 py-2 bg-white/5 rounded-full text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Local Processing • Zero Uploads
                  </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 mt-4">
            {/* Main Preview Area */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full bg-black rounded-3xl border border-white/10 shadow-2xl overflow-hidden shrink-0 aspect-video flex items-center justify-center relative">
                {resultVideoUrl ? (
                  <video 
                    src={resultVideoUrl}
                    className="w-full h-full object-contain bg-zinc-900"
                    controls
                    playsInline
                  />
                ) : (
                  <>
                    <video 
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full h-full object-contain bg-zinc-900"
                        onTimeUpdate={handleTimeUpdate}
                        loop={isLooping}
                        muted={isMuted}
                        playsInline
                    />
                    {/* Simulated watermark overlay for preview */}
                    <div className={`absolute w-16 h-16 opacity-80 pointer-events-none ${
                        position === 'top-left' ? 'top-4 left-4' : 
                        position === 'top-right' ? 'top-4 right-4' : 
                        position === 'bottom-left' ? 'bottom-4 left-4' : 
                        'bottom-4 right-4'
                    }`}>
                        <img src={imageUrl} alt="watermark preview" className="w-full h-full object-contain drop-shadow-md" />
                    </div>
                  </>
                )}
              </div>

              {/* Transport Controls */}
              {!resultVideoUrl && (
                <div className="w-full mt-6 bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => stepFrame(false)} className="p-2 text-gray-400 hover:text-white"><SkipBack size={20} /></button>
                    <button onClick={togglePlay} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                      {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>
                    <button onClick={() => stepFrame(true)} className="p-2 text-gray-400 hover:text-white"><SkipForward size={20} /></button>
                  </div>
                  
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={videoProgress}
                    onChange={handleScrub}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  
                  <div className="flex justify-between mt-4">
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-2 rounded-lg ${isMuted ? 'text-red-400 bg-red-400/10' : 'text-gray-400 hover:text-white'}`}>
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <button onClick={() => setIsLooping(!isLooping)} className={`p-2 rounded-lg ${isLooping ? 'text-sky-400 bg-sky-400/10' : 'text-gray-400 hover:text-white'}`}>
                      <Repeat size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Settings */}
            <div className="w-full lg:w-[350px] space-y-6">
              
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                 <div className="text-sky-200 text-xs">
                   <span className="font-bold text-sky-400">Resolution Notice:</span> 
                   Your logo is automatically scaled to 100px max width for a subtle, professional watermark.
                </div>
              </div>

              {/* Settings */}
              {!result && !isProcessing && (
                <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                    <MapPin size={16} /> Logo Position
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'top-left', label: 'Top Left' },
                      { id: 'top-right', label: 'Top Right' },
                      { id: 'bottom-left', label: 'Bottom Left' },
                      { id: 'bottom-right', label: 'Bottom Right' }
                    ].map((pos) => (
                      <button 
                        key={pos.id}
                        onClick={() => setPosition(pos.id)}
                        className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-all border ${position === pos.id ? 'bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-500/20' : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'}`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              )}

              {result && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-300 mb-4">{result.message}</p>
                  <div className="flex flex-col gap-3">
                    {resultVideoUrl && (
                      <a 
                        href={resultVideoUrl} 
                        download={`${downloadFileName}.mp4`}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-all text-sm"
                      >
                        <Video size={16} />
                        Download Video
                      </a>
                    )}
                  </div>
                </div>
              )}

              {!result && (
                <button 
                  onClick={handleProcess}
                  disabled={isProcessing || !isReady}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl transition-all flex flex-col items-center justify-center gap-2 transform relative overflow-hidden ${
                    isProcessing || !isReady
                      ? 'bg-white/10 text-white/50 cursor-not-allowed'
                      : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20 hover:-translate-y-1'
                  }`}
                >
                  {isProcessing && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300"
                      style={{ width: `${processProgress}%` }}
                    ></div>
                  )}
                  
                  <div className="relative flex items-center gap-2">
                    {(isProcessing || !isReady) ? <Loader2 size={18} className="animate-spin" /> : <Stamp size={18} />}
                    {isProcessing || !isReady ? loadingMsg : 'Apply Watermark'}
                  </div>
                </button>
              )}

            </div>
          </div>
        )}
      </div>

      {/* SEO Sections */}
      <div className="mt-24 space-y-24 max-w-4xl mx-auto px-4">
        {/* How It Works */}
        <section>
          <h2 className="text-3xl font-bold mb-8 text-center">How to Watermark Videos using AI</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-sky-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-sky-500/20">1</div>
              <h3 className="text-xl font-bold mb-3 text-sky-400 mt-2">Add Video</h3>
              <p className="text-gray-400">Import the video file you wish to brand directly into the secure browser environment.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20">2</div>
              <h3 className="text-xl font-bold mb-3 text-blue-400 mt-2">Add Logo</h3>
              <p className="text-gray-400">Upload your logo, preferably a transparent PNG, to use as your branded watermark.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20">3</div>
              <h3 className="text-xl font-bold mb-3 text-indigo-400 mt-2">Positioning</h3>
              <p className="text-gray-400">Select where the logo should appear on the video frame using our placement options.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-purple-500/20">4</div>
              <h3 className="text-xl font-bold mb-3 text-purple-400 mt-2">Download</h3>
              <p className="text-gray-400">Generate the final file and immediately download your securely watermarked video.</p>
            </div>
          </div>
        </section>

        {/* Feature Breakdown */}
        <section>
          <h2 className="text-3xl font-bold mb-8 text-center">Why Use Our Video Watermarker?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">Auto-Scaling</h3>
              <p className="text-gray-400">We automatically resize large logos to fit perfectly on your video, removing the guesswork.</p>
            </div>
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">Perfect Placements</h3>
              <p className="text-gray-400">Snap your watermark perfectly into the corners of your content without complex positioning.</p>
            </div>
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">Complete Privacy</h3>
              <p className="text-gray-400">Since processing is local, your un-watermarked source files are never uploaded online.</p>
            </div>
            <div className="bg-[#0f172a] rounded-2xl p-8 border border-white/5">
              <h3 className="text-2xl font-bold mb-4">Transparent Overlays</h3>
              <p className="text-gray-400">Full alpha-channel support guarantees your PNG logos blend seamlessly with your video.</p>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section>
          <h2 className="text-3xl font-bold mb-8 text-center">Built for Content Creators & Professionals</h2>
          <div className="space-y-6">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row gap-6 items-center">
              <div className="md:w-1/3">
                <h3 className="text-xl font-bold mb-2">Independent Creators</h3>
              </div>
              <div className="md:w-2/3">
                <p className="text-gray-400">Ensure your handle or logo is always visible, preventing others from stealing viral clips.</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row gap-6 items-center">
              <div className="md:w-1/3">
                <h3 className="text-xl font-bold mb-2">Marketing Agencies</h3>
              </div>
              <div className="md:w-2/3">
                <p className="text-gray-400">Quickly apply client logos to batches of promotional video content before distributing them.</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row gap-6 items-center">
              <div className="md:w-1/3">
                <h3 className="text-xl font-bold mb-2">Educators & Coaches</h3>
              </div>
              <div className="md:w-2/3">
                <p className="text-gray-400">Protect premium course material or private coaching sessions with an identifying brand watermark.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ToolFAQ faqs={faqs} />
      <BrandedFooter />
    </div>
  );
}
