# ♟️ Chess JavaScript — Complete Game with AI and Stockfish

A complete chess game built using **vanilla JavaScript**, featuring a fully interactive board, implementation of official chess rules and multiple AI difficulty levels — including integration with the Stockfish engine.

🔗 Play online:
https://arthurandrealmeida.github.io/xadrez-com-stockfish/
<img width="553" height="553" alt="{60B5CD4C-BD6B-436E-8869-69FA41ABB486}" src="https://github.com/user-attachments/assets/a2de7591-9767-4822-9e9f-7534f054bba2" />

---

## 🎯 Project Goal

The goal of this project was to explore:

- Game logic and state management
- Implementation of complex rule systems
- Artificial intelligence integration
- Front-end architecture using pure JavaScript

This project was developed as a deep dive into building a full browser-based game without frameworks.

---

## ♟️ Features

### Interactive Board
- 8×8 board with drag & drop and click movement
- Turn-based system with strict validation
- Visual feedback for check and checkmate

### Full Chess Rules Implemented
- Castling (king/queen side)
- En passant
- Pawn promotion (currently to queen)
- Check and checkmate detection
- Stalemate detection
- 50-move rule
- Threefold repetition
- Insufficient material detection

### Multiple AI Levels
- Random move bot
- Intermediate rule-based bot
- Advanced mode using Stockfish engine

---

## 🤖 Stockfish Integration

In the highest difficulty level, the application sends the current board position to the **Stockfish engine**, which calculates and returns the best possible move.

This required:
- Converting board state to chess notation (FEN)
- Communicating with the engine
- Parsing and applying the returned move

---

## 🧠 Technical Challenges

Key challenges during development:

- Representing the board state programmatically
- Validating moves while preventing illegal states
- Handling special rules (castling, en passant, repetition)
- Managing game state transitions
- Integrating an external chess engine

---

## 🛠️ Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- GitHub Pages (deployment)

---

## 👨‍💻 Author

Developed by Arthur Andre Almeida Santos as part of my programming studies and experimentation with game development and AI integration.
  
