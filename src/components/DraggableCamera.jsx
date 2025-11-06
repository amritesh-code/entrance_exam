import React, { useState, useRef, useEffect } from 'react';

export default function DraggableCamera({ children }) {
  const [position, setPosition] = useState({ x: window.innerWidth - 360, y: 20 });
  const [dragging, setDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });
  const boxRef = useRef(null);

  useEffect(() => {
    if (dragging) {
      const handleMouseMove = (e) => {
        setPosition({
          x: e.pageX - rel.x,
          y: e.pageY - rel.y
        });
      };

      const handleMouseUp = () => {
        setDragging(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, rel]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle')) {
      const box = boxRef.current.getBoundingClientRect();
      setRel({
        x: e.pageX - box.left,
        y: e.pageY - box.top
      });
      setDragging(true);
      e.preventDefault();
    }
  };

  return (
    <div
      ref={boxRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '320px',
        zIndex: 1000,
        cursor: dragging ? 'grabbing' : 'default'
      }}
      className="bg-white rounded-lg shadow-2xl border-2 border-slate-300"
    >
      <div className="drag-handle bg-slate-100 px-3 py-2 rounded-t-lg border-b border-slate-300 flex items-center justify-between cursor-grab active:cursor-grabbing">
        <span className="text-xs font-medium text-slate-600">Camera Monitor</span>
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      </div>
      <div className="p-3">
        {children}
      </div>
    </div>
  );
}
