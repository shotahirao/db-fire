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
- **Cross-platform desktop app** built with Tauri (macOS, Windows, Linux)

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

### Build a release binary

```bash
npm run tauri build
```

After the build completes, distributable packages are generated under:

```
src-tauri/target/release/bundle/
```

Depending on your OS, you will find files such as:

- macOS: `.app`, `.dmg`
- Windows: `.exe`, `.msi`
- Linux: `.deb`, `.rpm`, `.AppImage`

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
- **Tauri によるクロスプラットフォーム対応**（macOS、Windows、Linux）

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

### リリース用バイナリをビルド

```bash
npm run tauri build
```

ビルドが完了すると、配布用パッケージが以下のディレクトリに生成されます。

```
src-tauri/target/release/bundle/
```

OS によって、以下のようなファイルが生成されます。

- macOS: `.app`、`.dmg`
- Windows: `.exe`、`.msi`
- Linux: `.deb`、`.rpm`、`.AppImage`

## ライセンス

[MIT License](./LICENSE) © 2026 shotahirao
