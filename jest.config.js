// Lekki runner dla CZYSTEJ logiki (parser banku, tagi paragonu, daty). Środowisko `node`
// + babel-jest (używa babel.config.js → babel-preset-expo transpiluje TS, module-resolver
// rozwiązuje alias '@'). Nie ruszamy komponentów RN — testujemy funkcje, które da się
// przetestować deterministycznie. date-fns bywa ESM → whitelist w transformIgnorePatterns.
module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transformIgnorePatterns: ['node_modules/(?!(date-fns)/)'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
