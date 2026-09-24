export default function pino() {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    trace: () => {},
    child: () => pino(),
  };
}

export { pino };

export const levels = {
  values: { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10 },
  labels: { 10: "trace", 20: "debug", 30: "info", 40: "warn", 50: "error", 60: "fatal" },
};
