import nextVitals from 'eslint-config-next';

const config = [...nextVitals, { ignores: ['apps/**', 'coverage/**'] }];

export default config;
