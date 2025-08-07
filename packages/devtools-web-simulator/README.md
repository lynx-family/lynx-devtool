# DevTools Web Simulator

A standalone React Web App for lightweight simulation of the communication link between Chrome DevTools Frontend and the host in a browser.

## Characteristic

- Run independently of Electron.
- Use an iframe to load the debug frontend by entering the DevTools Frontend address.
- The left panel provides two inputs: 
- SDK -> DevTools: Simulate the CDP message returned by the client SDK and inject it into the iframe (lynx_message). 
- Host -> DevTools: Simulate the host to send a message to the iframe (inspect-devtool-message).
- The log area displays the complete sending and receiving track in real time.

## Start up

Execute in the monorepo root directory:

```
pnpm i
pnpm --filter @lynx-js/devtools-web-simulator dev
```

Default port 5174.

## Illustrate

- Communication interface reference `plugins/devtool/renderer/devtool/index.tsx`, but does not directly rely on Electron's `window.ldtElectron API`.
- To extend to closer to the real link, replace/enhance the postMessage protocol and message routing in `src/ui/App.tsx`.