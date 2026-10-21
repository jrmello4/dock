# Leme Desktop (`./dock-app`)

Um Dock ultraleve para Desktop, construído com **Tauri v2 (Rust) + Vanilla TypeScript + Vite**.

## Destaques de Performance
- **Zero-framework no Frontend:** Manipulação direta de DOM/SVG e física de magnificação acelerada por GPU (`scale3d`).
- **Backend em Rust Nativo (`src-tauri`):** Leitura real de uso de CPU e Memória RAM (`sysinfo`), abertura de aplicativos/pastas/URLs nativos do sistema operacional e controle de *click-through* (`set_ignore_cursor_events`).
- **Partículas Sazonais Inteligentes:** O motor Canvas de neve, luzes natalinas, morcegos e folhas pausa automaticamente (`cancelAnimationFrame`) quando você usa um tema clássico, mantendo **0% de uso de CPU em repouso**.

## Como executar

### 1. Modo Estúdio / Preview Instantâneo (Vite)
```powershell
npm.cmd run dev
```
Acesse `http://localhost:5175` para testar todos os ambientes, widgets ao vivo, 14 temas e mascotes instantaneamente.

### 2. Modo App Desktop Nativo (Tauri v2 + Rust)
```powershell
npm.cmd run tauri:dev
```
Compila o backend em Rust e abre a janela transparente sempre no topo (`alwaysOnTop`, sem bordas).
