// Modal.tsx
import React from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  elapsedTimeSeconds: number;
  points: number;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, elapsedTimeSeconds, points }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Welcome Back!</h2>
        <p>You were away for:</p>
        <p> {elapsedTimeSeconds} seconds</p>
        <p>Points earned: {points}</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default Modal;