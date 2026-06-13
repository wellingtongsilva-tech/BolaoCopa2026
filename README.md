# Bolão Copa 2026 - Jogos do Brasil 🇧🇷🏆

Um bolão simples, elegante e responsivo feito em HTML, CSS e JavaScript para acompanhar os palpites e resultados dos jogos do Brasil na Copa do Mundo de 2026 entre amigos.

## 🚀 Como Funciona (Sem Banco de Dados)

Este projeto foi desenhado para rodar totalmente no navegador, sem a necessidade de um servidor ou banco de dados. A coordenação dos palpites é feita de forma prática via **WhatsApp**:

1. **Participante**:
   - Acessa o site, digita seu nome e insere seus palpites para os jogos do Brasil.
   - Clica em **"Exportar Palpites (WhatsApp)"**.
   - O site gera um texto formatado contendo os palpites legíveis e um código criptografado/estruturado no final. O participante envia esse texto no grupo do WhatsApp dos amigos.

2. **Organizador (Administrador)**:
   - Copia a mensagem enviada pelo participante no WhatsApp.
   - Acessa o painel de administração no site e clica em **"Importar do WhatsApp"**.
   - Cola a mensagem. O sistema automaticamente lê o código, extrai os palpites e adiciona o participante à tabela de classificação.
   - O organizador preenche os resultados oficiais dos jogos à medida que eles acontecem, e a tabela de classificação é atualizada automaticamente!

## ⚽ Jogos do Brasil (Fase de Grupos)
- **Brasil vs. Marrocos** - 13/06/2026 (19h00 BRT)
- **Brasil vs. Haiti** - 19/06/2026 (22h00 BRT)
- **Escócia vs. Brasil** - 24/06/2026 (19h00 BRT)

## 📊 Regras de Pontuação
- **Placar Exato**: 25 pontos (ex: palpite 2x1, jogo terminou 2x1).
- **Vencedor e Saldo**: 18 pontos (ex: palpite 3x1, jogo terminou 2x0 - acertou o vencedor e a diferença de 2 gols).
- **Apenas Vencedor**: 12 pontos (ex: palpite 2x1, jogo terminou 1x0 ou 3x1 - acertou o vencedor, mas não o placar nem o saldo).
- **Empate Diferente**: 15 pontos (ex: palpite 1x1, jogo terminou 2x2 - acertou o empate, mas não o placar exato).
- **Errou Tudo**: 0 pontos.

## 🛠️ Tecnologias
- HTML5 (Estrutura semântica)
- CSS3 (Tema escuro premium com as cores do Brasil, efeitos de glassmorphism e design responsivo)
- JavaScript (Gerenciamento de estado local via `localStorage` e integração com WhatsApp)
