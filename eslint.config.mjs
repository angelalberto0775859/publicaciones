import nextPlugin from "eslint-config-next";

const config = [
  ...nextPlugin,
  {
    rules: {
      "@next/next/no-img-element": "off"
    }
  }
];

export default config;
