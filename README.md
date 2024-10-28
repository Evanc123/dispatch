# Marine Drill Sergeant AI Caller

A web application that lets you receive calls from an AI Marine Drill Sergeant powered by OpenAI's GPT-4 with voice. The Drill Sergeant knows about you and will drill you about your daily activities, ensuring proper military discipline and respect!

## Overview

This application combines several technologies to create an interactive voice experience:

- OpenAI's Realtime API for AI conversations and voice
- Twilio for handling phone calls
- Fastify for the web server
- WebSocket for real-time communication

## Features

- Web interface with a military/jungle theme
- One-click calling to predefined number ("Contact HQ")
- Custom number dialing support
- Real-time voice interaction with an AI Drill Sergeant
- The Drill Sergeant maintains context about the user and enforces military discipline

## Prerequisites

You'll need accounts and API keys from the following services:

- OpenAI (with access to GPT-4 with voice)
- Twilio
- ngrok (for local development)

## Environment Variables

Create a `.env` file with the following variables:
