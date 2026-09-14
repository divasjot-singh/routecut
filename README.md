# RouteCut

### A small link with a useful story.

RouteCut is a URL-shortening service built by **Divasjot Singh** using Node.js, Express.js, and MongoDB.

It converts long HTTP and HTTPS URLs into short, shareable links. When a short link is visited, RouteCut finds the original URL, increments its click count, and redirects the visitor.

## Features

- Seven-character short-link generation using Nanoid
- URL format and DNS validation
- Duplicate-safe URL creation
- Atomic click tracking
- MongoDB schema validation
- Unique indexes for URLs and short IDs
- REST APIs for links, analytics, and deletion
- Browser interface with copy-to-clipboard support

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Nanoid
- HTML
- CSS
- JavaScript

## Run Locally

### Requirements

- Node.js 24 or later
- npm
- MongoDB or MongoDB Atlas

### Installation

Install the project dependencies:

```bash
npm install
