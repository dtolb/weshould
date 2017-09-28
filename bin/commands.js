const debug = require('debug')('giphy_sms');
const gif = require('./gif.js');
const weather = require('./weather.js');
const catfact = require('./catfact.js');
const yelp = require('./yelp.js');
const Promise = require('bluebird');

const noCommand = function (message) {
	return Promise.resolve({
		text: 'Sorry, I don\'t know: ' + message.command.command,
		to: message.numbers.to,
		from: message.numbers.from
	});
};

const commandError = function (message) {
	return Promise.resolve({
		text: 'Sorry, something went wrong',
		to: message.numbers.to,
		from: message.numbers.from
	});
}

const handleHelpCommand = message => {
	debug('Building help text');
	let helpText = 'Here is how to use Weshould:\n';
	for (command in commands) {
		if (commands[command].description) {
			helpText = `${helpText}* ${commands[command].description}\n`
		}
	}
	return Promise.resolve({
		text: helpText,
		to: message.numbers.to,
		from: message.numbers.from
	});
}

const handleWeShould = message => {
	return Promise.resolve({
		text: `Better processing coming soon`,
		to: message.numbers.to,
		from: message.numbers.from
	});
}


const commands = {
	error: commandError,
	default: noCommand,
	weshould: {
		handler: handleWeShould,
		description: `"@weshould do something" : ⚠ Coming soon ⚠`
	},
	help: {
		handler: handleHelpCommand,
		description: `"@help" : get help on how to use weshould`
	},
	gif: {
		handler: gif.handleGifCommand,
		description: `"@gif search-phrase": @gif dog fail`
	},
	weather: {
		handler: weather.handleWeatherCommand,
		description: `"@weather location": @weather Raleigh`
	},
	catfact: {
		handler: catfact.handleCatFactCommand,
		description: `"@catfact": get a random cat fact`
	},
	yelp : {
		handler: yelp.handleYelpCommmand,
		description: `"@yelp <thing> in <location>: @yelp deli in Raleigh"`
	}
}

module.exports=commands;