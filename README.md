# Wähli: A Deliberative Discovery Platform for Civic Tech

Wähli is an experimental, AI-powered Participatory Budgeting (PB) platform designed to transform how citizens engage with public spending. 

Most digital democratic tools today treat participation as a simple transaction: voters log on, search for a project their friends or neighbors told them about, hit "approve," and leave. These popularity-based systems entrench existing preferences and shut down the very deliberation that makes direct democracy meaningful. The result is **participation without discovery**.

Wähli fixes this by drawing inspiration from the smooth, frictionless discovery engines of e-commerce (like Netflix or Amazon), but instead of selling products, it empowers citizens to explore, reflect, and evaluate the trade-offs of their community's future. 

## Core Innovations

Wähli believes digital democracy shouldn't guide people toward specific choices, but empower them to uncover their own priorities. It does this through three core pillars:

### 1. Steerable, Natural Language Discovery
Instead of passive reliance on "what's popular," users have direct agency over their discovery process. You can steer the recommendation engine using natural language, for example, asking to see *"environmental projects in low-income areas."* The system immediately maps and surfaces matching proposals, expanding your attention span to ideas you might have otherwise overlooked.

### 2. E-Commerce Style Frictionless Exploration
Reviewing hundreds of civic PDFs is exhausting. Wähli acts as a **civic recommendation engine**. It learns your preferences through lightweight "More this vibe" (🌱) or "More around here" (📍) feedback. It transparently shows you *why* it recommended a project based on content and location, keeping you strictly in control of the algorithm's weights.

### 3. Gated Discovery & Structured Dissent (Majority Judgment)
Disagreement is a vital democratic resource, yet most platforms only allow positive endorsements (ignoring valid concerns about equity or viability). Wähli uses a nuanced 4-tier rating system: *Terrible* (❌), *Neutral* (🤔), *Good* (👍), or *Love it* (❤️). 

Crucially, **negative voting is gated**. Structured negative feedback (rejection power) is only unlocked *after* a threshold of positive engagements. This curbs impulsive opposition and trolling, ensuring that when citizens voice a critique, it comes after a balanced assessment of pros and cons.

## The Democratic Goal

Participatory budgeting thrives when digital tools meet three requirements. Citizens must be able to:
1. **Discover alternatives** beyond their preconceived interests.
2. **Reflect on trade-offs** across different districts and themes.
3. **Voice both support and critique** in a structured, constructive way.

When citizens can do all three freely and transparently, the decisions that emerge feel genuinely collective.

---

## Tech Stack & Architecture

- **Frontend**: React (TypeScript), built with Vite.
- **Styling**: Pure CSS with a custom, high-contrast "Civic Dark Mode" design system.
- **Backend / Engine**: Node.js/Python (depending on local setup) handling vector math, semantic search, and dynamic user embeddings for project matching.

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Running the Frontend
```bash
cd app
npm install
npm run dev
```

### Architecture Note
Wähli is built to be a standalone frontend that syncs with a backend embedding service. It is capable of running in "demo mode," gracefully degrading to fallback clustering if the real semantic backend is unavailable.
