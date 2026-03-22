import nextVitals from 'eslint-config-next';

const config = [
  ...nextVitals,
  {
    ignores: ['coverage/**', '.next/**', '.runtime/**', 'test-results/**', '_IMPORTED_UI/**']
  }
];

export default config;
