import React, { useEffect, useState, useRef } from 'react';
import { API_BASE_URL } from '../config.js';

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
        
        const res = await fetch(`${API_BASE_URL}/train_face`, {
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-violet-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">System Check</h2>
          <p className="text-gray-600">We need to verify your camera and microphone</p>
        </div>

        {!studentId && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded">
            <p className="font-semibold">Warning: Student ID is missing. Please log in again.</p>
          </div>
        )}
        
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {Object.entries(checks).map(([key, { status, message }]) => (
            <div key={key} className="flex items-start gap-4 p-4 border-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
              <div className="flex-shrink-0 mt-1">
                {status === 'pass' ? (
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : status === 'fail' ? (
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-purple-500 animate-pulse flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900 capitalize text-lg">{key}</div>
                <div className="text-sm text-gray-600 mt-1">{message}</div>
              </div>
            </div>
          ))}
        </div>

        {showFaceCapture && (
          <div className="space-y-6 p-6 border-2 border-purple-200 rounded-2xl bg-gradient-to-br from-purple-50 to-white">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Face Registration</h3>
              <p className="text-gray-600">Position your face in the frame and capture</p>
            </div>
            
            <div className="relative">
              {capturedImage ? (
                <div className="relative rounded-2xl overflow-hidden border-4 border-green-400 shadow-xl">
                  <img
                    src={capturedImage}
                    alt="Captured face"
                    className="w-full h-80 object-cover bg-black"
                  />
                  <div className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-full font-semibold shadow-lg flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    Captured
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border-4 border-gray-300 shadow-xl">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-80 object-cover bg-black"
                  />
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-80 border-4 border-purple-400 rounded-full opacity-50"></div>
                  </div>
                </div>
              )}
            </div>
            
            <div className={`flex items-center gap-4 p-4 rounded-xl ${
              faceCapture.status === 'captured' ? 'bg-green-50 border-2 border-green-300' :
              faceCapture.status === 'error' ? 'bg-red-50 border-2 border-red-300' :
              faceCapture.status === 'capturing' ? 'bg-yellow-50 border-2 border-yellow-300' :
              'bg-gray-50 border-2 border-gray-300'
            }`}>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                faceCapture.status === 'captured' ? 'bg-green-500' :
                faceCapture.status === 'error' ? 'bg-red-500' :
                faceCapture.status === 'capturing' ? 'bg-yellow-500 animate-pulse' :
                'bg-gray-400'
              }`} />
              <div className="flex-1 font-medium text-gray-700">{faceCapture.message}</div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={captureFace}
                disabled={faceCapture.status === 'capturing' || faceCapture.status === 'captured'}
                className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition transform hover:scale-105 ${
                  faceCapture.status === 'captured'
                    ? 'bg-green-600 text-white cursor-not-allowed opacity-75'
                    : faceCapture.status === 'capturing'
                    ? 'bg-yellow-500 text-white cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg'
                }`}
              >
                {faceCapture.status === 'captured' ? 'Face Captured' : 
                 faceCapture.status === 'capturing' ? 'Capturing...' : 
                 'Capture Face'}
              </button>
              
              {faceCapture.status === 'error' && (
                <button
                  onClick={() => {
                    setCapturedImage(null);
                    setFaceCapture({ status: 'idle', message: 'Position your face in the frame' });
                  }}
                  className="px-6 py-4 bg-gray-600 text-white rounded-xl hover:bg-gray-700 font-bold text-lg transition shadow-lg transform hover:scale-105"
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
          className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition transform mt-8 ${
            allPassed
              ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-700 hover:to-violet-700 shadow-lg hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {allPassed ? 'Continue to Instructions →' : 'Complete all checks to continue'}
        </button>
      </div>
    </div>
  );
}
