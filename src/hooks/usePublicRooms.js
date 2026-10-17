import { useEffect, useMemo, useState } from "react";
import { getAllRooms, ROOMS_EVENT } from "../utils/roomStorage";
import { getRoomAvailability, ROOM_STATUS_EVENT } from "../utils/roomStatusStorage";
import { getWorstUnresolvedIssueForRoom } from "../utils/issueStorage";

/**
 * Live, read-only view of the room catalog for the public marketing site
 * (Home / Rooms / Room Details). Reuses the exact same data sources as
 * the authenticated booking wizard (roomStorage / roomStatusStorage /
 * issueStorage) — never a second copy of room data — and re-renders
 * automatically whenever any of them change (e.g. an Admin blocks a room
 * while a visitor is browsing).
 */
export default function usePublicRooms() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(ROOM_STATUS_EVENT, bump);
    window.addEventListener(ROOMS_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(ROOM_STATUS_EVENT, bump);
      window.removeEventListener(ROOMS_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  const rooms = useMemo(() => {
    // eslint-disable-next-line no-unused-expressions
    tick;
    return getAllRooms().filter((r) => r.isActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const roomState = useMemo(() => {
    const map = {};
    rooms.forEach((r) => {
      map[r.id] = {
        availability: getRoomAvailability(r.id),
        worstIssue: getWorstUnresolvedIssueForRoom(r.id),
      };
    });
    return map;
  }, [rooms]);

  return { rooms, roomState };
}
