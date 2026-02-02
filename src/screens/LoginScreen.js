import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import firebaseService from '../services/firebaseService';
import firebaseConfig from '../config/firebaseConfig';

WebBrowser.maybeCompleteAuthSession();

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateNonce = (size = 32) => {
  let result = '';
  for (let i = 0; i < size; i += 1) {
    const index = Math.floor(Math.random() * CHARSET.length);
    result += CHARSET[index];
  }
  return result;
};

const sha256 = async (value) => {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
};

export default function LoginScreen() {
  const recaptchaVerifier = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+55');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  const googleClientId = firebaseConfig.webClientId || firebaseConfig.expoClientId || 'GOOGLE_CLIENT_ID';
  const googleConfigured = Boolean(firebaseConfig.webClientId || firebaseConfig.expoClientId || firebaseConfig.androidClientId || firebaseConfig.iosClientId);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleClientId,
    iosClientId: firebaseConfig.iosClientId,
    androidClientId: firebaseConfig.androidClientId,
    expoClientId: firebaseConfig.expoClientId
  });

  useEffect(() => {
    (async () => {
      if (AppleAuthentication.isAvailableAsync) {
        setAppleAvailable(await AppleAuthentication.isAvailableAsync());
      }
    })();
  }, []);

  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.idToken) {
      handleGoogleSignIn(response.authentication.idToken);
    }
  }, [response]);

  const handleGoogleSignIn = async (idToken) => {
    try {
      setLoading(true);
      await firebaseService.signInWithGoogleToken(idToken);
    } catch (e) {
      Alert.alert('Erro no Google', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGooglePress = () => {
    if (!googleConfigured) {
      Alert.alert('Configuração', 'Adicione o clientId do Google em src/config/firebaseConfig.js');
      return;
    }
    promptAsync({ useProxy: true, showInRecents: true });
  };

  const handleAppleSignIn = async () => {
    if (!appleAvailable) return;
    try {
      const rawNonce = generateNonce();
      const hashed = await sha256(rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ],
        nonce: hashed
      });
      if (credential.identityToken) {
        setLoading(true);
        await firebaseService.signInWithAppleToken(credential.identityToken, rawNonce);
      }
    } catch (e) {
      if (e.code !== 'ERR_CANCELED') {
        Alert.alert('Erro Apple', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Digite seus dados', 'Email e senha são necessários.');
      return;
    }
    try {
      setLoading(true);
      await firebaseService.signInWithEmail(email.trim(), password);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        try {
          await firebaseService.createAccountWithEmail(email.trim(), password);
        } catch (inner) {
          Alert.alert('Erro', inner.message);
        }
      } else {
        Alert.alert('Erro', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneCode = async () => {
    if (!phoneNumber) {
      Alert.alert('Telefone', 'Informe o número com o DDI (ex: +5511987654321).');
      return;
    }
    if (!recaptchaVerifier.current) {
      Alert.alert('Recaptcha', 'Não foi possível inicializar o reCAPTCHA.');
      return;
    }
    try {
      setLoading(true);
      const confirmation = await firebaseService.requestPhoneSignIn(phoneNumber.trim(), recaptchaVerifier.current);
      setPhoneConfirmation(confirmation);
      Alert.alert('Código enviado', 'Verifique seu SMS e informe o código abaixo.');
    } catch (e) {
      Alert.alert('Erro no telefone', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPhoneCode = async () => {
    if (!phoneConfirmation) {
      Alert.alert('Código', 'Solicite o código primeiro.');
      return;
    }
    if (!verificationCode) {
      Alert.alert('Código', 'Digite o código enviado.');
      return;
    }
    try {
      setLoading(true);
      await firebaseService.confirmPhoneSignIn(phoneConfirmation, verificationCode.trim());
    } catch (e) {
      Alert.alert('Erro no código', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Entrar no WalkingMaps</Text>
        <Text style={styles.subTitle}>Escolha o provedor de sua preferência</Text>

        <TouchableOpacity
          style={[
            styles.providerButton,
            { backgroundColor: '#DB4437', opacity: googleConfigured ? 1 : 0.6 }
          ]}
          onPress={handleGooglePress}
          disabled={!googleConfigured}
        >
          <Text style={styles.providerText}>Continuar com Google</Text>
        </TouchableOpacity>

        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={8}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        )}

        <View style={styles.separator}>
          <Text style={styles.separatorText}>ou use email / telefone</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.secondaryButton} onPress={handleEmailLogin}>
            <Text style={styles.secondaryText}>Entrar ou criar conta</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Telefone</Text>
          <TextInput
            style={styles.input}
            placeholder="+5511987654321"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSendPhoneCode}>
            <Text style={styles.secondaryText}>Enviar código</Text>
          </TouchableOpacity>
          {phoneConfirmation && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Código SMS"
                keyboardType="number-pad"
                value={verificationCode}
                onChangeText={setVerificationCode}
              />
              <TouchableOpacity style={styles.secondaryButton} onPress={handleConfirmPhoneCode}>
                <Text style={styles.secondaryText}>Confirmar código</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={firebaseConfig}
          title="Verificação de número"
          cancelLabel="Cancelar"
        />

        <Text style={styles.hint}>
          Se quiser ver outras opções, configure o provider no Firebase Console e complete os campos
          em src/config/firebaseConfig.js (ids do Google / Apple).
        </Text>

        {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#fff',
    flexGrow: 1
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subTitle: { marginBottom: 16, color: '#666' },
  providerButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12
  },
  providerText: { color: '#fff', fontWeight: 'bold' },
  appleButton: { width: '100%', height: 44, marginBottom: 12 },
  separator: {
    marginVertical: 16,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    paddingVertical: 8
  },
  separatorText: { fontSize: 12, color: '#666' },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fafafa'
  },
  cardTitle: { fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  secondaryButton: {
    backgroundColor: '#0a84ff',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  secondaryText: { color: '#fff', fontWeight: 'bold' },
  hint: { marginTop: 16, fontSize: 12, color: '#555' }
});
