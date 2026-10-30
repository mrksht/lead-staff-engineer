// Pure fold: derive full state at `index` by replaying steps[0..index] from
// scratch every time. Cheap enough (a few dozen steps) that there's no
// reason to track state incrementally in useState and risk it drifting
// from the step list — recompute, don't mutate.
export function deriveState(steps, index) {
  const state = { call: [], microtask: [], macrotask: [], console: [] };

  for (let i = 0; i <= index; i++) {
    const step = steps[i];
    switch (step.action) {
      case "push":
        state.call.push(step.label);
        break;
      case "pop":
        state.call.pop();
        break;
      case "enqueue":
        state[step.target].push(step.label);
        break;
      case "dequeue":
        state[step.target].shift();
        break;
      case "log":
        state.console.push(step.label);
        break;
      case "note":
        break; // no state change, caption-only
      default:
        break;
    }
  }

  return state;
}
