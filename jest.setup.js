// Mock AsyncStorage w środowisku node — odblokowuje testowanie utili, które (przez store'y
// Zustand persist) importują natywny storage. Bez tego już sam import store'a wywalał test.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
