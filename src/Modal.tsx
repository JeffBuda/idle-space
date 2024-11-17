// Modal.tsx
import React from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  elapsedTime: number;
  points: number;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, elapsedTime, points }) => {
  if (!isOpen) return null;

  const days = Math.floor(elapsedTime / (24 * 60 * 60));
  const hours = Math.floor((elapsedTime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((elapsedTime % (60 * 60)) / 60);
  const seconds = elapsedTime % 60;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Welcome Back!</h2>
        <p>You were away for:</p>
        <p>{days} days, {hours} hours, {minutes} minutes, {seconds} seconds</p>
        <p>Points earned: {points}</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default Modal;