import { useState, useRef } from "react";
export default function useWorkflow(initial) {
  const [workflow, setWorkflow] = useState(initial),
    [revision, setRevision] = useState(0);
  const current = useRef(initial),
    past = useRef([]),
    future = useRef([]);
  function replace(value) {
    current.current = value;
    setWorkflow(value);
    setRevision((v) => v + 1);
  }
  function change(updater, history = true) {
    const next =
      typeof updater === "function" ? updater(current.current) : updater;
    if (history) {
      past.current.push(structuredClone(current.current));
      if (past.current.length > 80) past.current.shift();
      future.current = [];
    }
    replace(next);
  }
  function checkpoint() {
    past.current.push(structuredClone(current.current));
    future.current = [];
  }
  function undo() {
    if (past.current.length) {
      future.current.push(current.current);
      replace(past.current.pop());
    }
  }
  function redo() {
    if (future.current.length) {
      past.current.push(current.current);
      replace(future.current.pop());
    }
  }
  return {
    workflow,
    change,
    checkpoint,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    revision,
  };
}
