import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, StatusBar, Text, View } from 'react-native';
import MapScreen from './src/screens/MapScreen';
import LoginScreen from './src/screens/LoginScreen';
import firebaseService from './src/services/firebaseService';
import firebaseConfig from './src/config/firebaseConfig';

export default function App() {
  const [state, setState] = useState({ initializing: true, ready: false, user: null });

  useEffect(() => {
    const ready = firebaseService.init(firebaseConfig);
    if (!ready) {
      setState({ initializing: false, ready: false, user: null });
      return;
    }
    const unsubscribe = firebaseService.onAuthStateChange(user => {
      setState({ initializing: false, ready: true, user });
    });
    return unsubscribe;
  }, []);

  const loader = (
    <View style={styles.loader}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 8 }}>Conectando...</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {state.initializing && loader}
      {!state.initializing && !state.ready && (
        <View style={styles.loader}>
          <Text>Erro ao inicializar o Firebase. Confira suas credenciais.</Text>
        </View>
      )}
      {!state.initializing && state.ready && (state.user ? <MapScreen user={state.user} /> : <LoginScreen />)}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
