import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Alert, StyleSheet, TouchableOpacity, Image } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as turf from '@turf/turf';
import { getLocationPermission, watchPosition } from '../services/gpsService';
import houses from '../data/houses';
import { v4 as uuidv4 } from 'uuid';
import InventoryScreen from './InventoryScreen';
import ClanScreen from './ClanScreen';
import * as items from '../data/items';
import * as inventoryService from '../services/inventoryService';
import * as clanService from '../services/clanService';
import * as playerService from '../services/playerService';
import * as firebaseService from '../services/firebaseService';

export default function MapScreen() {
  const MAX_HEALTH = 250; // Constante para evitar erros de cálculo na barra

  const [player, setPlayer] = useState(null);
  const [others, setOthers] = useState([]);
  const [zombies, setZombies] = useState([]);
  const [chests, setChests] = useState([]);
  const [showInventory, setShowInventory] = useState(false);
  const [showClan, setShowClan] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [buffActive, setBuffActive] = useState(false);
  const [health, setHealth] = useState(MAX_HEALTH);
  const [gameOver, setGameOver] = useState(false);

  // --- REFS PARA CORRIGIR O PROBLEMA DO "FRAME CONGELADO" ---
  const playerRef = useRef(null);
  const zombiesRef = useRef([]);
  // -----------------------------------------------------------

  const tickRef = useRef(null);
  const buffRef = useRef(null);
  const spawnRef = useRef(null);
  const damageRef = useRef(null);

  // 1. Hook de Sincronização: Mantém os Refs sempre com os dados mais recentes
  // Isso permite que o setInterval "enxergue" as atualizações sem precisar reiniciar
  useEffect(() => {
    playerRef.current = player;
    zombiesRef.current = zombies;
  }, [player, zombies]);

  useEffect(() => {
        if (health <= 0 && !gameOver) {
        handleDeath();
        }
  }, [health]);

  useEffect(() => {
    // tentativa de inicializar Firebase
    let fbUnsubPlayers = null;
    let fbUnsubChests = null;
    try {
      const cfg = require('../config/firebaseConfig').default;
      if (cfg && firebaseService.init(cfg)) {
        fbUnsubPlayers = firebaseService.subscribeToPlayers(list => {
          setOthers(list.filter(p => p.id !== 'me'));
        });
        fbUnsubChests = firebaseService.subscribeToChests(list => {
          setChests(list.map(c => ({ id: c.id, coords: c.coords, opened: !!c.opened })));
        });
      }
    } catch (e) {
      // sem config de firebase, continua em local
    }

    getLocationPermission().then(loc => {
      if (loc) {
        watchPosition(pos => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          const pData = { id: 'me', coords };
          
          setPlayer(pData);
          // O Ref atualiza no useEffect acima, mas garantimos aqui também por segurança
          playerRef.current = pData; 

          clanService.setPlayerPosition('me', coords);
          playerService.setPlayerPosition('me', coords);
          if (firebaseService.isReady()) firebaseService.syncPlayerPosition('me', { name: 'me', coords });
        });
      } else {
        Alert.alert('Permissão negada', 'Permita acesso à localização para jogar!.');
      }
    });

    // spawn inicial
    const initialZ = [createZombieNearPlayer(120), createZombieNearPlayer(180)];
    setZombies(initialZ);
    const initialChests = [createChestNearPlayer(140), createChestNearPlayer(200)];
    setChests(initialChests);

    if (firebaseService.isReady()) {
      initialChests.forEach(c => firebaseService.createChest({ id: c.id, coords: c.coords, opened: false }));
    }

    playerService.createPlayer('p1', 'Alice', { latitude: (player?.coords.latitude || 37.78825) + 0.0009, longitude: (player?.coords.longitude || -122.4324) + 0.0002 }, null);
    playerService.createPlayer('p2', 'Bob', { latitude: (player?.coords.latitude || 37.78825) - 0.0009, longitude: (player?.coords.longitude || -122.4324) - 0.0004 }, null);

    // INICIA OS INTERVALOS
    tickRef.current = setInterval(() => tickMove(), 1000);
    buffRef.current = setInterval(() => checkBuff(), 2000);
    spawnRef.current = setInterval(() => spawnTick(), 12000);
    damageRef.current = setInterval(() => applyZombieDamage(), 1500);

    const playersTick = setInterval(() => {
      playerService.jitterMove('p1');
      playerService.jitterMove('p2');
      setOthers(playerService.getPlayers());
    }, 3000);

    setInventory(inventoryService.getInventory('me'));

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (buffRef.current) clearInterval(buffRef.current);
      if (spawnRef.current) clearInterval(spawnRef.current);
      if (damageRef.current) clearInterval(damageRef.current);
      clearInterval(playersTick);
      if (fbUnsubPlayers) fbUnsubPlayers();
      if (fbUnsubChests) fbUnsubChests();
    };
  }, []);

  // --- Funções Auxiliares de Criação ---
  
  // Helper para pegar posição segura (se player for null usa padrão)
  function getSafePlayerCoords() {
    return playerRef.current ? playerRef.current.coords : (player?.coords || { latitude: 37.78825, longitude: -122.4324 });
  }

  function createZombie(latOffset = 0.001, lonOffset = 0.001) {
    const base = getSafePlayerCoords();
    return {
      id: uuidv4(),
      coords: {
        latitude: base.latitude + latOffset,
        longitude: base.longitude + lonOffset,
      }
    };
  }

  function createChest(latOffset = 0.001, lonOffset = -0.001) {
    const base = getSafePlayerCoords();
    return {
      id: uuidv4(),
      coords: {
        latitude: base.latitude + latOffset,
        longitude: base.longitude + lonOffset,
      },
      opened: false
    };
  }

  function createPointFromPlayer(distanceM) {
    const base = getSafePlayerCoords();
    const from = turf.point([base.longitude, base.latitude]);
    const bearing = Math.random() * 360;
    const dest = turf.destination(from, distanceM / 1000, bearing, { units: 'kilometers' });
    const [lon, lat] = dest.geometry.coordinates;
    return { latitude: lat, longitude: lon };
  }

  function createZombieNearPlayer(distanceM = 150) {
    const coords = createPointFromPlayer(distanceM);
    return { id: uuidv4(), coords };
  }

  function createChestNearPlayer(distanceM = 180) {
    const coords = createPointFromPlayer(distanceM);
    return { id: uuidv4(), coords, opened: false };
  }

  function spawnTick() {
    // Usa o Ref para garantir spawn perto de onde o jogador ESTÁ
    if (!playerRef.current) return;
    
    setZombies(prev => {
      const next = prev.length >= 12 ? prev.slice(-11) : prev.slice();
      next.push(createZombieNearPlayer(120 + Math.random() * 250));
      return next;
    });
    setChests(prev => {
      const next = prev.length >= 20 ? prev.slice(-19) : prev.slice();
      next.push(createChestNearPlayer(150 + Math.random() * 300));
      return next;
    });
  }

  function checkBuff() {
    try {
      const active = clanService.isPlayerBuffed('me');
      setBuffActive(active);
    } catch (e) { }
  }

  // --- LÓGICA CORRIGIDA: MOVIMENTO DOS ZUMBIS ---
  function tickMove() {
    // FIX: Usa playerRef.current em vez de player
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;

    const speedStreet = 5 / 3.6; 
    const speedHouse = 1.75 / 3.6; 

    setZombies(prev => prev.map(z => {
      try {
        const from = turf.point([z.coords.longitude, z.coords.latitude]);
        // FIX: Destino agora é a posição REAL ATUAL
        const to = turf.point([currentPlayer.coords.longitude, currentPlayer.coords.latitude]);
        
        const distKm = turf.distance(from, to);
        const distM = distKm * 1000;
        
        const insideHouse = houses.some(poly => turf.booleanPointInPolygon(from, poly));
        const speed = insideHouse ? speedHouse : speedStreet;
        
        const moveM = Math.min(distM, speed * 1); 
        if (moveM <= 0.1) return { ...z, coords: { ...z.coords } };
        
        const bearing = turf.bearing(from, to);
        const dest = turf.destination(from, moveM / 1000, bearing, { units: 'kilometers' });
        const [lon, lat] = dest.geometry.coordinates;
        
        return { ...z, coords: { latitude: lat, longitude: lon } };
      } catch (e) {
        return z;
      }
    }));
  }

  // --- LÓGICA CORRIGIDA: DANO DOS ZUMBIS ---
  function applyZombieDamage() {
    // FIX: Usa Refs para calcular com dados atuais
    const currentPlayer = playerRef.current;
    const currentZombies = zombiesRef.current; // Importante: ler a lista atual de zumbis também

    if (!currentPlayer) return;

    const playerPoint = turf.point([currentPlayer.coords.longitude, currentPlayer.coords.latitude]);
    
    const minDistM = currentZombies.reduce((min, z) => {
      try {
        const zPoint = turf.point([z.coords.longitude, z.coords.latitude]);
        const distKm = turf.distance(playerPoint, zPoint);
        return Math.min(min, distKm * 1000);
      } catch (e) {
        return min;
      }
    }, Infinity);

    // Se estiver a menos de 2 metros
    if (minDistM <= 2) {
      setHealth(prev => Math.max(0, prev - 20));
    }
  }

  function onOpenChest(chest) {
    if (!player) return; // Aqui pode usar state direto pois é evento de clique
    try {
      const p = turf.point([player.coords.longitude, player.coords.latitude]);
      const c = turf.point([chest.coords.longitude, chest.coords.latitude]);
      const distM = turf.distance(p, c) * 1000;
      
      // Distância corrigida para 30m
      if (distM > 30) {
        Alert.alert('Muito longe', 'Chegue a no mínimo 30m do baú para abrir.');
        return;
      }
    } catch (e) { }

    if (chest.opened) {
      Alert.alert('Baú vazio', 'Este baú já foi aberto.');
      return;
    }
    
    const luckyLevel = clanService.isPlayerBuffed('me') ? 1 : 0;
    const loot = items.getRandomLoot(luckyLevel);

    if (firebaseService.isReady()) {
      firebaseService.markChestOpened(chest.id, 'me');
      inventoryService.addItem('me', loot);
      setInventory(inventoryService.getInventory('me'));
      Alert.alert('Baú aberto', `Você encontrou: ${loot.name} x${loot.quantity} (sincronizado)`);
    } else {
      inventoryService.addItem('me', loot);
      setInventory(inventoryService.getInventory('me'));
      Alert.alert('Baú aberto', `Você encontrou: ${loot.name} x${loot.quantity}`);
    }

    setChests(prev => prev.map(c => c.id === chest.id ? { ...c, opened: true } : c));
  }

  return (
    <View style={styles.container}>
      {/* FIX: Renderização condicional para só carregar o mapa quando tiver GPS.
         Isso permite usar initialRegion e corrigir o bug do zoom.
      */}
      {player ? (
        <MapView 
          style={styles.map} 
          showsUserLocation 
          initialRegion={{
            latitude: player.coords.latitude,
            longitude: player.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          {others.map(o => (
            <Marker key={o.id}
              coordinate={{ latitude: o.coords.latitude, longitude: o.coords.longitude }}
              title={o.name}
              pinColor="deepskyblue"
              onPress={() => {
                Alert.alert(o.name, 'Ação', [
                  { text: 'Fechar' },
                  { text: 'Ver Perfil', onPress: () => Alert.alert('Perfil', `ID: ${o.id}\nNome: ${o.name}`) },
                  { text: 'Doar', onPress: () => { setShowInventory(true); setTimeout(() => { require('../services/playerService'); }, 50); }}
                ]);
              }}
            />
          ))}

          {zombies.map(z => (
            <Marker key={z.id}
              coordinate={{ latitude: z.coords.latitude, longitude: z.coords.longitude }}
              title="Zumbi"
              pinColor="red"
            />
          ))}

          {chests.map(c => (
            <Marker key={c.id}
              coordinate={{ latitude: c.coords.latitude, longitude: c.coords.longitude }}
              title={c.opened ? 'Baú (vazio)' : 'Baú'}
              pinColor="gold"
              onPress={() => onOpenChest(c)}
            />
          ))}
        </MapView>
      ) : (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
           <Text>Localizando GPS...</Text>
        </View>
      )}

      {/* --- BARRA DE VIDA CORRIGIDA --- */}
      <View style={styles.healthWrap}>
        <Text style={styles.healthText}>Vida: {health}/{MAX_HEALTH}</Text>
        <View style={styles.healthBar}>
          <View style={[styles.healthFill, { width: `${(health / MAX_HEALTH) * 100}%` }]} />
        </View>
      </View>

      <View style={styles.hud}>
        <Text style={styles.hudText}>Alpha — walkingmaps</Text>
        <TouchableOpacity style={styles.button} onPress={() => {
          setZombies(prev => [...prev, createZombie(Math.random() * 0.002 - 0.001, Math.random() * 0.002 - 0.001)]);
          setChests(prev => [...prev, createChest(Math.random() * 0.002 - 0.001, Math.random() * 0.002 - 0.001)]);
        }}>
          <Text style={styles.buttonText}>Spawn zumbi/baú</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, { marginTop: 8 }]} onPress={() => setShowInventory(true)}>
          <Text style={styles.buttonText}>Inventário ({inventory.length})</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <TouchableOpacity style={[styles.button]} onPress={() => setShowClan(true)}>
            <Text style={styles.buttonText}>Clã {buffActive ? '✅' : ''}</Text>
          </TouchableOpacity>
          <View style={{ marginLeft: 8 }}>{
            (() => {
              const c = clanService.getClanForPlayer('me');
              return c && c.photo ? <Image source={{ uri: c.photo }} style={{ width: 36, height: 36, borderRadius: 18 }} /> : null;
            })()
          }</View>
        </View>
      </View>

      <InventoryScreen visible={showInventory} initialTargetId={null} onClose={() => { setShowInventory(false); setInventory(inventoryService.getInventory('me')) }} playerId={'me'} />
      <ClanScreen visible={showClan} onClose={() => setShowClan(false)} playerId={'me'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  hud: { 
    position: 'absolute', 
    top: 40, 
    left: 10 
  },
  hudText: { backgroundColor: '#ffffffcc', padding: 6, borderRadius: 6, fontWeight: 'bold' },
  button: { marginTop: 8, backgroundColor: '#0a84ff', padding: 8, borderRadius: 6 },
  buttonText: { color: 'white', fontWeight: 'bold' },

  healthWrap: {
    position: 'absolute',
    top: 40,            
    right: 10,          
    backgroundColor: 'rgba(0,0,0,0.6)', 
    padding: 8,
    borderRadius: 8,
    alignItems: 'flex-end', 
    zIndex: 100,         
  },
  healthText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textShadowColor: 'black',
    textShadowRadius: 2
  },
  healthBar: {
    width: 120,          
    height: 12,          
    backgroundColor: '#333', 
    borderRadius: 6,
    overflow: 'hidden',  
    borderWidth: 1,
    borderColor: '#FFF'
  },
  healthFill: {
    height: '100%',
    backgroundColor: '#ff3b30', 
  }
});