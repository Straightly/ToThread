# React + Vite

## Dependency upgrades and verification

The planner uses Tailwind CSS 4 with `@tailwindcss/postcss`, React 19,
InsForge SDK 1.5, js-yaml 5, and ESLint 10. Use Node.js 22.13+ or 24+.
Tailwind 4 requires Safari 16.4+, Chrome 111+, or Firefox 128+.

From this directory:

```bash
npm ci
npm test
npm run build
npm audit
npm outdated
```

The tests check YAML task import/export and the SDK OAuth/database request
contracts using mocked requests; they do not access live user data.
Before deploying, sign in and check task navigation, the Misc Todos Done
toggle, task edits, YAML import/export, and timer controls. Run `npm run lint` as well. Follow the repository's
[maintenance policy](../../AGENTS.md): resolve inexpensive existing issues during
related work and document concrete blockers for anything that must remain.

Deploy the application source with `npx @insforge/cli deployments deploy .`.
Keep `package.json` and `package-lock.json` together when committing upgrades.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
