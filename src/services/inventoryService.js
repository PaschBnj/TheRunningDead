// Serviço simples de inventário (em memória) para alpha
const inventories = new Map();

export function getInventory(playerId) {
  if (!inventories.has(playerId)) inventories.set(playerId, []);
  return inventories.get(playerId);
}

export function addItem(playerId, item) {
  const inv = getInventory(playerId);
  inv.push({ ...item, instanceId: Date.now() + Math.random().toString(36).slice(2) });
  return inv;
}

export function removeItem(playerId, instanceId) {
  const inv = getInventory(playerId);
  const idx = inv.findIndex(i => i.instanceId === instanceId);
  if (idx >= 0) inv.splice(idx, 1);
  return inv;
}

export function donateItem(fromId, toId, instanceId) {
  const fromInv = getInventory(fromId);
  const idx = fromInv.findIndex(i => i.instanceId === instanceId);
  if (idx < 0) throw new Error('Item não encontrado');
  const item = fromInv[idx];
  fromInv.splice(idx, 1);
  addItem(toId, { id: item.id, name: item.name, rarity: item.rarity, quantity: item.quantity });
  return item;
}