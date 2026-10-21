# Leme (`./dock-app`)

Companion de widgets para o canto da barra do Windows, construído com **Tauri v2 (Rust) + Vanilla TypeScript + Vite**. A barra nativa continua intacta: o Leme é uma pílula flutuante ancorada logo acima dela.

## Widgets

- **Now Playing (Windows SMTC):** capa, título, artista, progresso e controles reais (play/pause, anterior, próxima) na sessão ativa do player.
- **GitHub:** contribuições no ano, repositórios públicos e última atividade.
- **Diário:** checklist de tarefas recorrentes, com reset automático todo dia.

Clique em um card para abrir o painel; `Esc` ou o `✕` fecham. O Leme se esconde sozinho quando um app está em tela cheia.

## Personalização

- Tema escuro/claro e opacidade do vidro.
- Escolha quais widgets aparecem.
- A pílula fica ancorada no canto inferior direito, acima da barra de tarefas, e cresce para cima quando um painel abre.

## Como executar

### 1. Modo Estúdio / Preview Instantâneo (Vite)
```powershell
npm.cmd run dev
```
Acesse `http://localhost:5175` para iterar no visual.

### 2. Modo App Desktop Nativo (Tauri v2 + Rust)
```powershell
npm.cmd run tauri:dev
```

### 3. Instaladores

```powershell
npm.cmd run tauri:build
```
Saída em `src-tauri/target/release/bundle/` (MSI e NSIS).
