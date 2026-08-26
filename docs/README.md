# Documentation

Authoritative design and specification documents for Game Night.

```text
architecture.md
        ↓
uiux.md / protocol.md / shared-game-architecture.md
        ↓
games/*.md
        ↓
implementation
```

More specific documents override more general ones when they conflict.

| File | Question it answers |
|------|---------------------|
| [architecture.md](./architecture.md) | What is this system and its fundamental principles? |
| [uiux.md](./uiux.md) | What is the shared visual and interaction language? |
| [protocol.md](./protocol.md) | What is the WebSocket protocol? |
| [shared-game-architecture.md](./shared-game-architecture.md) | How is every game built and plugged in? |
| [games/](./games/) | What are the rules and UI for each game? |
