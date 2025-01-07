# Peer-to-Peer Video Call App

A real-time, WebRTC-powered video calling application built with React. Features include multi-user support, dynamic layouts, and responsive design.

## Features

- Multi-user WebRTC support.
- Camera Switching on mobile.
- Chat functionality via data channels.
- Audio and video muting.
- Low data mode (lower video quality).
- Responsive UI.
- Customizable user interface (e.g., draggable, resizable user video component).

## Tech Stack

The application is built with **React** and uses the **WebRTC API** for real-time communication. The UI is implemented with components styled with **TailwindCSS**.
The application state is managed with **Zustand**.

## Folder Structure

```
/
├── public/                 # Static files
├── src/
  ├── components/         # React components
  ├── hooks/              # Custom hooks
  ├── notifications/      # Notification logic (sound+toasts)
  ├── pages/              # React pages
  ├── state/              # Zustand store and a boatload of underlying logic
  ├── routes.js           # Application routes
```

## Demo

Link for the demo: [https://p2p.xhuliodo.xyz/](https://p2p.xhuliodo.xyz/)

## Installation

1. Clone the repository.
2. Install the dependencies by running `npm install`.
3. Start the development server by running `npm run dev`.

## Contact

**Maintainer**: Xhulio Doda

**Email**: xhuliodo@gmail.com
