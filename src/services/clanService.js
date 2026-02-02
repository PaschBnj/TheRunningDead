import * as turf from '@turf/turf';

// Clans simples em memória
const clans = new Map(); // clanId -> { id, name, photo, members: Set(playerId) }
const memberPositions = new Map(); // playerId -> { latitude, longitude }

export function createClan(id, name, photo) {
  clans.set(id, { id, name, photo, members: new Set() });
}

export function joinClan(clanId, playerId) {
  const clan = clans.get(clanId);
  if (!clan) throw new Error('Clan não existe');
  clan.members.add(playerId);
}

export function leaveClan(clanId, playerId) {
  const clan = clans.get(clanId);
  if (!clan) return;
  clan.members.delete(playerId);
}

export function setPlayerPosition(playerId, coords) {
  memberPositions.set(playerId, coords);
}

export function getClanForPlayer(playerId) {
  for (const c of clans.values()) {
    if (c.members.has(playerId)) return c;
  }
  return null;
}

export function isPlayerBuffed(playerId, radiusMeters = 15) {
  const clan = getClanForPlayer(playerId);
  if (!clan) return false;
  const myPos = memberPositions.get(playerId);
  if (!myPos) return false;
  for (const otherId of clan.members) {
    if (otherId === playerId) continue;
    const p = memberPositions.get(otherId);
    if (!p) continue;
    const from = turf.point([myPos.longitude, myPos.latitude]);
    const to = turf.point([p.longitude, p.latitude]);
    const distKm = turf.distance(from, to);
    if (distKm * 1000 <= radiusMeters) return true;
  }
  return false;
}

export default { createClan, joinClan, leaveClan, setPlayerPosition, getClanForPlayer, isPlayerBuffed };
