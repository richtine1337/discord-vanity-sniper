"use strict";

const tls = require("tls");
const WebSocket = require("ws");
const http2 = require("http2");
const FastJson = require("fastJson");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const tlsSocket = tls.connect({
  host: "canary.discord.com",
  port: 443,
  minVersion: "TLSv1.3",
  maxVersion: "TLSv1.3",
  servername: "canary.discord.com"
});

let vanity;
let mfaToken = "";
const guilds = {};
const token = "REPLACE_TOKEN";
const password = "REPLACE_YOUR_PASSWORD";

let buffer = '';
tlsSocket.on("data", (data) => {
  buffer += data.toString();
  try {
    const jsonData = JSON.parse(buffer);
    if (jsonData.code || jsonData.message) {
      buffer = '';
    }
  } catch (e) {
  }
})

tlsSocket.on("error", () => process.exit());
tlsSocket.on("end", () => process.exit());

const headers = {
    'Authorization': token,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9164 Chrome/124.0.6367.243 Electron/30.2.0 Safari/537.36',
    'X-Super-Properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBDbGllbnQiLCJyZWxlYXNlX2NoYW5uZWwiOiJzdGFibGUiLCJjbGllbnRfdmVyc2lvbiI6IjEuMC45MTY0Iiwib3NfdmVyc2lvbiI6IjEwLjAuMjI2MzEiLCJvc19hcmNoIjoieDY0IiwiYXBwX2FyY2giOiJ4NjQiLCJzeXN0ZW1fbG9jYWxlIjoidHIiLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWxlIEdlY2tvKSBkaXNjb3JkLzEuMC45MTY0IENocm9tZS8xMjQuMC42MzY3LjI0MyBFbGVjdHJvbi8zMC4yLjAgU2FmYXJpLzUzNy4zNiIsImJyb3dzZXJfdmVyc2lvbiI6IjMwLjIuMCIsIm9zX3Nka192ZXJzaW9uIjoiMjI2MzEiLCJjbGllbnRfdnVibF9udW1iZXIiOjUyODI2LCJjbGllbnRfZXZlbnRfc291cmNlIjpudWxsfQ==',
    'X-Debug-Options': 'bugReporterEnabled',
    'Content-Type': 'application/json'
};

async function initializeMFA() {
  try {
    const initialResponse = await handleVanityUpdate("");
    const data = initialResponse;
    if (data.code === 60003 && data.mfa.ticket) {
      const newMfaToken = await handleMfaProcess(data.mfa.ticket);
      if (newMfaToken) {
        mfaToken = newMfaToken;
      }
    }
  } catch (error) {
    mfaToken = "";
  }
}

async function handleMfaProcess(ticket) {
  const mfaResponse = await http2Request("POST", "/api/v9/mfa/finish", { ...headers, "Content-Type": "application/json" }, JSON.stringify({ ticket: ticket, mfa_type: "password", data: password }));
  const mfaData = JSON.parse(mfaResponse);
  return mfaData.token || null;
}

async function handleVanityUpdate(find, mfaToken = null) {
  const patchHeaders = {
    ...headers,
    "Content-Type": "application/json",
    ...(mfaToken && { "X-Discord-MFA-Authorization": mfaToken })
  };
  const response = await http2Request("PATCH", `/api/v7/guilds/1100538518339592252/vanity-url`, patchHeaders, JSON.stringify({ code: find }));
  return JSON.parse(response);
}

async function ticket(find) {
  try {
    if (mfaToken) {
      await handleVanityUpdate(find, mfaToken);
      return;
    }
    const data = await handleVanityUpdate(find);
    if (data.code === 200) return;
    if (data.code === 60003 && data.mfa.ticket) {
      const newMfaToken = await handleMfaProcess(data.mfa.ticket);
      if (newMfaToken) {
        mfaToken = newMfaToken;
        await handleVanityUpdate(find, mfaToken);
      }
    }
  } catch (error) {
    mfaToken = "";
  }
}

async function http2Request(method, path, customHeaders = {}, body = null) {
  return new Promise((resolve, reject) => {
    const host = path.includes("/mfa/") ? "discord.com" : "canary.discord.com";
    const client = http2.connect(`https://${host}`);
    const req = client.request({ ":method": method, ":path": path, ...customHeaders });
    let data = "";
    req.on("response", (headers, flags) => {
      req.on("data", (chunk) => { data += chunk; });
      req.on("end", () => { resolve(data); client.close(); });
    });
    req.on("error", (err) => { reject(err); client.close(); });
    if (body) req.write(body);
    req.end();
  });
}


tlsSocket.on("secureConnect", async () => {
  const jsonData = FastJson.stringify({ message: "Connected" });
  console.log(jsonData);
  await initializeMFA();
  const websocket = new WebSocket("wss://gateway.discord.gg");
  websocket.onclose = () => process.exit();
  websocket.onmessage = (message) => {
    const { d, op, t } = JSON.parse(message.data);
    
    if (t === "GUILD_UPDATE" || t === "GUILD_DELETE") {
      const find = guilds[d.guild_id || d.id];
      if (find && find !== d.vanity_url_code) {
        ticket(find);
        vanity = `${find} `;
      }

    } else if (t === "READY") {
      d.guilds.forEach((guild) => {
        if (guild.vanity_url_code) {
          guilds[guild.id] = guild.vanity_url_code;
        }
      });
      console.log(guilds);
    }

    if (op === 10) {
      websocket.send(JSON.stringify({
          op: 2,
          d: {
              token: token,
              intents: 1 << 0,
              properties: { 
                  os: "linux", 
                  browser: "firefox", 
                  device: "1337" 
              }
          }
      }));
      
      setInterval(
        () => websocket.send(JSON.stringify({ op: 1, d: {}, s: null, t: "heartbeat" })),
        d.heartbeat_interval
      );
    } else if (op === 7) {
      process.exit();
    }
  };

  setInterval(() => tlsSocket.write(["GET / HTTP/1.1", "Host: canary.discord.com", "", ""].join("\r\n")), 400);
});
