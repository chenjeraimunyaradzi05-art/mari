/**
 * k6 WebSocket Load Test for ATHENA Real-Time Messaging
 * 
 * This script tests the Socket.io messaging infrastructure under load.
 * Target: 10,000 concurrent WebSocket connections with active message storms.
 * 
 * Usage:
 *   k6 run --vus 1000 --duration 5m loadtest-websocket.js
 *   k6 run --vus 5000 --duration 10m loadtest-websocket.js
 *   k6 run --vus 10000 --duration 15m loadtest-websocket.js
 * 
 * Environment Variables:
 *   WS_URL - WebSocket server URL (default: ws://localhost:3001)
 *   AUTH_TOKEN - JWT token for authentication
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ==========================================
// CONFIGURATION
// ==========================================

const WS_URL = __ENV.WS_URL || 'ws://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

export const options = {
  stages: [
    { duration: '1m', target: 1000 },   // Ramp up to 1000 users
    { duration: '3m', target: 5000 },   // Ramp up to 5000 users
    { duration: '5m', target: 10000 },  // Peak: 10000 concurrent users
    { duration: '3m', target: 5000 },   // Scale down
    { duration: '1m', target: 0 },      // Ramp down to 0
  ],
  thresholds: {
    'ws_connecting_duration': ['p(95)<2000'],    // 95% of connections under 2s
    'ws_messages_sent': ['count>10000'],          // At least 10k messages sent
    'ws_message_latency': ['p(95)<500'],          // 95% of messages under 500ms
    'ws_connection_failures': ['rate<0.05'],      // Less than 5% connection failures
  },
};

// ==========================================
// CUSTOM METRICS
// ==========================================

const wsConnectionDuration = new Trend('ws_connecting_duration');
const wsMessageLatency = new Trend('ws_message_latency');
const wsMessagesSent = new Counter('ws_messages_sent');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsConnectionFailures = new Rate('ws_connection_failures');
const wsActiveConnections = new Counter('ws_active_connections');

// ==========================================
// SIMULATED CHANNELS
// ==========================================

const CHANNELS = [
  'general',
  'tech-careers',
  'mentorship',
  'job-hunting',
  'women-in-tech',
  'entrepreneurs',
  'finance-tips',
  'wellness',
  'leadership',
  'remote-work',
];

// ==========================================
// MESSAGE TYPES
// ==========================================

const MESSAGE_TYPES = [
  'chat:message',
  'chat:typing',
  'chat:read',
  'presence:update',
  'notification:ack',
];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function generateUserId() {
  return `user_${__VU}_${randomString(8)}`;
}

function generateMessage() {
  const messages = [
    'Hello everyone!',
    'Has anyone tried the new career compass feature?',
    'Looking for a mentor in data science',
    'Great opportunity shared!',
    'Thanks for the advice!',
    'Just completed my profile, excited to connect!',
    'Any tips for salary negotiation?',
    'Love this community!',
    'Checking out the new video feed',
    'Excited about the apprenticeship program!',
  ];
  return messages[randomIntBetween(0, messages.length - 1)];
}

function encodeSocketIOPacket(type, data) {
  // Socket.io packet encoding (simplified)
  // 42 = message packet type
  return `42${JSON.stringify([type, data])}`;
}

function decodeSocketIOPacket(data) {
  if (data.startsWith('42')) {
    try {
      return JSON.parse(data.slice(2));
    } catch {
      return null;
    }
  }
  return null;
}

// ==========================================
// MAIN TEST FUNCTION
// ==========================================

export default function () {
  const userId = generateUserId();
  const channel = CHANNELS[randomIntBetween(0, CHANNELS.length - 1)];
  
  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket&token=${AUTH_TOKEN}&userId=${userId}`;
  
  const connectStart = Date.now();
  
  const response = ws.connect(url, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  }, function (socket) {
    const connectDuration = Date.now() - connectStart;
    wsConnectionDuration.add(connectDuration);
    wsActiveConnections.add(1);
    
    let messageTimestamps = new Map();
    let messageCount = 0;
    
    // ==========================================
    // CONNECTION HANDLER
    // ==========================================
    
    socket.on('open', function () {
      console.log(`[${userId}] Connected to WebSocket`);
      
      // Send Socket.io handshake
      socket.send('40');
      
      // Join channel
      setTimeout(() => {
        socket.send(encodeSocketIOPacket('channel:join', {
          channelId: channel,
          userId: userId,
        }));
      }, 100);
    });
    
    // ==========================================
    // MESSAGE HANDLER
    // ==========================================
    
    socket.on('message', function (data) {
      wsMessagesReceived.add(1);
      
      // Handle Socket.io ping
      if (data === '2') {
        socket.send('3'); // Pong
        return;
      }
      
      // Handle message acknowledgments
      const decoded = decodeSocketIOPacket(data);
      if (decoded && decoded[0] === 'message:ack') {
        const messageId = decoded[1]?.messageId;
        if (messageId && messageTimestamps.has(messageId)) {
          const latency = Date.now() - messageTimestamps.get(messageId);
          wsMessageLatency.add(latency);
          messageTimestamps.delete(messageId);
        }
      }
      
      // Handle incoming messages
      if (decoded && decoded[0] === 'chat:message') {
        // Simulate reading message
        sleep(randomIntBetween(100, 500) / 1000);
      }
    });
    
    // ==========================================
    // ERROR HANDLER
    // ==========================================
    
    socket.on('error', function (e) {
      console.error(`[${userId}] WebSocket error: ${e}`);
      wsConnectionFailures.add(1);
    });
    
    // ==========================================
    // CLOSE HANDLER
    // ==========================================
    
    socket.on('close', function () {
      console.log(`[${userId}] Connection closed`);
      wsActiveConnections.add(-1);
    });
    
    // ==========================================
    // MESSAGE SENDING LOOP
    // ==========================================
    
    // Send messages periodically
    const sendInterval = setInterval(() => {
      if (socket.readyState !== 1) {
        clearInterval(sendInterval);
        return;
      }
      
      const messageId = `msg_${userId}_${messageCount++}`;
      messageTimestamps.set(messageId, Date.now());
      
      // Send chat message
      socket.send(encodeSocketIOPacket('chat:message', {
        messageId: messageId,
        channelId: channel,
        userId: userId,
        content: generateMessage(),
        timestamp: new Date().toISOString(),
      }));
      
      wsMessagesSent.add(1);
      
      // Occasionally send typing indicator
      if (Math.random() < 0.3) {
        socket.send(encodeSocketIOPacket('chat:typing', {
          channelId: channel,
          userId: userId,
          isTyping: true,
        }));
      }
      
    }, randomIntBetween(2000, 5000)); // Send message every 2-5 seconds
    
    // ==========================================
    // PRESENCE UPDATES
    // ==========================================
    
    const presenceInterval = setInterval(() => {
      if (socket.readyState !== 1) {
        clearInterval(presenceInterval);
        return;
      }
      
      socket.send(encodeSocketIOPacket('presence:update', {
        userId: userId,
        status: 'online',
        lastSeen: new Date().toISOString(),
      }));
    }, 30000); // Every 30 seconds
    
    // ==========================================
    // SESSION DURATION
    // ==========================================
    
    // Keep connection open for 2-5 minutes (simulating real user session)
    const sessionDuration = randomIntBetween(120, 300);
    sleep(sessionDuration);
    
    // Cleanup
    clearInterval(sendInterval);
    clearInterval(presenceInterval);
    
    // Leave channel before disconnecting
    socket.send(encodeSocketIOPacket('channel:leave', {
      channelId: channel,
      userId: userId,
    }));
    
    socket.close();
  });
  
  // Check connection success
  check(response, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  });
  
  if (!response || response.status !== 101) {
    wsConnectionFailures.add(1);
  }
}

// ==========================================
// TEARDOWN
// ==========================================

export function teardown(data) {
  console.log('Load test completed');
  console.log('Check k6 metrics for detailed analysis');
}

// ==========================================
// SCENARIOS FOR DIFFERENT TEST TYPES
// ==========================================

export const scenarios = {
  // Smoke test: Quick validation
  smoke: {
    executor: 'constant-vus',
    vus: 10,
    duration: '1m',
  },
  
  // Load test: Normal load
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 500 },
      { duration: '5m', target: 500 },
      { duration: '2m', target: 0 },
    ],
  },
  
  // Stress test: High load
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 1000 },
      { duration: '5m', target: 5000 },
      { duration: '5m', target: 10000 },
      { duration: '2m', target: 0 },
    ],
  },
  
  // Spike test: Sudden traffic spike
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 100 },
      { duration: '1m', target: 10000 },  // Sudden spike
      { duration: '3m', target: 10000 },
      { duration: '30s', target: 100 },
      { duration: '1m', target: 0 },
    ],
  },
  
  // Endurance test: Sustained load over time
  endurance: {
    executor: 'constant-vus',
    vus: 2000,
    duration: '30m',
  },
};
