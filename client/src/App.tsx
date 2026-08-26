import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type {
  ClientMessage,
  GameAction,
  GameId,
  LeftRoomReason,
  PrivateGameState,
  RoomListItem,
  RoomStatePayload,
  RoomVisibility,
  ServerMessage,
} from "./network/messages.ts";
import {
  clearReconnectToken,
  connectSocket,
  loadReconnectToken,
  loadSavedName,
  saveName,
  saveReconnectToken,
} from "./network/socket.ts";
import { CrewScreen } from "./games/crew/CrewScreen.tsx";
import { FakeArtistScreen } from "./games/fakeArtist/FakeArtistScreen.tsx";
import { HanabiScreen } from "./games/hanabi/HanabiScreen.tsx";
import { PictionaryScreen } from "./games/pictionary/PictionaryScreen.tsx";
import { TelestrationsScreen } from "./games/telestrations/TelestrationsScreen.tsx";
import {
  connectionStateFromFlags,
} from "./components/ConnectionStatus.tsx";
import { GlobalStatusBanner } from "./components/GlobalStatusBanner.tsx";
import { BrowseRoomsScreen } from "./screens/BrowseRoomsScreen.tsx";
import { HomeCreateScreen } from "./screens/HomeCreateScreen.tsx";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { LobbyScreen } from "./screens/LobbyScreen.tsx";
import {
  clearRoomShareLocation,
  parseRoomShareLocation,
  parseRoomShareUrl,
} from "./room/roomShare.ts";
import "./App.css";

type SocketHandle = {
  send: (message: ClientMessage) => void;
  close: () => void;
};

type HomeView = "home" | "browse";

function readInitialShareCode(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (
    parseRoomShareUrl(window.location.href) ??
    parseRoomShareLocation(window.location.pathname, window.location.search)
  );
}

