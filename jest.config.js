module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/__tests__/helpers/setup.js'],
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/__tests__/helpers/file-mock.js',
    '^react-native-mmkv$': '<rootDir>/__tests__/helpers/mmkv-mock.js',
    '^@react-native-community/netinfo$':
      '<rootDir>/__tests__/helpers/netinfo-mock.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/__tests__/helpers/',
  ],
  testTimeout: 30000,
};
