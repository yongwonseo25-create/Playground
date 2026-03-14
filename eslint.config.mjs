import nextVitals from 'eslint-config-next';

const config = [
  ...nextVitals,
  {
    ignores: ['coverage/**', '.next/**', '.runtime/**', 'test-results/**']
  }
];

export default config;
