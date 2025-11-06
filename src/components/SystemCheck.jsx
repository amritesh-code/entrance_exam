import React, { useEffect, useState, useRef } from 'react';

export default function SystemCheck({ onProceed, studentId }) {
  const [checks, setChecks] = useState({
    camera: { status: 'checking', message: 'Checking camera access...' },
    microphone: { status: 'checking', message: 'Checking microphone access...' },
  });
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [faceCapture, setFaceCapture] = useState({ status: 'idle', message: 'Position your face in the frame' });
  const [capturedImage, setCapturedImage] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    async function runChecks() {
      const newChecks = { ...checks };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        newChecks.camera = { status: 'pass', message: 'Camera access granted' };
      } catch (err) {
        newChecks.camera = { status: 'fail', message: 'Camera access denied or unavailable' };
      }

      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getTracks().forEach(t => t.stop());
        newChecks.microphone = { status: 'pass', message: 'Microphone access granted' };
      } catch (err) {
        newChecks.microphone = { status: 'fail', message: 'Microphone access denied or unavailable' };
      }

      setChecks(newChecks);
      
      if (newChecks.camera.status === 'pass' && newChecks.microphone.status === 'pass') {
        setShowFaceCapture(true);
      }
    }
    runChecks();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (showFaceCapture && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play();
    }
  }, [showFaceCapture]);

  const allPassed = Object.values(checks).every(c => c.status === 'pass') && faceCapture.status === 'captured';

  const captureFace = async () => {
    if (!videoRef.current || !streamRef.current) return;
    
    if (!studentId) {
      setFaceCapture({ status: 'error', message: 'Student ID not available' });
      return;
    }
    
    setFaceCapture({ status: 'capturing', message: 'Capturing your face...' });
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    
    canvas.toBlob(async (blob) => {
      try {
        const formData = new FormData();
        formData.append('file', blob, 'face.jpg');
        formData.append('student_id', studentId);
        
        console.log('Sending face capture with student_id:', studentId);
        
        const res = await fetch('http://localhost:8000/train_face', {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        console.log('Backend response:', data);
        
        if (data.success) {
          setCapturedImage(imageDataUrl);
          setFaceCapture({ status: 'captured', message: 'Face captured successfully!' });
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
          }
        } else {
          setFaceCapture({ status: 'error', message: data.message || 'Failed to capture face' });
          setTimeout(() => {
            setFaceCapture({ status: 'idle', message: 'Position your face in the frame' });
          }, 2000);
        }
      } catch (err) {
        console.error('Face capture error:', err);
        setFaceCapture({ status: 'error', message: 'Failed to upload face data' });
        setTimeout(() => {
          setFaceCapture({ status: 'idle', message: 'Position your face in the frame' });
        }, 2000);
      }
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">System Check</h2>
      <p className="text-slate-600">Please allow access to your camera and microphone to proceed.</p>
      {!studentId && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
          Warning: Student ID is missing. Please log in again.
        </div>
      )}
      
      <div className="space-y-3">
        {Object.entries(checks).map(([key, { status, message }]) => (
          <div key={key} className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50">
            <div className={`w-4 h-4 rounded-full ${
              status === 'pass' ? 'bg-green-500' :
              status === 'fail' ? 'bg-red-500' :
              'bg-yellow-500 animate-pulse'
            }`} />
            <div className="flex-1">
              <div className="font-medium text-slate-900 capitalize">{key}</div>
              <div className="text-sm text-slate-600">{message}</div>
            </div>
          </div>
        ))}
      </div>

      {showFaceCapture && (
        <div className="space-y-4 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
          <h3 className="font-bold text-slate-900">Face Registration</h3>
          <p className="text-sm text-slate-600">Position your face in the frame and capture</p>
          
          {capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured face"
              className="w-full max-h-64 rounded-lg border-2 border-green-400 bg-black object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full max-h-64 rounded-lg border-2 border-slate-300 bg-black"
            />
          )}
          
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-white">
            <div className={`w-4 h-4 rounded-full ${
              faceCapture.status === 'captured' ? 'bg-green-500' :
              faceCapture.status === 'error' ? 'bg-red-500' :
              faceCapture.status === 'capturing' ? 'bg-yellow-500 animate-pulse' :
              'bg-slate-400'
            }`} />
            <div className="flex-1">
              <div className="text-sm text-slate-600">{faceCapture.message}</div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={captureFace}
              disabled={faceCapture.status === 'capturing' || faceCapture.status === 'captured'}
              className={`flex-1 py-2 px-4 rounded-lg font-bold transition ${
                faceCapture.status === 'captured'
                  ? 'bg-green-600 text-white cursor-not-allowed'
                  : faceCapture.status === 'capturing'
                  ? 'bg-yellow-500 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
              }`}
            >
              {faceCapture.status === 'captured' ? 'Face Captured ✓' : 
               faceCapture.status === 'capturing' ? 'Capturing...' : 
               'Capture Face'}
            </button>
            
            {faceCapture.status === 'error' && (
              <button
                onClick={() => {
                  setCapturedImage(null);
                  setFaceCapture({ status: 'idle', message: 'Position your face in the frame' });
                }}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-bold transition"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onProceed}
        disabled={!allPassed}
        className={`w-full py-3 px-4 rounded-lg font-bold transition ${
          allPassed
            ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
        }`}
      >
        {allPassed ? 'Proceed to Instructions' : 'Complete all checks to continue'}
      </button>
    </div>
  );
}