function App() {
  const socketRef = useRef<SocketHandle | null>(null);
  const pendingGameIdRef = useRef<GameId | null>(null);
  const reconnectPendingRef = useRef(loadReconnectToken() !== null);
  const initialShareCode = readInitialShareCode();
  const [connected, setConnected] = useState(false);
  const [socketEverOpened, setSocketEverOpened] = useState(false);
  const [name, setName] = useState(loadSavedName);
  const [joinCode, setJoinCode] = useState(initialShareCode ?? "");
  const [pendingShareCode, setPendingShareCode] = useState<string | null>(
    initialShareCode,
  );
  const [joinPassword, setJoinPassword] = useState("");
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [visibility, setVisibility] = useState<RoomVisibility>("public");
  const [createPassword, setCreatePassword] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomStatePayload | null>(null);
  const [privateState, setPrivateState] = useState<PrivateGameState | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [exitNotice, setExitNotice] = useState<LeftRoomReason | null>(null);
  const [homeView, setHomeView] = useState<HomeView>("home");
  const [createGameId, setCreateGameId] = useState<GameId | null>(null);
  const [roomList, setRoomList] = useState<RoomListItem[]>([]);

  useEffect(() => {
    const socket = connectSocket({
      onOpen() {
        setConnected(true);
        setSocketEverOpened(true);
        const token = loadReconnectToken();
        if (token) {
          socket.send({ type: "reconnect", reconnectToken: token });
        } else {
          reconnectPendingRef.current = false;
        }
      },
      onClose() {
        setConnected(false);
      },
      onMessage(message) {
        handleServerMessage(message);
      },
    });
    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !connected ||
      reconnectPendingRef.current ||
      playerId !== null ||
      room !== null ||
      pendingShareCode === null ||
      name.trim().length === 0
    ) {
      return;
    }
    setExitNotice(null);
    send({
      type: "join_room",
      roomCode: pendingShareCode,
      name: name.trim(),
    });
    setPendingShareCode(null);
    clearRoomShareLocation();
  }, [connected, pendingShareCode, name, playerId, room]);

  function handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case "room_created":
      case "welcome":
        reconnectPendingRef.current = false;
        setPendingShareCode(null);
        clearRoomShareLocation();
        saveReconnectToken(message.reconnectToken);
        setPlayerId(message.playerId);
        setHomeView("home");
        setCreateGameId(null);
        setShowJoinPassword(false);
        setJoinPassword("");
        setCreatePassword("");
        setError(null);
        if (message.type === "room_created" && pendingGameIdRef.current) {
          const gameId = pendingGameIdRef.current;
          pendingGameIdRef.current = null;
          socketRef.current?.send({ type: "select_game", gameId });
        }
        return;
      case "room_state":
        setRoom(message.state);
        setError(null);
        setExitNotice(null);
        if (message.state.phase === "LOBBY") {
          setPrivateState(null);
        }
        return;
      case "private_state":
        setPrivateState(message.state);
        return;
      case "game_started":
        setError(null);
        return;
      case "left_room":
        clearReconnectToken();
        setPlayerId(null);
        setRoom(null);
        setPrivateState(null);
        setError(null);
        setCreateGameId(null);
        pendingGameIdRef.current = null;
        setHomeView("home");
        setExitNotice(
          message.reason === "removed" ? "removed" : "left",
        );
        return;
      case "room_list":
        setRoomList(message.rooms);
        setError(null);
        return;
      case "error":
        if (message.message === "Unknown reconnect token") {
          clearReconnectToken();
          reconnectPendingRef.current = false;
        }
        if (message.message === "Password required") {
          setShowJoinPassword(true);
          setHomeView("home");
        }
        setError(message.message);
        return;
      case "pong":
        return;
    }
  }

  function send(message: ClientMessage): void {
    socketRef.current?.send(message);
  }

  function handleNameChange(next: string): void {
    setName(next);
    saveName(next);
  }

  const refreshRooms = useCallback(() => {
    socketRef.current?.send({ type: "list_rooms" });
  }, []);

  function joinRoomByCode(roomCode: string, password?: string): void {
    setExitNotice(null);
    const pwd =
      password !== undefined && password.length > 0
        ? password
        : showJoinPassword && joinPassword.length > 0
          ? joinPassword
          : undefined;
    if (pwd !== undefined) {
      send({
        type: "join_room",
        roomCode: roomCode.trim().toUpperCase(),
        name: name.trim(),
        password: pwd,
      });
      return;
    }
    send({
      type: "join_room",
      roomCode: roomCode.trim().toUpperCase(),
      name: name.trim(),
    });
  }

  function handleCreate(): void {
    setExitNotice(null);
    if (createGameId) {
      pendingGameIdRef.current = createGameId;
    }
    if (visibility === "private") {
      send({
        type: "create_room",
        name: name.trim(),
        visibility,
        password: createPassword,
      });
      return;
    }
    send({
      type: "create_room",
      name: name.trim(),
      visibility,
    });
  }

  const connectionState = connectionStateFromFlags({
    connected,
    everOpened: socketEverOpened,
  });

  let screen: ReactNode;

  if (room && playerId) {
    if (room.publicGame?.kind === "crew") {
      screen = (
        <CrewScreen
          playerId={playerId}
          name={name}
          room={room}
          game={room.publicGame}
          privateState={privateState?.kind === "crew" ? privateState : null}
          error={error}
          onNameChange={handleNameChange}
          onSetName={() => send({ type: "set_name", name: name.trim() })}
          onLeaveRoom={() => send({ type: "leave_room" })}
          onReturnToLobby={() => send({ type: "return_to_lobby" })}
          onPlayAgain={() => send({ type: "play_again" })}
          onSetReady={(ready) => send({ type: "set_ready", ready })}
          onGameAction={(action: GameAction) =>
            send({ type: "game_action", action })
          }
        />
      );
    } else if (room.publicGame?.kind === "hanabi") {
      screen = (
        <HanabiScreen
          playerId={playerId}
          name={name}
          room={room}
          game={room.publicGame}
          privateState={privateState?.kind === "hanabi" ? privateState : null}
          error={error}
          onNameChange={handleNameChange}
          onSetName={() => send({ type: "set_name", name: name.trim() })}
          onLeaveRoom={() => send({ type: "leave_room" })}
          onReturnToLobby={() => send({ type: "return_to_lobby" })}
          onPlayAgain={() => send({ type: "play_again" })}
          onSetReady={(ready) => send({ type: "set_ready", ready })}
          onGameAction={(action: GameAction) =>
            send({ type: "game_action", action })
          }
        />
      );
    } else if (room.publicGame?.kind === "pictionary") {
      screen = (
        <PictionaryScreen
          playerId={playerId}
          name={name}
          room={room}
          game={room.publicGame}
          privateState={
            privateState?.kind === "pictionary" ? privateState : null
          }
          error={error}
          onNameChange={handleNameChange}
          onSetName={() => send({ type: "set_name", name: name.trim() })}
          onLeaveRoom={() => send({ type: "leave_room" })}
          onReturnToLobby={() => send({ type: "return_to_lobby" })}
          onPlayAgain={() => send({ type: "play_again" })}
          onSetReady={(ready) => send({ type: "set_ready", ready })}
          onGameAction={(action: GameAction) =>
            send({ type: "game_action", action })
          }
        />
      );
    } else if (room.publicGame?.kind === "telestrations") {
      screen = (
        <TelestrationsScreen
          playerId={playerId}
          name={name}
          room={room}
          game={room.publicGame}
          privateState={
            privateState?.kind === "telestrations" ? privateState : null
          }
          error={error}
          onNameChange={handleNameChange}
          onSetName={() => send({ type: "set_name", name: name.trim() })}
          onLeaveRoom={() => send({ type: "leave_room" })}
          onReturnToLobby={() => send({ type: "return_to_lobby" })}
          onPlayAgain={() => send({ type: "play_again" })}
          onSetReady={(ready) => send({ type: "set_ready", ready })}
          onGameAction={(action: GameAction) =>
            send({ type: "game_action", action })
          }
        />
      );
    } else if (room.publicGame?.kind === "fakeArtist") {
      screen = (
        <FakeArtistScreen
          playerId={playerId}
          name={name}
          room={room}
          game={room.publicGame}
          privateState={
            privateState?.kind === "fakeArtist" ? privateState : null
          }
          error={error}
          onNameChange={handleNameChange}
          onSetName={() => send({ type: "set_name", name: name.trim() })}
          onLeaveRoom={() => send({ type: "leave_room" })}
          onReturnToLobby={() => send({ type: "return_to_lobby" })}
          onPlayAgain={() => send({ type: "play_again" })}
          onSetReady={(ready) => send({ type: "set_ready", ready })}
          onGameAction={(action: GameAction) =>
            send({ type: "game_action", action })
          }
        />
      );
    } else {
      screen = (
        <LobbyScreen
          playerId={playerId}
          name={name}
          room={room}
          privateState={privateState}
          error={error}
          onNameChange={handleNameChange}
          onSetName={() => send({ type: "set_name", name: name.trim() })}
          onSelectGame={(gameId) => send({ type: "select_game", gameId })}
          onCancelSetup={() => send({ type: "cancel_game_setup" })}
          onStartGame={() => send({ type: "start_game" })}
          onSetReady={(ready) => send({ type: "set_ready", ready })}
          onLeaveRoom={() => send({ type: "leave_room" })}
          onRemovePlayer={(targetPlayerId) =>
            send({ type: "remove_player", playerId: targetPlayerId })
          }
        />
      );
    }
  } else if (homeView === "browse") {
    screen = (
      <BrowseRoomsScreen
        name={name}
        connected={connected}
        error={error}
        rooms={roomList}
        onNameChange={handleNameChange}
        onRefresh={refreshRooms}
        onJoinRoom={joinRoomByCode}
        onBack={() => setHomeView("home")}
      />
    );
  } else if (createGameId) {
    screen = (
      <HomeCreateScreen
        gameId={createGameId}
        name={name}
        visibility={visibility}
        createPassword={createPassword}
        connected={connected}
        error={error}
        onNameChange={handleNameChange}
        onVisibilityChange={(next) => {
          setVisibility(next);
          if (next === "public") {
            setCreatePassword("");
          }
        }}
        onCreatePasswordChange={setCreatePassword}
        onBack={() => {
          setCreateGameId(null);
          pendingGameIdRef.current = null;
          setError(null);
        }}
        onCreate={handleCreate}
      />
    );
  } else {
    screen = (
      <HomeScreen
        name={name}
        joinCode={joinCode}
        joinPassword={joinPassword}
        showJoinPassword={showJoinPassword}
        connected={connected}
        error={error}
        onChooseGame={(gameId) => {
          setExitNotice(null);
          setCreateGameId(gameId);
        }}
        onNameChange={handleNameChange}
        onJoinCodeChange={(code) => {
          setJoinCode(code);
          setPendingShareCode(null);
          setShowJoinPassword(false);
          setJoinPassword("");
        }}
        onJoinPasswordChange={setJoinPassword}
        onJoin={() => joinRoomByCode(joinCode)}
        onBrowseRooms={() => {
          setExitNotice(null);
          setHomeView("browse");
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <GlobalStatusBanner
        connectionState={connectionState}
        exitNotice={exitNotice}
      />
      {screen}
    </div>
  );
}

export default App;
