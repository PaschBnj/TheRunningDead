// Loot table e utilitários simples para alpha
const BASE_TABLE = [
  { id: 'coins', name: 'Moedas', rarity: 'common', weight: 60 },
  { id: 'medkit', name: 'Item de cura', rarity: 'common', weight: 25 },
  { id: 'armor', name: 'Armadura leve', rarity: 'rare', weight: 10 },
  { id: 'weapon', name: 'Arma básica', rarity: 'rare', weight: 4 },
  { id: 'legendary_sword', name: 'Espada lendária', rarity: 'epic', weight: 1 }
];

function weightedChoice(table) {
  const sum = table.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * sum;
  for (let it of table) {
    if (r < it.weight) return it;
    r -= it.weight;
  }
  return table[0];
}

export function getRandomLoot(luckyLevel = 0) {
  // luckyLevel aumenta a chance de raros/epic (alpha simple)
  const table = BASE_TABLE.map(it => {
    const boost = (it.rarity === 'rare' ? luckyLevel * 0.5 : (it.rarity === 'epic' ? luckyLevel * 0.2 : 0));
    return { ...it, weight: Math.max(1, it.weight + boost) };
  });
  const picked = weightedChoice(table);
  // quantidades simples
  const quantity = picked.id === 'coins' ? Math.floor(Math.random() * 50) + 10 : 1;
  return { id: picked.id, name: picked.name, rarity: picked.rarity, quantity };
}

export default {
  getRandomLoot
};