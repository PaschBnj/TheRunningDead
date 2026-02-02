import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import * as clanService from '../services/clanService';

export default function ClanScreen({ visible, onClose, playerId }) {
  const [clanId, setClanId] = useState('');
  const [clanName, setClanName] = useState('');
  const [clanPhoto, setClanPhoto] = useState('');

  useEffect(() => {
    if (!visible) return;
    const c = clanService.getClanForPlayer(playerId);
    setClanId(c ? c.id : '');
    setClanName(c ? c.name : '');
    setClanPhoto(c ? c.photo || '' : '');
  }, [visible]);

  function handleCreate() {
    if (!clanId || !clanName) { Alert.alert('Preencha', 'Informe ID e nome do clã'); return; }
    clanService.createClan(clanId, clanName, clanPhoto || null);
    clanService.joinClan(clanId, playerId);
    Alert.alert('Clã criado', `Você criou e entrou no clã ${clanName}`);
    onClose();
  }

  function handleJoin() {
    try {
      clanService.joinClan(clanId, playerId);
      Alert.alert('Entrou', `Você entrou no clã ${clanId}`);
      onClose();
    } catch (e) { Alert.alert('Erro', e.message); }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Clã</Text>
        <TextInput placeholder="ID do clã" style={styles.input} value={clanId} onChangeText={setClanId} />
        <TextInput placeholder="Nome do clã" style={styles.input} value={clanName} onChangeText={setClanName} />
        <TextInput placeholder="URL da foto do clã (opcional)" style={styles.input} value={clanPhoto} onChangeText={setClanPhoto} />
        <TouchableOpacity style={styles.btn} onPress={handleCreate}><Text style={{color:'white'}}>Criar e Entrar</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, {backgroundColor:'#4caf50'}]} onPress={handleJoin}><Text style={{color:'white'}}>Entrar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.close} onPress={onClose}><Text>Fechar</Text></TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({ container: { flex:1, padding:16 }, title:{ fontSize:20, marginBottom:8 }, input:{ borderWidth:1, borderColor:'#ccc', padding:8, marginBottom:8 }, btn:{ backgroundColor:'#0a84ff', padding:10, borderRadius:6, marginBottom:8 }, close:{ marginTop:12 } });