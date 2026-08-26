import { randomUUID } from "node:crypto";

export type Player = {
  id: string;
  name: string;
  reconnectToken: string;
  roomCode: string;
  connected: boolean;
  ready: boolean;
};

export function createPlayer(name: string, roomCode: string): Player {
  return {
    id: randomUUID(),
    name,
    reconnectToken: randomUUID(),
    roomCode,
    connected: true,
    ready: false,
  };
}
