// Serviço simples de players (em memória) para alpha
const players = new Map(); // id -> { id, name, coords, avatar }

export function createPlayer(id, name, coords = { latitude: 37.78825, longitude: -122.4324 }, avatar = null) {
  players.set(id, { id, name, coords, avatar });
}

export function setPlayerPosition(id, coords) {
  const p = players.get(id);
  if (p) p.coords = coords;
  else players.set(id, { id, name: id, coords, avatar: null });
}

export function getPlayers() {
  return Array.from(players.values());
}

export function getPlayer(id) {
  return players.get(id) || null;
}

export function removePlayer(id) {
  players.delete(id);
}

// util: move a player by small random offset (simulation)
export function jitterMove(id, maxMeters = 5) {
  const p = getPlayer(id);
  if (!p) return;
  const latOff = (Math.random() - 0.5) * maxMeters / 111111; // approx degrees
  const lonOff = (Math.random() - 0.5) * maxMeters / (111111 * Math.cos(p.coords.latitude * Math.PI / 180));
  p.coords = { latitude: p.coords.latitude + latOff, longitude: p.coords.longitude + lonOff };
}

export default { createPlayer, setPlayerPosition, getPlayers, getPlayer, removePlayer, jitterMove };
