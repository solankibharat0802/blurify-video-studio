// import { useState, useRef, useEffect } from "react";
// import { Play, Pause, Trash2, Square } from "lucide-react";

// // --- Type Definitions ---
// export interface BlurMask {
//   id: string;
//   x: number;
//   y: number;
//   width: number;
//   height: number;
//   startTime: number;
//   endTime: number;
//   intensity: number;
// }

// interface UploadedFile {
//   videoId: string;
//   name: string;
//   size: number;
//   status: string;
// }

// interface VideoEditModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   file: UploadedFile | null;
//   onSaveEdit: (masks: BlurMask[]) => void;
// }

// export const VideoEditModal = ({ isOpen, onClose, file, onSaveEdit }: VideoEditModalProps) => {
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [currentTime, setCurrentTime] = useState(0);
//   const [duration, setDuration] = useState(0);
//   const [blurMasks, setBlurMasks] = useState<BlurMask[]>([]);
//   const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [startPos, setStartPos] = useState({ x: 0, y: 0 });
//   const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

//   const videoRef = useRef<HTMLVideoElement>(null);
//   const containerRef = useRef<HTMLDivElement>(null);

//   // Reset state when the modal is opened or the file changes
//   useEffect(() => {
//     if (isOpen && file) {
//       // For now, we'll need to handle video loading differently since we have videoId instead of File
//       // This would require fetching the video from the backend or storing the original file
//       setIsPlaying(false); 
//       setCurrentTime(0); 
//       setDuration(0);
//       setBlurMasks([]); 
//       setSelectedMaskId(null);
//     }
//   }, [isOpen, file]);

//   const togglePlayPause = () => {
//     if (!videoRef.current) return;
//     isPlaying ? videoRef.current.pause() : videoRef.current.play();
//     setIsPlaying(!isPlaying);
//   };

//   const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const time = parseFloat(e.target.value);
//     if (videoRef.current) videoRef.current.currentTime = time;
//     setCurrentTime(time);
//   };

//   const handleMouseDown = (e: React.MouseEvent) => {
//     if (!containerRef.current) return;
//     const rect = containerRef.current.getBoundingClientRect();
//     setIsDrawing(true);
//     const x = e.clientX - rect.left;
//     const y = e.clientY - rect.top;
//     setStartPos({ x, y });
//     setCurrentPos({ x, y });
//   };

//   const handleMouseMove = (e: React.MouseEvent) => {
//     if (!isDrawing || !containerRef.current) return;
//     const rect = containerRef.current.getBoundingClientRect();
//     setCurrentPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
//   };

//   const handleMouseUp = () => {
//     if (!isDrawing) return;
//     setIsDrawing(false);
//     const width = Math.abs(currentPos.x - startPos.x);
//     const height = Math.abs(currentPos.y - startPos.y);

//     if (width > 10 && height > 10) {
//       const newMask: BlurMask = {
//         id: crypto.randomUUID(),
//         x: Math.min(startPos.x, currentPos.x),
//         y: Math.min(startPos.y, currentPos.y),
//         width,
//         height,
//         startTime: currentTime,
//         endTime: Math.min(currentTime + 5, duration),
//         intensity: 20,
//       };
//       setBlurMasks(masks => [...masks, newMask]);
//       setSelectedMaskId(newMask.id);
//       alert(`Blur mask created at ${formatTime(currentTime)}`);
//     }
//   };

//   const updateMask = (id: string, updates: Partial<BlurMask>) => {
//     setBlurMasks(masks => masks.map(m => (m.id === id ? { ...m, ...updates } : m)));
//   };

//   const handleSave = () => {
//     if (blurMasks.length === 0) {
//         alert("Please add at least one blur mask before saving.");
//         return;
//     }
    
//     const video = videoRef.current;
//     const container = containerRef.current;
//     if (!video || !container || !video.videoWidth) return;

//     // This logic converts the on-screen coordinates to the video's native resolution coordinates
//     const scale = Math.min(container.clientWidth / video.videoWidth, container.clientHeight / video.videoHeight);
//     const displayedWidth = video.videoWidth * scale;
//     const displayedHeight = video.videoHeight * scale;
//     const offsetX = (container.clientWidth - displayedWidth) / 2;
//     const offsetY = (container.clientHeight - displayedHeight) / 2;

//     const transformedMasks = blurMasks.map(mask => ({
//         ...mask,
//         x: Math.round((mask.x - offsetX) / scale),
//         y: Math.round((mask.y - offsetY) / scale),
//         width: Math.round(mask.width / scale),
//         height: Math.round(mask.height / scale),
//     }));

//     onSaveEdit(transformedMasks);
//     onClose();
//   };

//   const formatTime = (time: number) => {
//     const minutes = Math.floor(time / 60);
//     const seconds = Math.floor(time % 60);
//     return `${minutes}:${seconds.toString().padStart(2, '0')}`;
//   };

//   if (!isOpen) return null;

//   const selectedMask = blurMasks.find(m => m.id === selectedMaskId);

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
//       <div className="relative z-50 flex flex-col w-full max-w-6xl h-[90vh] gap-4 bg-slate-800 text-white border border-slate-700 shadow-lg rounded-lg p-6">
//         {/* Header */}
//         <div className="flex flex-col space-y-1.5 text-center sm:text-left">
//             <h3 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
//                 <Square className="w-5 h-5" /> Edit Video: {file?.name}
//             </h3>
//             <p className="text-sm text-slate-400">
//                 Click and drag on the video to create blur masks, then adjust timing and intensity.
//             </p>
//         </div>

