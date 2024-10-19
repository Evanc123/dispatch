import Fastify from "fastify";
import WebSocket from "ws";
import fs from "fs";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import path from "path";
import twilio from "twilio";
import { fileURLToPath } from "url";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key and Twilio credentials from environment variables
const {
  OPENAI_API_KEY,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
} = process.env;

if (
  !OPENAI_API_KEY ||
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN ||
  !TWILIO_PHONE_NUMBER
) {
  console.error(
    "Missing required environment variables. Please check your .env file."
  );
  process.exit(1);
}

// Initialize Twilio client
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Register the static file serving plugin
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/", // This is correct
});

const SYSTEM_MESSAGE = `You are a marine drill sargeant and you are trying to whip this new recruit into SHAPE. Ask him: What did you do today!! Be aggressive, you need to make sure he'll protect the boys next to him. If the  INSUBORDINATE recruit does not answer by ending with Sir, give them a proper chewing out about respect. YOU are the boss. They are the RECRUIT SCUM and THEY WILL ADDRESS YOU WITH SIR OR ELSE, you MAGGOT!! you should *never* call the recruit SIR. you should call them only Maggot, scum, or RECRUIT.


RECRUIT INFO:
Your RECRUIT is a man named Evan Cater (pronounced kay-ter). He is the CAIO of a startup called Encore AI. His role involved building evals for new AI applications and building prototypes. He loves poetry and reading, and he has a younger brother and a mom that live in DC. He works with his two cofounders, matt and mike.

Instructions:
Make sure to weave specific pieces of biographical info about the recruit into your instructions and drilling.

`;
// Constants
// const SYSTEM_MESSAGE =
//   "You work for Encore AI, a platform which provides 360 reviews for clients. Speak fast and be concise.";
const VOICE = "echo";
const PORT = process.env.PORT || 3000; // Allow dynamic port assignment

// List of Event Types to log to the console. See OpenAI Realtime API Documentation. (session.updated is handled separately.)
const LOG_EVENT_TYPES = [
  "response.content.done",
  "rate_limits.updated",
  "response.done",
  "input_audio_buffer.committed",
  "input_audio_buffer.speech_stopped",
  "input_audio_buffer.speech_started",
  "session.created",
  "conversation.interrupted",
  "error",
];

const IGNORE_EVENTS = [
  "response.audio.delta",
  "response.audio_transcript.delta",
];
const SHOW_TIMING_MATH = false;

// Update the route to serve the HTML file
fastify.get("/call", async (request, reply) => {
  return reply.sendFile("index.html");
});

// Keep the existing JSON response at the root route
fastify.get("/", async (request, reply) => {
  reply.send({ message: "Twilio Media Stream Server is running!" });
});

