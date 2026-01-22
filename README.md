# Bíblia Responde 📖

Um companheiro bíblico conversacional desenvolvido com foco em acessibilidade para idosos, utilizando Inteligência Artificial (Google Gemini) para oferecer conforto, leitura bíblica e respostas teológicas em uma interface calma e sagrada.

## 📱 Visão Geral do Produto

*   **Público Alvo:** Terceira idade.
*   **Foco:** Conversa por voz e texto.
*   **Design:** Estética de livro físico (Couro, Ouro, Marfim).
*   **Tecnologia:** React, Tailwind CSS, Google Gemini API (Multimodal).

## 🚀 Como Rodar Localmente

Este projeto utiliza uma estrutura moderna baseada em ES Modules (sem necessidade de build complexo para desenvolvimento simples), mas recomenda-se um servidor local.

1.  Clone o repositório.
2.  Crie um arquivo `.env` (ou configure no seu ambiente de deploy) com sua chave da API:
    ```
    API_KEY=sua_chave_do_google_ai_studio
    ```
    *Nota: Em ambientes puramente client-side como este demo, a chave deve ser injetada ou configurada no ambiente de execução.*

3.  Use uma extensão como "Live Server" ou rode:
    ```bash
    npx serve .
    ```

## 📲 Transformando em App Móvel (PWA)

Este projeto já está configurado como um **Progressive Web App (PWA)**.

1.  **Android/Chrome:** Acesse o site no navegador do celular, toque no menu e selecione "Adicionar à Tela Inicial".
2.  **iOS/Safari:** Toque no botão de compartilhamento e selecione "Adicionar à Tela de Início".

### Para Publicar nas Lojas (Google Play / App Store)

Recomenda-se usar **CapacitorJS** para envolver este código web em um container nativo.

1.  Instale o Capacitor no seu projeto (requer `package.json` e build step):
    ```bash
    npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
    npx cap init
    ```
2.  Configure o `webDir` para a pasta onde seus arquivos estáticos ficam.
3.  Gere os projetos nativos:
    ```bash
    npx cap add android
    npx cap add ios
    ```

## 🛠 Tecnologias

*   **Frontend:** React 19
*   **Estilização:** Tailwind CSS
*   **IA:** Google Gemini API (Modelos: `gemini-3-flash-preview` para texto, `gemini-2.5-flash-native-audio` para Live).
*   **Voz:** Web Speech API (Nativa do navegador) + Gemini Live API.

## ⚠️ Notas de Segurança e Privacidade

*   Este aplicativo não armazena áudios permanentemente.
*   Nenhum dado pessoal é coletado além do necessário para a conversa momentânea.
*   O conteúdo gerado por IA deve ser verificado e não substitui aconselhamento pastoral ou médico.
