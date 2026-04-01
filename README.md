# ✍️ WriteRight v2 — NLP Lab Edition

<div align="center">

![WriteRight v2](https://img.shields.io/badge/WriteRight-v2%20NLP%20Lab%20Edition-1a6b5a?style=for-the-badge&logoColor=white)

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)

**WriteRight v2 adds Lab 5 Language Model features on top of the original spell/grammar checker.**

</div>

---

## ✨ What's New in v2

| Feature                    | Lab     | Description                                                         |
| -------------------------- | ------- | ------------------------------------------------------------------- |
| 🔬 **N-gram Analysis**     | Lab 5-B | Build Unigram, Bigram, Trigram models; view top N-grams with counts |
| 📊 **Perplexity**          | Lab 5-B | MLE, Laplace, and Backoff perplexity with visual bar charts         |
| 🔗 **Sentence Completion** | Lab 5-A | Spell-correct prefix + predict next word using bigram model         |
| 🎨 **New Color Theme**     | —       | Teal/forest green instead of Word blue                              |
| 🔬 **Lab 5 Tab**           | —       | Dedicated ribbon tab + always-visible right panel                   |

---

## 🎨 Color Theme Change

The ribbon and status bar are now **teal/forest green** (`#1a6b5a`) instead of Microsoft Word blue.

---

## 🔬 Lab 5 Panel

The right-side panel has **3 tabs**:

### N-Gram Tab (Lab 5-B)

- Enter corpus text (or click "Use Editor Text")
- Choose N (Unigram/Bigram/Trigram)
- See: total tokens, vocab size, top N-grams with frequency chips

### Perplexity Tab (Lab 5-B)

- Enter training corpus + test sentence
- Get perplexity under **3 models**: MLE, Laplace Smoothing, Backoff
- Visual bar chart — green = low (good), red = high (bad/unseen)
- Also shows sentence probability and log probability

### Completion Tab (Lab 5-A)

- Enter corpus + partial sentence prefix (e.g. "I am goin")
- Auto-corrects spelling in prefix
- Predicts next word using Bigram Language Model
- Falls back to unigram frequency if bigram not found

---

## 🚀 Getting Started

### Option 1 — Docker (Recommended)

```bash
git clone <your-repo>
cd writeright_v2
docker-compose up --build
```

| Service        | URL                        |
| -------------- | -------------------------- |
| 🌐 Frontend    | http://localhost           |
| ⚙️ Backend API | http://localhost:8000      |
| 📖 API Docs    | http://localhost:8000/docs |

### Option 2 — Manual

**Terminal 1 — Backend:**

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open: http://127.0.0.1:5173

---

## 🔌 New API Endpoints

### POST `/ngram`

Build N-gram model from corpus text.

```json
{ "text": "I am Sam. Sam I am.", "n": 2 }
```

### POST `/perplexity`

Compute perplexity of test sentence.

```json
{ "text": "I am Sam. Sam I am.", "test_sentence": "I am Sam" }
```

### POST `/complete`

Spell-correct and complete a sentence.

```json
{ "text": "I am Sam. She is reading.", "prefix": "I am goin" }
```

---

## 🧪 Lab 5 Test Inputs

**Corpus (for all tabs):**

```
I am a student
I am learning NLP
She is reading a book
He is playing football
I am going to school
She is going home
```

**Sentence Completion prefixes:** `I am goin`, `She is readng a`, `He is playng`

**Perplexity test sentences:** `I am Sam`, `I Sam` (this will be ∞ under MLE)

---

## 👩‍💻 Course Info

|            |                                                                                         |
| ---------- | --------------------------------------------------------------------------------------- |
| **Course** | Natural Language Processing Lab                                                         |
| **Labs**   | Lab 4 (Spell Corrector) + Lab 5-A (Sentence Completion) + Lab 5-B (N-gram / Perplexity) |
| **Batch**  | AI-23                                                                                   |
