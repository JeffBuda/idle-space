import React, { useReducer, useEffect, useRef, useState } from 'react';
import './App.css';
import Modal from './Modal';
import SpaceBackgroundCanvas from './SpaceBackgroundCanvas';

// Define the types for state and actions
interface State {
  // persisted
  score: number;
  updateTimeMs: number;

  // transient
  isModalOpen: boolean;
  idleTimeMs: number;
  idlePoints: number;
}

export enum LocalStorageKeys { score = 'idle-space-score', updateTimeMs = 'idle-space-updateTimeMs' };

export type Action =
  { type: 'increment' } |
  { type: 'openModal'} |
  { type: 'closeModal' } |
  { type: 'updateTime', payload: { nowMs: number } } |
  { type: 'calculateIdlePoints', payload: { nowMs: number } } |
  { type: 'awardIdlePoints', payload: { nowMs: number } };

// Define the reducer function
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'increment':
      return { ...state, score: state.score + 1 };
    case 'updateTime':
      const timeElapsedMs = action.payload.nowMs - (state.updateTimeMs || 0)
      return {
        ...state,
        score: state.score + calculatePoints(timeElapsedMs),
        updateTimeMs: action.payload.nowMs
      };
    case 'openModal':
      return {
        ...state,
        isModalOpen: true,
      };
    case 'calculateIdlePoints':
      if (!state.score) {
        // first time ever load of game
        return { ...state, score: 0, idlePoints: 0, idleTimeMs: 0, updateTimeMs: action.payload.nowMs };
      }

      //resume saved game
      const idleTimeMs = action.payload.nowMs - state.updateTimeMs;
      const idlePoints = calculatePoints(idleTimeMs);
      return {
        ...state,
        idleTimeMs,
        idlePoints,
        updateTimeMs: action.payload.nowMs
      };
    case 'awardIdlePoints':
      return { 
        ...state, 
        idlePoints: 0,
        score: state.score + state.idlePoints,
        updateTimeMs: action.payload.nowMs
      }
    case 'closeModal':
      return {
        ...state,
        isModalOpen: false
      };
    default:
      return state;
  }
};

export function calculatePoints(deltaTimeMs: number): number {
  return Math.floor(deltaTimeMs / 1000);
}

export function restoreState(): State {
  const updateTimeMs = Number(localStorage.getItem(LocalStorageKeys.updateTimeMs) || 0);
  const score = Number(localStorage.getItem(LocalStorageKeys.score) || 0);
  return {
    score,
    updateTimeMs,
    isModalOpen: false,
    idleTimeMs: 0,
    idlePoints: 0,
  };
}

const App: React.FC = () => {
  const initialState: State = restoreState();
  const [state, dispatch] = useReducer(reducer, initialState);
  const intervalRef = useRef<NodeJS.Timeout>();
  const [stars, setStars] = useState<{ x: string; y: string }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = Date.now();
      dispatch({ type: 'updateTime', payload: { nowMs: currentTime } });
    }, 1000);

    intervalRef.current = interval;

    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(
    () => {
      dispatch({ type: 'calculateIdlePoints', payload: { nowMs: Date.now() } });
    },
    []);

  useEffect(() => {
    if (state.idlePoints && !state.isModalOpen) {
      dispatch({ type: 'openModal' });
    }
  },
  [state.idlePoints, state.isModalOpen]);

  // store state in local storage
  useEffect(
    () => {
      localStorage.setItem(LocalStorageKeys.score, state.score.toString());
      localStorage.setItem(LocalStorageKeys.updateTimeMs, state.updateTimeMs.toString());
    },
    [state.score, state.updateTimeMs]);

  useEffect(() => {
    const generateStars = () => {
      const newStars = Array.from({ length: 100 }).map(() => ({
        x: Math.random() * 100 + '%',
        y: Math.random() * 100 + '%',
      }));
      setStars(newStars);
    };

    generateStars();
  }, []);

  const handleIncrement = () => {
    dispatch({ type: 'increment' });
  };

  const handleCloseModal = () => {
    dispatch({ type: 'closeModal' });
    dispatch({ type: 'awardIdlePoints', payload: { nowMs: Date.now() } });
  };

  return (
    <div className="container">
      <SpaceBackgroundCanvas />
      <h1>🚀 Idle Space 🚀</h1>
      <p>Press the button to increase your score!</p>
      <p>🎉 Score: {state.score.toLocaleString()} 🎉</p>
      <p>🚀 Distance Traveled: {state.score.toLocaleString()} </p>
      <button onClick={handleIncrement}>Fly further!</button>
      <Modal
        isOpen={state.isModalOpen}
        elapsedTimeMs={Math.floor((state.idleTimeMs || 0))}
        points={state.idlePoints || 0}
        onClose={handleCloseModal}
      />
      {/* Add more components and game logic here */}
    </div>
  );
};

export default App;
