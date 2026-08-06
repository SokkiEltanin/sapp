// Lekki runner dla CZYSTEJ logiki (parser banku, tagi paragonu, daty). Środowisko `node`
// + babel-jest (używa babel.config.js → babel-preset-expo transpiluje TS, module-resolver
// rozwiązuje alias '@'). Nie ruszamy komponentów RN — testujemy funkcje, które da się
// przetestować deterministycznie. date-fns bywa ESM → whitelist w transformIgnorePatterns.
module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: ['node_modules/(?!(date-fns|@react-native-async-storage)/)'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
