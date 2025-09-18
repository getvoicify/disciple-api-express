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
