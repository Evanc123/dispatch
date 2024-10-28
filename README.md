# Marine Drill Sergeant AI Caller

A web application that lets you receive calls from an AI Marine Drill Sergeant powered by OpenAI's GPT-4 with voice. The Drill Sergeant knows about you and will drill you about your daily activities, ensuring proper military discipline and respect!

## OVERVIEW

This application combines several technologies to create an interactive voice experience:

- OpenAI's Realtime API for AI conversations and voice
- Twilio for handling phone calls
- Fastify for the web server
- WebSocket for real-time communication

## FEATURES

- Web interface with a military/jungle theme
- One-click calling to predefined number ("Contact HQ")
- Custom number dialing support
- Real-time voice interaction with an AI Drill Sergeant
- The Drill Sergeant maintains context about the user and enforces military discipline

## PREREQUISITES

You'll need:

- Node.js v20+
- pnpm
- OpenAI API key with access to GPT-4 with voice
- Twilio account with:
  - Account SID
  - Auth Token
  - Phone number
- ngrok (for local development)

## INSTALLATION

1. Clone the repository and install dependencies:
   git clone [repository-url]
   cd [repository-name]
   pnpm install

2. Create a .env file in the root directory:
   OPENAI_API_KEY=your_openai_api_key
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number

## RUNNING LOCALLY

1. Start ngrok to create a tunnel:
   ngrok http 3000

2. Copy your ngrok URL and update the webhook URL in index.js:
   url: `https://your-ngrok-url/incoming-call`

3. Start the server:
   node index.js

4. Visit http://localhost:3000/call in your browser

## DEPLOYMENT TO FLY.IO

1. Install the Fly.io CLI and login:
   curl -L https://fly.io/install.sh | sh
   fly auth login

2. Deploy the application:
   fly launch
   fly deploy

3. Set your environment variables:
   fly secrets set OPENAI_API_KEY=your_key
   fly secrets set TWILIO_ACCOUNT_SID=your_sid
   fly secrets set TWILIO_AUTH_TOKEN=your_token
   fly secrets set TWILIO_PHONE_NUMBER=your_number

4. Update your Twilio webhook URL to your Fly.io app URL:
   url: `https://your-fly-app.fly.dev/incoming-call`

USAGE

1. Open the web interface
2. Either:
   - Click "Contact HQ" to call the predefined number
   - Enter a phone number and click "Initiate Comms"
3. Answer the incoming call
4. Interact with the AI Drill Sergeant
   - Remember to end your responses with "Sir"
   - Be prepared for military discipline!

## DEVELOPMENT NOTES

- The application uses WebSockets for real-time communication
- Audio is streamed between Twilio and OpenAI's Realtime API
- The AI personality is configured in the SYSTEM_MESSAGE constant in index.js
- The frontend uses a military-themed UI with a commando green color scheme

## TROUBLESHOOTING

- If calls fail, check your Twilio credentials and webhook URL
- If there's no audio, verify your OpenAI API key and permissions
- For local development issues, ensure ngrok is running and the URL is updated
- Check the console for WebSocket connection errors

## ENVIRONMENT VARIABLES REFERENCE

OPENAI_API_KEY= # Your OpenAI API key
TWILIO_ACCOUNT_SID= # Your Twilio Account SID
TWILIO_AUTH_TOKEN= # Your Twilio Auth Token
TWILIO_PHONE_NUMBER= # Your Twilio phone number (format: +1234567890)

## TECH STACK

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Fastify
- APIs: OpenAI Realtime API, Twilio
- Real-time: WebSocket
- Deployment: Docker, Fly.io

## FILE STRUCTURE

.
├── public/
│ └── index.html # Frontend interface
├── index.js # Main server file
├── package.json # Dependencies and scripts
├── Dockerfile # Container configuration
├── fly.toml # Fly.io configuration
└── .env # Environment variables (not committed)
