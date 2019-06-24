const debug = require('debug')('giphy_sms');
const mongoose = require('mongoose');
const findOrCreate = require('findorcreate-promise');
const Promise = require('bluebird');
const _ = require('underscore');

mongoose.Promise = global.Promise;
mongoose.connect((process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost/giphy-sms'), {useMongoClient: true});

const NumberSchema = new mongoose.Schema({
  number: { type: String, required: true},
  disable: {type: Boolean, default: true}
});

NumberSchema.plugin(findOrCreate);

const Number = mongoose.model('Number', NumberSchema);

const phrases = [
  'stop',
  'unsubscribe'
];

const addNumberToOptOut = (number) => {
  debug('Adding number to optout list: ' + number);
  return Number.findOrCreate({
    number: number
  });
}

const searchForNumber = (number) => {
  return Number.find({ number: number});
}

module.exports.removeOptOutsFromMessage = async (req, res, next) => {
  try {
    const outNumbers = req.outMessages[0].to;
    debug('Searching for optouts: ' + outNumbers);
    const results = await Promise.map(outNumbers, number => {
      const doc = await Number.find({ number: number });
      if (doc.length > 0) {
        debug('Found number in optout: ' + doc[0].number);
        return doc[0].number;
      }
      else {
        debug('Number not in opt out list: ' + number);
      }
    });
    debug('Numbers that opted out: ' + results);
    req.outMessages[0].to = _.difference(outNumbers,results);
    next();
  }
  catch (err) {
      debug('Error removing components from to array');
      next(err);
  }
}

module.exports.checkForOptOut = async (req, res, next) => {
  let message = req.body[0];
  let number = message.message.from;
  let text = ''
  try {
    text = message.message.text.toLowerCase();
  }
  catch (e) {
    debug('No text in message')
    next();
    return;
  }
  debug('Incoming text: ' + text);
  if (phrases.indexOf(text) >= 0) {
    debug('Stop Command Found');
    try {
      const doc = await addNumberToOptOut(number);
      if (doc.created) {
        debug('Added number to block list: ' + number);
      }
      else {
        debug('Number already in block list: ' + number);
      }
      next();
    }
  }
  catch(err) {
    debug('Error finding or creating number to block list: ' + number);
    }
  else {
    debug('Not a stop command');
    next();
  }
};