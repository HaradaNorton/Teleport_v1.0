# Teleport Desktop Application

Full-featured desktop messenger application built with Electron, React, TypeScript, and WebRTC.

## Features

- 🔐 Phone-based authentication
- 💬 Real-time messaging with WebSocket
- 📞 Audio/Video calls with WebRTC
- ✏️ Edit and delete messages
- ↩️ Reply to messages
- ➡️ Forward messages
- ✓✓ Read receipts
- ⌨️ Typing indicators
- 🎨 Modern UI with dark theme

## Prerequisites

Before running the desktop application, make sure you have installed:

1. **Node.js** (v18 or higher) - https://nodejs.org/
2. **Backend server** running on `http://192.168.1.109:8080`

## Installation

1. Navigate to the desktop directory:
```bash
cd C:\Users\Artem\go\src\Teleport_v1.0\desktop
```

2. Install dependencies:
```bash
npm install
```

This will install:
- Electron for the desktop framework
- React for the UI
- Vite for fast builds
- TypeScript for type safety
- Zustand for state management
- Axios for API calls
- simple-peer for WebRTC

## Running the Application

### Development Mode

To run the app in development mode with hot reload:

```bash
npm run dev
```

This will:
1. Start the Vite development server on http://localhost:5173
2. Launch the Electron window
3. Enable hot module replacement for instant updates

### Production Build

To build the application for production:

```bash
npm run build
```

This creates optimized production files in the `dist` folder.

### Package as Installer

To create a Windows installer (.exe):

```bash
npm run package
```

This will create:
- Windows installer in `dist/` folder
- Installable .exe file for Windows

The installer will be named something like `Teleport Setup 1.0.0.exe`

## Project Structure

```
desktop/
├── electron/
│   ├── main.js          # Electron main process
│   └── preload.js       # IPC bridge for security
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx      # Authentication
│   │   ├── ChatListPage.tsx   # List of chats
│   │   ├── ChatPage.tsx       # Chat messages
│   │   └── CallPage.tsx       # Audio/video calls
│   ├── services/
│   │   ├── api.ts            # API client
│   │   ├── websocket.ts      # WebSocket service
│   │   └── webrtc.ts         # WebRTC service
│   ├── store/
│   │   ├── authStore.ts      # Auth state
│   │   └── chatStore.ts      # Chat state
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   ├── styles/
│   │   └── *.css             # Component styles
│   ├── App.tsx               # Root component
│   └── main.tsx              # Entry point
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Configuration

### API URL

The API URL is configured in `src/services/api.ts`:

```typescript
const API_URL = 'http://192.168.1.109:8080/api/v1';
```

### WebSocket URL

The WebSocket URL is configured in `src/services/websocket.ts`:

```typescript
const wsUrl = 'ws://192.168.1.109:8080/api/v1/ws?token=${token}';
```

If you need to change the server IP, update these files.

## Usage

### Login

1. Launch the application
2. Enter your phone number (e.g., +1234567890)
3. Enter the verification code sent to your phone
4. You'll be automatically logged in

### Chats

- View all your chats in the left sidebar
- Click a chat to open the conversation
- Send messages, edit, delete, reply, or forward
- See typing indicators and read receipts

### Calls

- Click the phone icon (📞) for audio call
- Click the video icon (📹) for video call
- Answer incoming calls with the green button
- Mute/unmute and toggle video during calls
- End call with the red button

## Troubleshooting

### Cannot connect to server

Make sure:
1. Backend server is running on http://192.168.1.109:8080
2. Both computer and server are on the same network
3. Firewall is not blocking the connection

### Electron window doesn't open

Try:
```bash
npm cache clean --force
rm -rf node_modules
npm install
npm run dev
```

### WebRTC calls not working

Make sure:
1. Camera and microphone permissions are granted
2. Using a secure connection or localhost
3. STUN servers are accessible (Google STUN servers)

### Build errors

Make sure you have:
- Latest Node.js version (v18+)
- All dependencies installed (`npm install`)
- No TypeScript errors (`npm run build` should succeed)

## Building for Distribution

### Windows

```bash
npm run package
```

This creates a Windows installer in `dist/` folder.

### macOS (requires macOS)

On macOS, run:
```bash
npm run package
```

This creates a .dmg file.

### Linux

On Linux, run:
```bash
npm run package
```

This creates .AppImage and .deb files.

## Development Tips

### Hot Reload

In development mode, changes to React components automatically reload without restarting Electron.

### DevTools

Press `F12` or `Ctrl+Shift+I` to open Chrome DevTools for debugging.

### Logs

Console logs appear in:
- Development: Both in DevTools and terminal
- Production: Terminal where Electron was launched

## Technologies Used

- **Electron** ^28.0.0 - Desktop framework
- **React** ^18.2.0 - UI library
- **TypeScript** ^5.3.3 - Type safety
- **Vite** ^5.0.0 - Fast build tool
- **Zustand** ^4.4.7 - State management
- **Axios** ^1.6.2 - HTTP client
- **simple-peer** ^9.11.1 - WebRTC wrapper

## License

MIT

## Support

For issues or questions, please contact the development team.
