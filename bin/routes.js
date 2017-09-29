const express = require('express');
let router = module.exports = express.Router();
const controllers = require('./controllers.js');
const signup = require('./signup.js');
const optOut = require('./optOut.js');
const calls = require('./calls.js');

router.route('/message')
	.post(
		controllers.sendAccepted,
		controllers.checkIfBodyIsArray,
		optOut.checkForOptOut,
		controllers.handleMessages,
		optOut.removeOptOutsFromMessage,
		controllers.sendMessages
		);

router.route('/calls')
	.post(
		controllers.sendAccepted,
		controllers.checkCallEventType,
		controllers.transferCallToSales
		);

router.route('/answer-call-request-event')
	.post(calls.handleCallRequestAnswer);

router.route('/gather-event')
	.post(calls.handleConnectGather);

router.route('/answer-call-voice-message')
	.post(calls.handleVoiceMessageAnswer);

router.route('/recoding-available')
	.post(calls.handleRecordingAvailable);

router.route('/recording-complete')
	.post(calls.handleRecordingComplete);

router.route('/signup')
	.post(
		controllers.sendAccepted,
		signup.isIncomingMessage,
		signup.checkForExistingNumber,
		signup.checkValidZip,
		signup.getNewNumber,
		signup.addNumberToDatabase,
		signup.createVcard,
		controllers.sendMessages
	)