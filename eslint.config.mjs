import nextVitals from 'eslint-config-next';

const config = [...nextVitals, { ignores: ['coverage/**'] }];

export default config;
