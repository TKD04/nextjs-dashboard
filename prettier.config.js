const styleguide = require('@vercel/style-guide');

module.exports = {
  plugins: [...styleguide.plugins, 'prettier-plugin-tailwindcss'],
};
