<div align="center">
  <img src="db-fire-icon-cropped.png" alt="db-fire logo" width="160" />
  <h1>db-fire</h1>
  <p>A fast, lightweight, cross-platform database client built with Tauri + React + TypeScript.</p>

  <p>
    <a href="https://tauri.app/" target="_blank"><img src="https://img.shields.io/badge/Tauri-2.0-24C8D8?logo=tauri&logoColor=white" alt="Tauri" /></a>
    <a href="https://react.dev/" target="_blank"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" /></a>
    <a href="https://www.typescriptlang.org/" target="_blank"><img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  </p>
</div>

---

## Screenshot

<img src="db-fire-icon-cropped.png" alt="db-fire app icon" width="400" />

> The actual UI screenshot will be added here. To capture one, run `npm run tauri dev`, open the app, and save a screenshot as `screenshot.png` in the project root.

---

## Features

- **Multi-database support**: MySQL, PostgreSQL, and SQLite
- **Secure SSH tunnel connections** for remote database access
- **Connection management**: create, edit, delete, and test connections
- **Powerful SQL editor** powered by Monaco Editor
- **Table browser & data grid** for exploring schemas and query results
- **Import & export** utilities for working with data
- **Desktop app for macOS (Apple Silicon)** built with Tauri
- **Automatic updates** via GitHub Releases
- **Settings** to enable/disable automatic updates

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| UI Components | Radix UI, Lucide React |
| State Management | Zustand |
| Editor | Monaco Editor |
| Backend | Rust, Tauri 2 |
| Database | sqlx (MySQL, PostgreSQL, SQLite) |
| SSH | async-ssh2-lite |

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/tools/install)
- OS-specific dependencies for Tauri: https://tauri.app/start/prerequisites/

### Installation

```bash
npm install
```

### Run in development mode

```bash
npm run tauri dev
```

This starts the Vite dev server and launches the Tauri desktop window.

## Build & Distribution

### Build a release binary locally

```bash
npm run tauri build
```

After the build completes, distributable packages are generated under:

```
src-tauri/target/release/bundle/
```

For macOS (Apple Silicon), you will find `.app` and `.dmg` files.

### Automated GitHub Releases

Pushing a tag starting with `v` automatically builds and publishes a release:

```bash
git tag v0.1.8
git push origin v0.1.8
```

The release will be published at:

```
https://github.com/shotahirao/db-fire/releases
```

### macOS Code Signing

By default, releases are unsigned. On macOS, this causes a security warning when opening the app.

