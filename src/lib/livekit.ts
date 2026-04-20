import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";

function getLiveKitConfig() {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error("LiveKit configuration is incomplete. Please check LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.");
  }
  return { url: LIVEKIT_URL, apiKey: LIVEKIT_API_KEY, apiSecret: LIVEKIT_API_SECRET };
}

export interface LiveKitUser {
  id: string;
  name: string;
  isModerator: boolean;
}

export interface LiveKitTokenOptions {
  identity?: string;
  name?: string;
  avatarUrl?: string;
  metadata?: string;
}

/**
 * Generate a LiveKit access token for a user
 * Tokens expire after 4 hours by default
 */
export async function generateLiveKitToken(
  roomName: string,
  user: LiveKitUser,
  options: LiveKitTokenOptions = {}
): Promise<string> {
  const { apiKey, apiSecret } = getLiveKitConfig();

  // In LiveKit v2+, we use AccessToken directly
  const at = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.name,
    ttl: 4 * 60 * 60, // 4 hours
  });

  if (options.metadata) {
    at.metadata = options.metadata;
  }

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: user.isModerator,
  });

  return await at.toJwt();
}

export function getLiveKitUrl(): string {
  return getLiveKitConfig().url;
}

export function getLiveKitApiKey(): string {
  return LIVEKIT_API_KEY;
}

/**
 * Create a room programmatically
 */
export async function createLiveKitRoom(roomName: string): Promise<void> {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  const roomService = new RoomServiceClient(url, apiKey, apiSecret);

  try {
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 600, // 10 minutes
      maxParticipants: 100,
    });
  } catch (error) {
    console.debug(`Room ${roomName} creation status:`, error);
  }
}

/**
 * Delete a room and clean up
 */
export async function deleteLiveKitRoom(roomName: string): Promise<void> {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  const roomService = new RoomServiceClient(url, apiKey, apiSecret);

  try {
    await roomService.deleteRoom(roomName);
  } catch (error) {
    console.error(`Failed to delete room ${roomName}:`, error);
  }
}

/**
 * List participants in a room
 */
export async function listRoomParticipants(roomName: string): Promise<any[]> {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  const roomService = new RoomServiceClient(url, apiKey, apiSecret);

  try {
    const participants = await roomService.listParticipants(roomName);
    return participants;
  } catch (error) {
    console.error(`Failed to list participants for room ${roomName}:`, error);
    return [];
  }
}

/**
 * Remove a participant from a room (kick)
 */
export async function removeParticipant(roomName: string, identity: string): Promise<void> {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  const roomService = new RoomServiceClient(url, apiKey, apiSecret);

  try {
    await roomService.removeParticipant(roomName, identity);
  } catch (error) {
    console.error(`Failed to remove participant ${identity} from room ${roomName}:`, error);
  }
}

/**
 * Update participant metadata
 */
export async function updateParticipantMetadata(
  roomName: string,
  identity: string,
  metadata: string
): Promise<void> {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  const roomService = new RoomServiceClient(url, apiKey, apiSecret);

  try {
    await roomService.updateParticipant(roomName, identity, { metadata });
  } catch (error) {
    console.error(`Failed to update metadata for ${identity}:`, error);
  }
}
