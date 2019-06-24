const Bandwidth = require('node-bandwidth');
const axios = require('axios');

const userId = process.env.BANDWIDTH_USER_ID;
const apiToken = process.env.BANDWIDTH_API_TOKEN;
const apiSecret = process.env.BANDWIDTH_API_SECRET;

if (!userId || !apiToken || !apiSecret ) {
  throw new Error('Invalid or non-existing Bandwidth credentials. \Please set your: \n * userId \n * apiToken \n * apiSecret');
}

const api = new Bandwidth({
  userId    : userId,
  apiToken  : apiToken,
  apiSecret : apiSecret
});

const messageV2API = axios.create({
  baseURL: `https://api.catapult.inetwork.com/v2/users/${userId}/messages`,
  auth: {
    username: apiToken,
    password: apiSecret
  },
  headers: {
    'Content-type': 'application/json',
    'Accept': 'application/json'
  }
});

const sendMessage = async (message) => {
  message.applicationId = process.env.BANDWIDTH_APPLICATION_ID;
  const outMessage = await messageV2API.post('', message);
  console.log(outMessage.data);
}

api.applicationId = process.env.BANDWIDTH_APPLICATION_ID;
api.userId = userId;
api.messageClient = messageClient;

module.exports = api;