To distribute a properly signed app, configure the following GitHub Secrets (same as [git-hydra](https://github.com/shotahirao/git-hydra)):

- `CSC_LINK` - Base64-encoded Developer ID Application certificate (p12)
- `CSC_KEY_PASSWORD` - Certificate password
- `APPLE_ID` - Apple ID
- `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Apple Developer Team ID
- `APPLE_SIGNING_IDENTITY` - Signing identity (optional)

### Automatic Updates

db-fire checks for updates on startup and downloads them automatically. Users can disable this in the app's Settings.

## Download Release Version

Download the latest release from GitHub Releases:

```
https://github.com/shotahirao/db-fire/releases/latest
```

### Troubleshooting on macOS

db-fire is currently not signed with an Apple Developer ID, so macOS Gatekeeper may block the app with the following message:

> “db-fire” is damaged and can’t be opened. You should move it to the Trash.

If you see this message, remove the quarantine attribute using the Terminal:

```bash
sudo xattr -d com.apple.quarantine /Applications/db-fire.app
```

If the above command fails, use the recursive flag:

```bash
sudo xattr -dr com.apple.quarantine /Applications/db-fire.app
```

Alternatively, you can also open the app by:

- Right-clicking the app and selecting **Open**
- Going to **System Settings → Privacy & Security** and clicking **Open Anyway** for db-fire

## License

[MIT License](./LICENSE) © 2026 shotahirao

---

<div align="center">
  <h1>db-fire（日本語）</h1>
  <p>Tauri + React + TypeScript で構築された、軽量で高速なクロスプラットフォーム対応のデータベースクライアント</p>
</div>

---

## スクリーンショット

<img src="db-fire-icon-cropped.png" alt="db-fire アプリアイコン" width="400" />

> 実際の UI スクリーンショットは後ほどこちらに追加します。キャプチャするには `npm run tauri dev` でアプリを起動し、画面を `screenshot.png` としてプロジェクトルートに保存してください。

## 機能

- **複数データベース対応**: MySQL、PostgreSQL、SQLite
- **SSH トンネル接続**による安全なリモート DB アクセス
- **接続管理**: 作成・編集・削除・接続テスト
- **Monaco Editor を搭載した SQL エディタ**
- **テーブルブラウザ & データグリッド**によるスキーマ・結果の確認
- **データのインポート / エクスポート**
- **macOS（Apple Silicon）向けデスクトップアプリ**
- **GitHub Releases による自動更新**
- **自動更新の ON/OFF 設定**

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19、TypeScript、Vite、Tailwind CSS v4 |
| UI コンポーネント | Radix UI、Lucide React |
| 状態管理 | Zustand |
| エディタ | Monaco Editor |
| バックエンド | Rust、Tauri 2 |
| データベース | sqlx（MySQL、PostgreSQL、SQLite） |
| SSH | async-ssh2-lite |

## はじめかた

### 前提条件

以下がインストールされていることを確認してください。

- [Node.js](https://nodejs.org/)（LTS 推奨）
- [Rust](https://www.rust-lang.org/tools/install)
- Tauri の OS 別前提条件: https://tauri.app/start/prerequisites/

### インストール

```bash
npm install
```

### 開発モードで起動

```bash
npm run tauri dev
```

Vite の開発サーバーが起動し、Tauri のデスクトップウィンドウが開きます。

## ビルドと配布

### ローカルでリリース用バイナリをビルド

```bash
npm run tauri build
```

ビルドが完了すると、配布用パッケージが以下のディレクトリに生成されます。

```
src-tauri/target/release/bundle/
```

macOS（Apple Silicon）では `.app` と `.dmg` が生成されます。

### GitHub Releases による自動配布

`v` から始まるタグをプッシュすると、自動的にビルド＆公開リリースが作成されます。

```bash
git tag v0.1.8
git push origin v0.1.8
```

リリースは以下の URL に公開されます。

```
https://github.com/shotahirao/db-fire/releases
```

### macOS のコード署名

デフォルトでは未署名のまま配布されます。そのため、macOS で開こうとするとセキュリティ警告が表示されます。

署名済みアプリを配布するには、以下の GitHub Secrets を設定してください（[git-hydra](https://github.com/shotahirao/git-hydra) と同じ形式）。

- `CSC_LINK` - Base64 エンコードした Developer ID Application 証明書（p12）
- `CSC_KEY_PASSWORD` - 証明書のパスワード
- `APPLE_ID` - Apple ID
- `APPLE_APP_SPECIFIC_PASSWORD` - アプリ専用パスワード
- `APPLE_TEAM_ID` - Apple Developer Team ID
- `APPLE_SIGNING_IDENTITY` - 署名 ID（オプション）

### 自動更新

db-fire は起動時に更新を確認し、自動的にダウンロードします。アプリ内の設定から自動更新を OFF にすることもできます。

## リリース版のダウンロード

最新版は GitHub Releases からダウンロードできます。

```
https://github.com/shotahirao/db-fire/releases/latest
```

### macOS でアプリが開けない場合

db-fire は現在 Apple Developer ID によるコード署名を行っていないため、macOS の Gatekeeper によって以下のようなメッセージが表示されることがあります。

> 「db-fire」は壊れているため開けません。ゴミ箱に入れる必要があります。

このメッセージが表示された場合は、ターミナルで以下のコマンドを実行し、アプリの検疫属性を解除してください。

```bash
sudo xattr -d com.apple.quarantine /Applications/db-fire.app
```

上記が失敗する場合は、再帰的に削除する `-r` フラグを付けてください。

```bash
sudo xattr -dr com.apple.quarantine /Applications/db-fire.app
```

または、以下の方法でも開けます。

- アプリを右クリックして「開く」を選択
- **システム設定 → プライバシーとセキュリティ** で db-fire の「**とにかく開く**」を許可

## ライセンス

[MIT License](./LICENSE) © 2026 shotahirao
