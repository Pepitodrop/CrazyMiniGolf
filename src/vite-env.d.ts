/// <reference types="vite/client" />

declare module '*.bf?raw' {
  const source: string;
  export default source;
}

declare module '*.tr?raw' {
  const source: string;
  export default source;
}
