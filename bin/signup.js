const debug = require('debug')('giphy_sms');
const mongoose = require('mongoose');
const findOrCreate = require('findorcreate-promise');
const Promise = require('bluebird');
const _ = require('underscore');
const bandwidth = require('./bandwidth');
const util       = require('util')
const p = o => debug(util.inspect(o, false, null));
var vCard = require('vcards-js');
const AWS = require('aws-sdk');
let s3bucket = new Promise.promisifyAll(new AWS.S3({params: {Bucket: 'weshould'}}));
//var S3 = require('aws-sdk/clients/s3');
//let s3uploadAsync = Promise.promisify(s3bucket.putObject);


mongoose.Promise = global.Promise;
mongoose.connect((process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost/giphy-sms'), {useMongoClient: true});

const WeshouldNumberSchema = new mongoose.Schema({
	bandwidthNumber: { type: Object, required: true},
	userNumber: { type: String, required: true},
	enabled: {type: Boolean, default: true}
});

WeshouldNumberSchema.plugin(findOrCreate)

const WeshouldNumber = mongoose.model('WeshouldNumber', WeshouldNumberSchema);

const buildToArray = function (message) {
	let numbers = {
		from: message.to
	}
	let toNumbers = message.message.to;
	let index = toNumbers.indexOf(message.to);
	if (index > -1 ) {
		toNumbers.splice(index, 1);
	}
	toNumbers.push(message.message.from);
	numbers.to = toNumbers;
	return numbers;
}

module.exports.isIncomingMessage = (req, res, next) => {
	const message = req.body[0];
	req.outMessages = [];
	const isIncomingMessage = (message && message.message && message.message.direction == 'in');
	if (isIncomingMessage) {
		debug('Message is direction in');
		req.isOutboundMessage = false;
		next();
	}
	else {
		debug('Message is direction out');
		req.isOutboundMessage = true;
		next();
	}
};

module.exports.checkForExistingNumber = async (req, res, next) => {
	if (req.isOutboundMessage){
		next();
		return;
	}
	try {
		const message = req.body[0];
		const userNumber = message.message.from;
		const doc = await WeshouldNumber.find({userNumber, enabled:true});
		if (doc.length > 0) {
			debug(`User ${userNumber} already has WeshouldNumber`);
			const bandwidthNumber = doc[0].bandwidthNumber;
			req.bandwidthNumber = bandwidthNumber;
			p(bandwidthNumber);
			req.skipNewNumber = true;
			// const {to, from} = buildToArray(message);
			// const newMessage = {
			// 	to,
			// 	from,
			// 	text:`You already have a Weshould Number! It is ${bandwidthNumber.nationalNumber}`
			// };
			// req.outMessages.push(newMessage);
			next();
		}
		else {
			debug(`User ${userNumber} does not have WeshouldNumber`);
			next();
		}
	}
	catch (e) {
		debug(`Error looking for ${req.body[0].message.from} in database`);
		next(e);
	}
};

module.exports.checkValidZip = (req, res, next) => {
	if (req.isOutboundMessage || req.skipNewNumber) {
		next();
		return;
	}
	debug(`Checking to see if zip is valid`);
	const message = req.body[0]
	const zip = message.message.text;
	req.zipcode = zip;
	const isValidZip = /(^\d{5}$)|(^\d{5}-\d{4}$)/.test(zip);
	if (!isValidZip){
		req.skipNewNumber = true
		req.zipError = true
		const {to, from} = buildToArray(message);
		const newMessage = {
			to,
			from,
			text:`Sorry, ${zip} doesn't appear to be a valid zip code, please try again`
		};
		req.outMessages.push(newMessage);
		next();
	}
	else {
		next();
	}
}

module.exports.getNewNumber = async (req, res, next) => {
	if (req.skipNewNumber || req.zipError || req.isOutboundMessage) {
		next();
		return;
	}
	try {
		debug(`Searching for new number in ${req.zipcode}`);
		const numbers = await bandwidth.AvailableNumber.searchAndOrder("local", {
			zip: req.zipcode,
			quantity: 1
		});
		debug(`Found Numbers:`);
		p(numbers);
		const numberId = numbers[0].id;
		await bandwidth.PhoneNumber.update(numberId, {
			applicationId: bandwidth.applicationId,
			name: req.body[0].message.from
		});
		const newNumber = await bandwidth.PhoneNumber.get(numberId);
		debug(`Full number:`);
		p(newNumber);
		req.bandwidthNumber = newNumber;
		next();
	}
	catch (e) {
		debug(`Error searching for number`)
		next(e);
	}
}

module.exports.addNumberToDatabase = async (req, res, next) => {
	if (req.skipNewNumber || req.zipError || req.isOutboundMessage) {
		next();
		return;
	}
	try {
		const doc = await WeshouldNumber.findOrCreate({
			userNumber: req.body[0].message.from,
			bandwidthNumber: req.bandwidthNumber
		});
		if (doc.created) {
			debug('Created new bandwidthNumber');
		}
		next();
	}
	catch (e) {
		debug('Error saving number to database');
		debug(e);
		next(e);
	}
}

module.exports.createVcard = async (req, res, next) => {
	if (req.zipError || req.isOutboundMessage){
		next();
		return;
	}
	const {to, from} = buildToArray(req.body[0]);
	let newMessage = {
		to,
		from,
		text: `Your Weshould number is ${req.bandwidthNumber.nationalNumber}`
	}
	try {
		const safeNumber = req.bandwidthNumber.number.replace('+', '');
		const vCardFileName = `vCard-${safeNumber}.vcf`;
		let vcard = vCard();
		vcard.firstName = 'Weshould'
		vcard.url = 'weshould.co'
		vcard.cellPhone = req.bandwidthNumber.nationalNumber
		vcard.saveToFile(`./${vCardFileName}`);
		const data = await s3bucket.putObjectAsync({
			Bucket: 'weshould',
			Key:vCardFileName,
			Body: vcard.getFormattedString(),
		    ACL: 'public-read'
		});
		const mediaUrl = `https://s3.amazonaws.com/weshould/${vCardFileName}`
		// let media = await bandwidth.Media.upload(vCardFileName, `./${vCardFileName}`, 'text/x-vcard');
		// const mediaUrl = `https://api.catapult.inetwork.com/v1/users/${bandwidth.userId}/media/${vCardFileName}`
		newMessage.media = [mediaUrl]
		req.outMessages.push(newMessage);
		next();
	}
	catch (e) {
		debug('Error generating vcard');
		debug(e)
		req.outMessages.push(newMessage);
		next();
	}
}