import * as Location from 'expo-location';

export async function getLocationPermission() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('Erro pedindo permissão de localização', e);
    return false;
  }
}

export function watchPosition(onUpdate) {
  let subscriber = null;
  (async () => {
    try {
      subscriber = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 1000,
        distanceInterval: 1
      }, onUpdate);
    } catch (e) {
      console.warn('watchPosition erro', e);
    }
  })();
  return () => {
    if (subscriber) subscriber.remove();
  };
}