## [1.10.0](https://github.com/getvoicify/disciple-api-express/compare/v1.9.0...v1.10.0) (2025-09-23)


### ✨ Features

* outbox pattern ([#10](https://github.com/getvoicify/disciple-api-express/issues/10)) ([60be277](https://github.com/getvoicify/disciple-api-express/commit/60be2776f0800c0d5c711cd8ca48d8a496e6c5fe))

## [1.9.0](https://github.com/getvoicify/disciple-api-express/compare/v1.8.0...v1.9.0) (2025-09-22)


### ✨ Features

* **users:** add `getUserMemberships` endpoint and API route ([#9](https://github.com/getvoicify/disciple-api-express/issues/9)) ([efc1cf6](https://github.com/getvoicify/disciple-api-express/commit/efc1cf692f872f698f11a6ae1f15ecfa9defe97b))

## [1.8.0](https://github.com/getvoicify/disciple-api-express/compare/v1.7.2...v1.8.0) (2025-09-20)


### ✨ Features

* add unit tests framework ([#7](https://github.com/getvoicify/disciple-api-express/issues/7)) ([6508e41](https://github.com/getvoicify/disciple-api-express/commit/6508e413d4f9968de8fd067e8d4a5194c30e6c85))


### 🔧 Chores

* **argocd:** update secret reference for preview environment in `applicationset.yaml` ([f955ffe](https://github.com/getvoicify/disciple-api-express/commit/f955ffe5a779e5f8fcf86142413885a64c315084))

## [1.7.2](https://github.com/getvoicify/disciple-api-express/compare/v1.7.1...v1.7.2) (2025-09-20)


### 🐛 Bug Fixes

* **ci:** remove 'v' prefix from production image tag in deploy workflow ([934910b](https://github.com/getvoicify/disciple-api-express/commit/934910b7e9285742645c98d95ab03288507ea68f))

## [1.7.1](https://github.com/getvoicify/disciple-api-express/compare/v1.7.0...v1.7.1) (2025-09-20)


### ♻️ Code Refactoring

* **ci:** replace release comment with deployment logs in workflow ([d85d9b5](https://github.com/getvoicify/disciple-api-express/commit/d85d9b5332b3d5d988f16cedd2a7defad1a60925))

## [1.7.0](https://github.com/getvoicify/disciple-api-express/compare/v1.6.0...v1.7.0) (2025-09-20)


### ✨ Features

* church management ([#6](https://github.com/getvoicify/disciple-api-express/issues/6)) ([495add2](https://github.com/getvoicify/disciple-api-express/commit/495add20be88f85ce0d2503ed2d3d100b984b5e3))

## [1.6.0](https://github.com/getvoicify/disciple-api-express/compare/v1.5.0...v1.6.0) (2025-09-18)


### ✨ Features

* **argocd:** add bootstrap application and kustomization for disciple-api ([7d34179](https://github.com/getvoicify/disciple-api-express/commit/7d34179f54ceffc70118929b06e7c110d5c23d51))

## [1.5.0](https://github.com/getvoicify/disciple-api-express/compare/v1.4.0...v1.5.0) (2025-09-18)


### ✨ Features

* **config:** add environment-specific `apis` paths in Swagger config and enable `removeComments` in tsconfig ([#5](https://github.com/getvoicify/disciple-api-express/issues/5)) ([54f5433](https://github.com/getvoicify/disciple-api-express/commit/54f54330afb5f521ce0a2d693bff278bc55fcff1))

## [1.4.0](https://github.com/getvoicify/disciple-api-express/compare/v1.3.1...v1.4.0) (2025-09-18)


### ✨ Features

* **k8s:** add Ingress resource and environment-specific patches for `disciple-api` ([4ca7c06](https://github.com/getvoicify/disciple-api-express/commit/4ca7c0665fdb86be6b74c52ec07f8b481e9ecf24))

## [1.3.1](https://github.com/getvoicify/disciple-api-express/compare/v1.3.0...v1.3.1) (2025-09-18)


### ♻️ Code Refactoring

* **ci:** consolidate deploy logic and streamline workflows ([6194feb](https://github.com/getvoicify/disciple-api-express/commit/6194feb8fb7e7a00c0928d8a77f4901fa077faf9))

## [1.3.0](https://github.com/getvoicify/disciple-api-express/compare/v1.2.1...v1.3.0) (2025-09-18)


### ✨ Features

* **ci:** add GitHub prerelease plugin for semantic-release ([1cbf41a](https://github.com/getvoicify/disciple-api-express/commit/1cbf41a072e3df94c7049be30e2e06e274e05075))


### ♻️ Code Refactoring

* **ci:** migrate environment tags from `values.yaml` to `applicationset.yaml` ([9879912](https://github.com/getvoicify/disciple-api-express/commit/98799126acb9694df61680f7e06b3198b315881f))


### 🔧 Chores

* **tsconfig:** exclude `semantic-release-github-prerelease.js` from compilation ([d7ad1d9](https://github.com/getvoicify/disciple-api-express/commit/d7ad1d91bb88efab74387ee2ea00516cc7a08729))

## [1.2.1](https://github.com/getvoicify/disciple-api-express/compare/v1.2.0...v1.2.1) (2025-09-18)


### ♻️ Code Refactoring

* **ci:** migrate environment tags from `values.yaml` to `applicationset.yaml` ([d708c74](https://github.com/getvoicify/disciple-api-express/commit/d708c740b8659f9c57f9f764d364b4bc6bacaab9))

## [1.2.0](https://github.com/getvoicify/disciple-api-express/compare/v1.1.3...v1.2.0) (2025-09-17)


### ✨ Features

* **k8s:** update SealedSecrets and ConfigMap for database configuration ([f028b20](https://github.com/getvoicify/disciple-api-express/commit/f028b2001d884e165f735310a955e99581115c92))

## [1.1.3](https://github.com/getvoicify/disciple-api-express/compare/v1.1.2...v1.1.3) (2025-09-17)


### 🐛 Bug Fixes

* checkout main branch in deploy workflow ([ce926e1](https://github.com/getvoicify/disciple-api-express/commit/ce926e12ca319c48201d15ac18ba95b2310c663d))

## [1.1.2](https://github.com/getvoicify/disciple-api-express/compare/v1.1.1...v1.1.2) (2025-09-17)


### ♻️ Code Refactoring

* **k8s:** replace patchesStrategicMerge with patches in kustomization.yaml ([beea575](https://github.com/getvoicify/disciple-api-express/commit/beea575e63259bdfd67cee62a7200efc2a869a85))


### 👷 CI/CD

* enhance release workflow with Trivy scan and improved registry login ([#4](https://github.com/getvoicify/disciple-api-express/issues/4)) ([1bcb05c](https://github.com/getvoicify/disciple-api-express/commit/1bcb05cff7ffc8c1941858ba023363131615fa0e))

## [1.1.1](https://github.com/getvoicify/disciple-api-express/compare/v1.1.0...v1.1.1) (2025-09-17)


### ♻️ Code Refactoring

* split ApplicationSet for preview and static environments ([#3](https://github.com/getvoicify/disciple-api-express/issues/3)) ([82733eb](https://github.com/getvoicify/disciple-api-express/commit/82733eb0f2b9789f7445de258424cf53266bee72))


### 👷 CI/CD

* update success comment for GitHub releases in semantic-release config ([#2](https://github.com/getvoicify/disciple-api-express/issues/2)) ([1d6653e](https://github.com/getvoicify/disciple-api-express/commit/1d6653e0c1d2c419cf3f60b97ae1dcf40209ae1f))

## [1.1.0](https://github.com/getvoicify/disciple-api-express/compare/v1.0.0...v1.1.0) (2025-09-17)


### ✨ Features

* continuous delivery ([#1](https://github.com/getvoicify/disciple-api-express/issues/1)) ([cce15f6](https://github.com/getvoicify/disciple-api-express/commit/cce15f6fac7b39098a3d14fdf7051b04f7303109))

## 1.0.0 (2025-09-17)


### ✨ Features

* add semantic-release configuration and improved metadata integration ([caa2268](https://github.com/getvoicify/disciple-api-express/commit/caa2268770c9e9b4f4f1e854898cae06032c3b88))


### 👷 CI/CD

* disable test step in release workflow ([e9840f5](https://github.com/getvoicify/disciple-api-express/commit/e9840f5a94a64f494e9f9f3b335498ae43c2e0e7))
