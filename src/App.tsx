import React, { useReducer } from 'react';
import './App.css';

// Define the types for state and actions
interface State {
  count: number;
}

export type Action = { type: 'increment' } | { type: 'decrement' };

// Define the reducer function
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    default:
      return state;
  }
};

const App: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, { count: 0 });

  return (
    <div className="container">
      <h1>Idle Game</h1>
      <p>Welcome to your idle game!</p>
      <p>Count: {state.count}</p>
      <button onClick={() => dispatch({ type: 'increment' })}>Increment</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>Decrement</button>
      {/* Add more components and game logic here */}
    </div>
  );
};

export default App;
