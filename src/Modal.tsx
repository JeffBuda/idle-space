// Modal.tsx
import React from 'react';
import './Modal.css';
import { calculateElapsedTime } from './timeUtils';
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  elapsedTimeMs: number;
  points: number;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, elapsedTimeMs, points }) => {
  if (!isOpen) return null;
  const elapsedTime = calculateElapsedTime(elapsedTimeMs);
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Welcome Back!</h2>
        <p>You were away for:</p>
        {elapsedTime.months > 0 && <p> {elapsedTime.months} months</p>}
        {elapsedTime.weeks > 0 && <p> {elapsedTime.weeks} weeks</p>}
        {elapsedTime.days > 0 && <p> {elapsedTime.days} days</p>}
        {elapsedTime.hours > 0 && <p> {elapsedTime.hours} hours</p>}
        {elapsedTime.minutes > 0 && <p> {elapsedTime.minutes} minutes</p>}
        {elapsedTime.seconds > 0 && <p> {elapsedTime.seconds} seconds</p>}
        <p>Points earned: {points}</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default Modal;