//         {/* Main Content Area */}
//         <div className="flex flex-1 gap-6 overflow-hidden">
//             {/* Left Side: Video Player */}
//             <div className="flex-1 flex flex-col gap-4">
//                 <div 
//                     ref={containerRef}
//                     className="relative flex-1 bg-black rounded-lg overflow-hidden cursor-crosshair select-none"
//                     onMouseDown={handleMouseDown}
//                     onMouseMove={handleMouseMove}
//                     onMouseUp={handleMouseUp}
//                     onMouseLeave={handleMouseUp}
//                 >
//                     <video
//                         ref={videoRef}
//                         className="w-full h-full object-contain"
//                         onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
//                         onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
//                         onPlay={() => setIsPlaying(true)}
//                         onPause={() => setIsPlaying(false)}
//                     />
//                     {/* Render active blur masks */}
//                     {blurMasks.map(mask => (
//                         currentTime >= mask.startTime && currentTime <= mask.endTime && (
//                             <div
//                                 key={mask.id}
//                                 className={`absolute border-2 border-sky-500 cursor-pointer ${selectedMaskId === mask.id ? 'bg-sky-500/40' : 'bg-sky-500/20'}`}
//                                 style={{ left: mask.x, top: mask.y, width: mask.width, height: mask.height }}
//                                 onClick={() => setSelectedMaskId(mask.id)}
//                             />
//                         )
//                     ))}
//                     {/* Render drawing rectangle */}
//                     {isDrawing && (
//                         <div 
//                             className="absolute border-2 border-dashed border-sky-400 bg-sky-400/20"
//                             style={{
//                                 left: Math.min(startPos.x, currentPos.x),
//                                 top: Math.min(startPos.y, currentPos.y),
//                                 width: Math.abs(currentPos.x - startPos.x),
//                                 height: Math.abs(currentPos.y - startPos.y),
//                             }}
//                         />
//                     )}
//                 </div>
//                 {/* Video Controls */}
//                 <div className="flex items-center gap-4">
//                     <button onClick={togglePlayPause} className="p-2 border border-slate-600 rounded-md hover:bg-slate-700">
//                         {isPlaying ? <Pause size={16}/> : <Play size={16}/>}
//                     </button>
//                     <span className="text-sm text-slate-400">{formatTime(currentTime)}</span>
//                     <input type="range" min="0" max={duration} value={currentTime} step="0.1" onChange={handleSeek} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer thumb:bg-sky-500" />
//                     <span className="text-sm text-slate-400">{formatTime(duration)}</span>
//                 </div>
//             </div>

//             {/* Right Side: Controls Panel */}
//             <div className="w-80 flex-shrink-0 flex flex-col gap-4">
//                 <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
//                     <h4 className="font-semibold mb-4">Blur Masks ({blurMasks.length})</h4>
//                     <div className="max-h-48 overflow-y-auto space-y-2">
//                         {blurMasks.length > 0 ? blurMasks.map((mask, index) => (
//                             <div key={mask.id} className={`flex justify-between items-center p-2 rounded-md cursor-pointer ${selectedMaskId === mask.id ? 'bg-slate-600' : 'bg-slate-700'}`} onClick={() => setSelectedMaskId(mask.id)}>
//                                 <span className="text-sm">Mask {index + 1}</span>
//                                 <button onClick={(e) => { e.stopPropagation(); setBlurMasks(b => b.filter(bm => bm.id !== mask.id)); }} className="text-slate-400 hover:text-red-500">
//                                     <Trash2 size={14}/>
//                                 </button>
//                             </div>
//                         )) : <p className="text-sm text-slate-500 text-center py-4">Draw on the video to create a mask.</p>}
//                     </div>
//                 </div>

//                 {selectedMask && (
//                     <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-4">
//                         <h4 className="font-semibold">Edit Selected Mask</h4>
//                         <div className="space-y-1">
//                             <label className="text-sm font-medium text-slate-300">Intensity: {selectedMask.intensity}</label>
//                             <input type="range" min="1" max="50" value={selectedMask.intensity} onChange={e => updateMask(selectedMask.id, { intensity: parseInt(e.target.value) })} className="w-full"/>
//                         </div>
//                         <div className="space-y-1">
//                             <label className="text-sm font-medium text-slate-300">Start Time: {formatTime(selectedMask.startTime)}</label>
//                             <input type="range" min="0" max={duration} step="0.1" value={selectedMask.startTime} onChange={e => updateMask(selectedMask.id, { startTime: parseFloat(e.target.value) })} className="w-full"/>
//                         </div>
//                         <div className="space-y-1">
//                             <label className="text-sm font-medium text-slate-300">End Time: {formatTime(selectedMask.endTime)}</label>
//                             <input type="range" min={selectedMask.startTime} max={duration} step="0.1" value={selectedMask.endTime} onChange={e => updateMask(selectedMask.id, { endTime: parseFloat(e.target.value) })} className="w-full"/>
//                         </div>
//                     </div>
//                 )}
//             </div>
//         </div>

//         {/* Footer */}
//         <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
//             <button onClick={onClose} className="px-4 py-2 rounded-md border border-slate-600 hover:bg-slate-700">Cancel</button>
//             <button onClick={handleSave} className="px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-700 disabled:opacity-50" disabled={blurMasks.length === 0}>Save & Process</button>
//         </div>
//       </div>
//     </div>
//   );
// };