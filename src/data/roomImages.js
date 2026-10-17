// Display-only room photos for the public site (Home / Rooms), keyed by
// room name so it works for rooms already saved in localStorage too.
import orion from "../assets/rooms/orion-boardroom.jpeg";
import nebula from "../assets/rooms/nebula-meeting-room.jpeg";
import zenith from "../assets/rooms/zenith-conference-hall.jpeg";
import pixel from "../assets/rooms/pixel-huddle-room.jpeg";
import skyline from "../assets/rooms/skyline-training-room.jpeg";
import vertex from "../assets/rooms/vertex-boardroom.jpeg";
import quartz from "../assets/rooms/quartz-event-hall.jpeg";

export const ROOM_IMAGES = {
  "Orion Boardroom": orion,
  "Nebula Meeting Room": nebula,
  "Zenith Conference Hall": zenith,
  "Pixel Huddle Room": pixel,
  "Skyline Training Room": skyline,
  "Vertex Boardroom": vertex,
  "Quartz Event Hall": quartz,
};

export function getRoomImage(room) {
  return ROOM_IMAGES[room?.name] || null;
}