// Route for Twilio to handle incoming and outgoing calls
// <Say> punctuation to improve text-to-speech translation
fastify.all("/incoming-call", async (request, reply) => {
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;

  reply.type("text/xml").send(twimlResponse);
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
  fastify.get("/media-stream", { websocket: true }, (connection, req) => {
    console.log("Client connected");
    let streamSid = null;
    let latestMediaTimestamp = 0;
    let lastAssistantItem = null;
    let markQueue = [];
    let responseStartTimestampTwilio = null;

    const openAiWs = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    // Send initial conversation item if AI talks first
    const sendInitialConversationItem = () => {
      const initialConversationItem = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Ask the user: RECRUITTTT. WHAT DID YOU GET DONE TODAY.",
            },
          ],
        },
      };

      if (SHOW_TIMING_MATH)
        console.log(
          "Sending initial conversation item:",
          JSON.stringify(initialConversationItem)
        );
      openAiWs.send(JSON.stringify(initialConversationItem));
      openAiWs.send(JSON.stringify({ type: "response.create" }));
    };

    // Handle interruption when the caller's speech starts
    const handleSpeechStartedEvent = () => {
      if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
        const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
        if (SHOW_TIMING_MATH)
          console.log(
            `Calculating elapsed time for truncation: ${latestMediaTimestamp} - ${responseStartTimestampTwilio} = ${elapsedTime}ms`
          );

        if (lastAssistantItem) {
          const truncateEvent = {
            type: "conversation.item.truncate",
            item_id: lastAssistantItem,
            content_index: 0,
            audio_end_ms: elapsedTime,
          };
          if (SHOW_TIMING_MATH)
            console.log(
              "Sending truncation event:",
              JSON.stringify(truncateEvent)
            );
          openAiWs.send(JSON.stringify(truncateEvent));
        }

        connection.send(
          JSON.stringify({
            event: "clear",
            streamSid: streamSid,
          })
        );

        // Reset
        markQueue = [];
        lastAssistantItem = null;
        responseStartTimestampTwilio = null;
      }
    };

    // Send mark messages to Media Streams so we know if and when AI response playback is finished
    const sendMark = (connection, streamSid) => {
      if (streamSid) {
        const markEvent = {
          event: "mark",
          streamSid: streamSid,
          mark: { name: "responsePart" },
        };
        connection.send(JSON.stringify(markEvent));
        markQueue.push("responsePart");
      }
    };

    const initializeSession = () => {
      const sessionUpdate = {
        type: "session.update",
        session: {
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200,
          },
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          voice: VOICE,
          instructions: SYSTEM_MESSAGE,
          modalities: ["text", "audio"],
          temperature: 0.8,
        },
      };

      console.log("Sending session update:", JSON.stringify(sessionUpdate));
      openAiWs.send(JSON.stringify(sessionUpdate));
      sendInitialConversationItem();
    };

    // Open event for OpenAI WebSocket
    openAiWs.on("open", () => {
      console.log("Connected to the OpenAI Realtime API");
      setTimeout(initializeSession, 100); // Ensure connection stability, send after .25 seconds
    });

    openAiWs.on("conversation.interrupted", () => {
      console.log("TESTTT");
    });

    // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
    openAiWs.on("message", (data) => {
      try {
        const response = JSON.parse(data);
        if (!IGNORE_EVENTS.includes(response.type)) {
          console.log(
            `Received event: ${response.type}`,
            JSON.stringify(response, null, 2)
          );
        }

        // if (LOG_EVENT_TYPES.includes(response.type)) {
        //   console.log(`Received event: ${response.type}`, response);
        // }

        if (response.type === "conversation.interrupted") {
          console.log("Conversation interrupted:", response);
        }

        if (response.type === "session.updated") {
          // console.log("Session updated successfully:", response);
        }
        if (response.type === "conversation.item.create") {
          console.log("Conversation item created:", response);
        }
        if (
          response.type ===
          "conversation.item.input_audio_transcription.completed"
        ) {
          console.log("transcript:", response.transcript);
        }
        if (response.type === "response.done") {
          console.log(JSON.stringify(response));
        }

        if (response.type === "response.audio.delta" && response.delta) {
          const audioDelta = {
            event: "media",
            streamSid: streamSid,
            media: {
              payload: Buffer.from(response.delta, "base64").toString("base64"),
            },
          };
          connection.send(JSON.stringify(audioDelta));

          // First delta from a new response starts the elapsed time counter
          if (!responseStartTimestampTwilio) {
            responseStartTimestampTwilio = latestMediaTimestamp;
            if (SHOW_TIMING_MATH)
              console.log(
                `Setting start timestamp for new response: ${responseStartTimestampTwilio}ms`
              );
          }

          if (response.item_id) {
            lastAssistantItem = response.item_id;
          }

          sendMark(connection, streamSid);
        }

        if (response.type === "input_audio_buffer.speech_started") {
          handleSpeechStartedEvent();
        }
      } catch (error) {
        console.error(
          "Error processing OpenAI message:",
          error,
          "Raw message:",
          data
        );
      }
    });

    // Handle incoming messages from Twilio
    connection.on("message", (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.event) {
          case "media":
            latestMediaTimestamp = data.media.timestamp;
            if (SHOW_TIMING_MATH)
              console.log(
                `Received media message with timestamp: ${latestMediaTimestamp}ms`
              );
            if (openAiWs.readyState === WebSocket.OPEN) {
              const audioAppend = {
                type: "input_audio_buffer.append",
                audio: data.media.payload,
              };

              openAiWs.send(JSON.stringify(audioAppend));
            }
            break;
          case "start":
            streamSid = data.start.streamSid;
            console.log("Incoming stream has started", streamSid);
            // Reset start and media timestamp on a new stream
            responseStartTimestampTwilio = null;
            latestMediaTimestamp = 0;
            break;
          case "mark":
            if (markQueue.length > 0) {
              markQueue.shift();
            }
            break;
          default:
            console.log("Received non-media event:", data.event);
            break;
        }
      } catch (error) {
        console.error("Error parsing message:", error, "Message:", message);
      }
    });

    // Handle connection close
    connection.on("close", () => {
      if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
      console.log("Client disconnected.");
    });

    // Handle WebSocket close and errors
    openAiWs.on("close", () => {
      console.log("Disconnected from the OpenAI Realtime API");
    });

    openAiWs.on("error", (error) => {
      console.error("Error in the OpenAI WebSocket:", error);
    });
  });
});

// New route to handle phone call requests
fastify.post("/make-call", async (request, reply) => {
  const { phoneNumber } = request.body;

  try {
    const call = await twilioClient.calls.create({
      url: `https://f474-70-23-180-244.ngrok-free.app/incoming-call`,
      to: phoneNumber,
      from: TWILIO_PHONE_NUMBER,
    });

    reply.send({ success: true, callSid: call.sid });
  } catch (error) {
    console.error("Error making call:", error);
    reply.status(500).send({ success: false, error: error.message });
  }
});

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server is listening on http://localhost:${PORT}`);
});
