import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import * as inventoryService from '../services/inventoryService';
import * as firebaseService from '../services/firebaseService';


export default function InventoryScreen({ visible, onClose, playerId, onDonate, initialTargetId }) {
  const [items, setItems] = useState([]);
  const [targetId, setTargetId] = useState(initialTargetId || '');
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (visible) refresh();
  }, [visible]);

  useEffect(() => {
    // fetch players list
    setPlayers(require('../services/playerService').getPlayers());
  }, [visible]);

  function refresh() {
    setItems([...inventoryService.getInventory(playerId)]);
  }

  async function handleDonate(item) {
    if (!targetId) { Alert.alert('Selecione jogador', 'Selecione um jogador para doar.'); return; }
    const target = require('../services/playerService').getPlayer(targetId);
    if (!target) { Alert.alert('Erro', 'Jogador não encontrado.'); return; }
    Alert.alert('Confirmar Doação', `Doar ${item.name} x${item.quantity} para ${target.name}?`, [
      { text: 'Cancelar' },
      { text: 'Doar', onPress: async () => {
        try {
          // tente usar transação Firebase se disponível
          if (firebaseService.isReady()) {
            await firebaseService.donateItemTransaction(playerId, targetId, item);
            Alert.alert('Doado', `Você doou ${item.name} para ${target.name} (via Firebase)`);
          } else {
            inventoryService.donateItem(playerId, targetId, item.instanceId);
            Alert.alert('Doado', `Você doou ${item.name} para ${target.name}`);
          }
          refresh();
          if (onDonate) onDonate(targetId);
        } catch (e) { Alert.alert('Erro', e.message); }
      }}
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Inventário</Text>

        <Text style={{ marginBottom: 6 }}>Doar para:</Text>
        <FlatList data={players} keyExtractor={p => p.id} horizontal showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              onPress={() => setTargetId(item.id)} 
              // Adicionei height e justifyContent para garantir que o botão fique comportado
              style={{ 
                padding: 6, 
                borderWidth: targetId === item.id ? 2 : 1, 
                borderColor: targetId === item.id ? '#0a84ff' : '#ccc', 
                marginRight: 8, 
                borderRadius: 6,
                // Opcional: Se quiser garantir que eles tenham todos a mesma altura
                height: 40, 
                justifyContent: 'center' 
              }}>
              <Text>{item.name}</Text>
            </TouchableOpacity>
          )} />

        <FlatList data={items} keyExtractor={i => i.instanceId} renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Text>{item.name} x{item.quantity}</Text>
            <TouchableOpacity onPress={() => handleDonate(item)} style={styles.button}>
              <Text style={styles.buttonText}>Doar</Text>
            </TouchableOpacity>
          </View>
        )} />

        <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Text>Fechar</Text></TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  button: { backgroundColor: '#0a84ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  buttonText: { color: 'white' },
  closeBtn: { marginTop: 12, alignItems: 'center' }
});