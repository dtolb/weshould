const Language = require('@google-cloud/language');
const yelp = require('yelp-fusion');
const debug = require('debug')('giphy_sms');

const yelpToken = process.env.YELP_TOKEN;
const language = Language();

const y = yelp.client(yelpToken);

const googleFailure = message => {
	return {
		text: `Sorry I don't understand: ${message.command.query}`,
		to: message.numbers.to,
		from: message.numbers.from
	}
};

const yelpFailure = message => {
	return {
		text: `Sorry I can't find: ${message.command.query} on yelp`,
		to: message.numbers.to,
		from: message.numbers.from
	}
};

const failure = message => {
	return {
		text: `Sorry something went wrong looking for ${query}. \n Please try again`,
		to: message.numbers.to,
		from: message.numbers.from
	}
}

module.exports.handleYelpCommmand = async message => {
	try {
		debug(`Searching for ${message.command.query}`);
		const query = message.command.query;
		const entities = await getEntities(query);
		if (!entities){
			return googleFailure(message);
		}
		const yelpResults = await searchYelp(entities);
		if (!yelpResults) {
			return yelpFailure(message);
		}
		const text = buildResponse(yelpResults, query);
		return {
			text,
			to: message.numbers.to,
			from: message.numbers.from
		};
	}
	catch (e) {
		debug('Error handing yelp')
		debug(e);
		return failure(message);
	}
}

const buildResponse = (results, query) => {
	let text = `Here is what I found for: ${query}\n`;
	debug('Building response');
	results.forEach(result => {
		let location = `* At ${result.rating}⭐️: ${result.name} - ${result.display_phone}\n`
		text = `${text}${location}`
	});
	return text;
}

const searchYelp = async ({term, location}) => {
	try {
		debug(`Searching yelp for ${term} and ${location}`);
		const results = (await y.search({
			term,
			location,
			limit:5,
			open_now:true})).jsonBody.businesses;
		return results;
	}
	catch (e) {
		debug(`Error searching yelp for ${term} and ${location}`);
		debug(e);
		return false;
	}

}

const getEntities = async query => {
	try {
		debug(`Searching for entities: ${query}`);
		let location ='';
		let term = '';
		const document = {
			'content': query,
			type: 'PLAIN_TEXT'
		};
		let langRes = [];
		langRes = (await language.analyzeEntities({'document': document}))[0].entities;
		debug(langRes);
		langRes.forEach( entity => {
			if (entity.type.toLowerCase() === 'location') {
				location = entity.name
			}
			else {
				term = entity.name
			}
		});
		if (!location) {
			location = 'Raleigh'
		}
		if (!term) {
			term = 'Deli'
		}
		return {location, term}
	}
	catch (e) {
		debug('Error in Google analyzing')
		debug(e);
		return false;
	}
}