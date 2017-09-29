const axios = require('axios');
const urljoin = require('url-join');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const debug = require('debug')('giphy_sms');
const util = require('util');
const p = o => debug(util.inspect(o, false, null));
const AWS = require('aws-sdk');
let s3bucket = new Promise.promisifyAll(new AWS.S3({params: {Bucket: 'weshould'}}));
const bandwidth = require('./bandwidth');
const uuidv4 = require('uuid/v4');

/* 'SDK' Setup */
const BW_URL = "https://api.us-east-1.preview.slingshot.dev.app.bandwidth.com/v2/accounts/1"

let slinger = axios.create({
	baseURL: BW_URL,
	headers: { "Content-type": "application/json" },
	auth: {
		username: "slinger",
		password: "SlingSh0t!"

	}
});

const createCall = async params => {
	debug('Creating call with: ');
	debug(params);
	return slinger.post("/calls", params);

};

module.exports.handleCallCommand = async message => {
	debug('Handling Call command');
	debug(message);
	const nextUrl = urljoin(message.baseUrl, '/api/callback/answer-call-request-event');
	const params = {
		to: message.message.from,
		from: message.to,
		answerUrl: nextUrl,
		tag: message.command.query,
	}
	try {
		const newCall = await createCall(params);
		debug('Created call!');
		debug(newCall.headers.location);
		return 'CALL';
	}
	catch (e) {
		debug('Error Creating Call');
		debug(e);
		return {
			to: message.numbers.to,
			from: message.numbers.from,
			text: 'Error Creating the Call, Please try again'
		};
	}
}

module.exports.handleCallRequestAnswer = (req, res) => {
	const bxml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
   <Gather gatherUrl="gather-event" timeout="10" maxDigits="1">
      <SpeakSentence voice="Emily">Please press 1 to connect your call</SpeakSentence>
   </Gather>
</Response>
`
	res.set('Content-Type', 'application/xml; charset=utf-8');
	res.send(bxml);
}

module.exports.handleConnectGather = (req, res) => {
	const transferTo = req.body.tag;
	debug('Inspecting Gather Event');
	debug(req.body);
	let bxml = '';
	if (req.body.digits == '1') {
		bxml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <SpeakSentence voice="Emily">Transferring your call, please wait.</SpeakSentence>
    <Transfer>
        <PhoneNumber>${transferTo}</PhoneNumber>
    </Transfer>
</Response>`
	}
	else {
		bxml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <SpeakSentence voice="Emily">Ending your call</SpeakSentence>
    <Hangup/>
</Response>`
	}
	res.set('Content-Type', 'application/xml; charset=utf-8');
	res.send(bxml);
}


module.exports.handleVoiceMessageCommand = async message => {
	debug('Handling Voice Message Command');
	debug(message);
	const nextUrl = urljoin(message.baseUrl, '/api/callback/answer-call-voice-message');
	const params = {
		to: message.message.from,
		from: message.to,
		answerUrl: nextUrl,
		tag: JSON.stringify(message.numbers)
	}
	try {
		const newCall = await createCall(params);
		debug('Created call!');
		debug(newCall.headers.location);
		return 'CALL';
	}
	catch (e) {
		debug('Error Creating Call');
		debug(e);
		return {
			to: message.numbers.to,
			from: message.numbers.from,
			text: 'Error Creating the Call, Please try again'
		};
	}
}

module.exports.handleVoiceMessageAnswer = (req, res) => {
	res.set('Content-Type', 'application/xml; charset=utf-8');
	debug('Handing voice message answer');
	debug(req.body);
	const bxml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
   <SpeakSentence voice="Emily">
      Please Record Your message and press pound when you're finished.
   </SpeakSentence>
   <Record fileFormat="mp3" recordingAvailableUrl="recoding-available" recordCompleteUrl="recording-complete"/>
</Response>`
	res.send(bxml);
}

module.exports.handleRecordingComplete = (req, res) => {
	res.set('Content-Type', 'application/xml; charset=utf-8');
	const successUrl  = "https://s3.amazonaws.com/bwdemos/success.mp3";
	debug('Handling recording complete');
	debug(req.body);
	const bxml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
	<PlayAudio>${successUrl}</PlayAudio>
	<SpeakSentence voice="Emily">Thank you for recording!</SpeakSentence>
	<Hangup/>
</Response>`
	res.send(bxml);
}

module.exports.handleRecordingAvailable = async (req, res) => {
	res.sendStatus(204);
	try {
		debug('Handling recoding-available');
		debug(req.body);
		const numbers = JSON.parse(req.body.tag);
		const mediaName = `${uuidv4()}.mp3`;
		const mediaUrl = req.body.mediaUrl;
		debug('Downloading Recording: ' + mediaUrl);
		const media = mediaUrl.split("https://");
		debug(media);
		const protectedUrl = `https://slinger:SlingSh0t!@${media[1]}.${req.body.fileFormat}`
		debug(protectedUrl);
		const mediaString = await axios.get(protectedUrl, {
			responseType: 'arraybuffer'
		});
		//await fs.writeFileAsync(`./${mediaName}`, mediaString.data, {});
		debug('Uploading to s3');
		const data = await s3bucket.putObjectAsync({
			Bucket: 'weshould',
			Key: mediaName,
			Body: mediaString.data,
		    ACL: 'public-read'
		});
		const s3MediaUrl = `https://s3.amazonaws.com/weshould/${mediaName}`
		debug(s3MediaUrl);
		debug('Sending Message');
		const newMessage = await bandwidth.Message.sendGroup({
			to: numbers.to,
			from: numbers.from,
			text: `New Recording: ${s3MediaUrl}`,
			media: [s3MediaUrl]
		});
		debug('Created new message');
		debug(newMessage);
	}
	catch (e) {
		debug('Error processing recording');
		debug(e);
	}
}