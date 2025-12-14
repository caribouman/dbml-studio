import { create } from 'zustand';

const useHistoryStore = create((set, get) => ({
  history: [],
  future: [],
  present: null,
  setPresent: (present) => {
    const { history, present: past } = get();
    if (past) {
      set({ history: [...history, past], present, future: [] });
    } else {
      set({ present });
    }
  },
  undo: () => {
    const { history, present, future } = get();
    if (history.length > 0) {
      const newPresent = history[history.length - 1];
      set({
        history: history.slice(0, history.length - 1),
        present: newPresent,
        future: [present, ...future],
      });
      return newPresent;
    }
    return null;
  },
  redo: () => {
    const { future, present, history } = get();
    if (future.length > 0) {
      const newPresent = future[0];
      set({
        history: [...history, present],
        present: newPresent,
        future: future.slice(1),
      });
      return newPresent;
    }
    return null;
  },
}));

export default useHistoryStore;
