'use strict'

const express = require('express')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')
const http = require('http');

// use `PORT` env var on Beep Boop - default to 3000 locally
var port = process.env.PORT || 3000

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})

var HELP_TEXT = `
I will respond to the following messages:
\`help\` - to see this message.
\`hi\` - to demonstrate a conversation that tracks state.
\`thanks\` - to demonstrate a simple response.
\`<type-any-other-text>\` - to demonstrate a random emoticon response, some of the time :wink:.
\`attachment\` - to see a Slack attachment message.
`

//*********************************************
// Setup different handlers for messages
//*********************************************

// response to the user typing "help"
slapp.message('help', ['mention', 'direct_message'], (msg) => {
  msg.say(HELP_TEXT)
})

// response to the user typing "test"
slapp.message('^(test|Test)$', ['mention', 'direct_message'], (msg) => {
  msg.say('I\'m here!');
})

// "Conversation" flow that tracks state - kicks off when user says hi, hello or hey
slapp
  .message('^(hi|hello|hey)$', ['direct_mention', 'direct_message'], (msg, text) => {
    msg
      .say(`${text}, how are you?`)
      // sends next event from user to this route, passing along state
      .route('how-are-you', { greeting: text })
  })
  .route('how-are-you', (msg, state) => {
    var text = (msg.body.event && msg.body.event.text) || ''

    // user may not have typed text as their next action, ask again and re-route
    if (!text) {
      return msg
        .say("Whoops, I'm still waiting to hear how you're doing.")
        .say('How are you?')
        .route('how-are-you', state)
    }

    // add their response to state
    state.status = text

    msg
      .say(`Ok then. What's your favorite color?`)
      .route('color', state)
  })
  .route('color', (msg, state) => {
    var text = (msg.body.event && msg.body.event.text) || ''

    // user may not have typed text as their next action, ask again and re-route
    if (!text) {
      return msg
        .say("I'm eagerly awaiting to hear your favorite color.")
        .route('color', state)
    }

    // add their response to state
    state.color = text

    msg
      .say('Thanks for sharing.')
      .say(`Here's what you've told me so far: \`\`\`${JSON.stringify(state)}\`\`\``)
    // At this point, since we don't route anywhere, the "conversation" is over
  })

// Can use a regex as well
slapp.message(/^(thanks|thank you)/i, ['mention', 'direct_message'], (msg) => {
  // You can provide a list of responses, and a random one will be chosen
  // You can also include slack emoji in your responses
  msg.say([
    "You're welcome :smile:",
    'You bet',
    ':+1: Of course',
    'Anytime :sun_with_face: :full_moon_with_face:'
  ])
})

// demonstrate returning an attachment...
slapp.message('attachment', ['mention', 'direct_message'], (msg) => {
  msg.say({
    text: 'Check out this amazing attachment! :confetti_ball: ',
    attachments: [{
      text: 'Slapp is a robust open source library that sits on top of the Slack APIs',
      title: 'Slapp Library - Open Source',
      image_url: 'https://storage.googleapis.com/beepboophq/_assets/bot-1.22f6fb.png',
      title_link: 'https://beepboophq.com/',
      color: '#7CD197'
    }]
  })
})

// Bible command
slapp.command('/bible', /.*/, (msg, text) => {
  console.log('Received slash command for Bible. Command entered: /bible ' + text);

  var parsedVerseData = parseVerseData(text)
  var parsedText = parsedVerseData[0];
  var parsedBooks = parsedVerseData[1];
  var parsedFullVerses = parsedVerseData[2];
  var parsedMatchVerses = parsedVerseData[3];

  console.log('Interpreting requested verse as: ' + parsedText);
  msg.say('Give me just a sec while I grab that for you...');

  console.log('got parsedBooks as: ' + parsedBooks);
  console.log('got parsedFullVerses as: ' + parsedFullVerses);
  console.log('got parsedMatchVerses as: ' + parsedMatchVerses);

  sendRequest(parsedText, parsedBooks, parsedFullVerses, parsedMatchVerses, msg);
})

// Text bible command
slapp
  .message(/.{0,}(?:[0-9]?[A-Za-z]{1,})+(?:[ +]?\d+:\d+(?:-\d+)?)+.{0,}/g,
          ['direct_mention', 'direct_message'], (msg, text) => {
    console.log('Received text command for Bible. Text entered: ' + text);
    var regex = /(?:[0-9]? ?[A-Za-z]{1,})+(?:[ +]\d+(:\d+(?:-\d+)?)?)+/g;
    var matches = text.match(regex);
    var promptList = '';
    var reply = '';
    var plural = false;

    if (matches.length === 1) {
      promptList = ' ' + matches[0];
    } else if (matches.length === 2) {
      promptList = ' ' + matches[0] + ' and ' + matches[1];
    } else if (matches.length > 2) {
      for (var i = 0; i < matches.length; i++) {
        if (i === matches.length - 1) {
          promptList = promptList + ' and ' + matches[i];
        } else {
          promptList = promptList + ' ' + matches[i] + ',';
        }
      }
    }

    plural = (matches.length > 1);

    msg
      .say('I found the verse' + (plural ? 's:' : ':') + promptList)
      .say('Would you like me to show ' + (plural ? 'them?' : 'it?'))
      .route('show-or-not', matches, plural);

    // var parsedVerseData = parseVerseData(text)
    // var parsedText = parsedVerseData[0];
    // var parsedBooks = parsedVerseData[1];
    // var parsedFullVerses = parsedVerseData[2];
    // var parsedMatchVerses = parsedVerseData[3];
    //
    // console.log('Interpreting requested verse as: ' + parsedText);
    // msg.say('Interpreting requested verse as: ' + parsedText);
    //
    // console.log('got parsedBooks as: ' + parsedBooks);
    // console.log('got parsedFullVerses as: ' + parsedFullVerses);
    // console.log('got parsedMatchVerses as: ' + parsedMatchVerses);
    //
    // sendRequest(parsedText, parsedBooks, parsedFullVerses, parsedMatchVerses, msg);
  })
  .route('show-or-not', (msg, matches, plural) => {
    var text = (msg.body.event && msg.body.event.text) || ''

    if (!text.match(/yes|no/ig)) {
      return msg
        .say('Sorry, I didn\'t understand that.')
        .say('Would you like me to show the verse' + (plural ? 's?' : '?'))
        .route('show-or-not');
    }

    if (text.match(/yes/ig)) {
      msg
        .say('Great! Give me just a sec while I grab that for you...')
        var parsedVerseData = parseVerseData(parseVersesFromArray(matches))
        var parsedText = parsedVerseData[0];
        var parsedBooks = parsedVerseData[1];
        var parsedFullVerses = parsedVerseData[2];
        var parsedMatchVerses = parsedVerseData[3];

        console.log('Interpreting requested verse as: ' + parsedText);
        console.log('got parsedBooks as: ' + parsedBooks);
        console.log('got parsedFullVerses as: ' + parsedFullVerses);
        console.log('got parsedMatchVerses as: ' + parsedMatchVerses);

        sendRequest(parsedText, parsedBooks, parsedFullVerses, parsedMatchVerses, msg);
    }

    if (text.match(/no/ig)) {
      return msg
        .say('Ok.');
    }
  })

// Catch-all for any other responses not handled above
slapp.message('.*', ['direct_mention', 'direct_message'], (msg) => {
  // respond only 40% of the time
  if (Math.random() < 0.4) {
    msg.say([':wave:', ':pray:', ':raised_hands:'])
  }
})

// Sanitize verses and get book and first verse data
function parseVerseData(text) {
  console.log('In parseVerse()...');
  var verse = text.replace(/\n/g, ';')
                  .replace(/\s/g, '+')
                  .replace(/([A-Za-z])(?=\d)/g, '$1+');

  // Get books
  // var booksArray = verse.match(/[A-Za-z]+/g);

  // Get verses, but only the first verse for each book.
  //   These should return the same thing in capture group 1:
  //   /[A-Za-z]+\+?(\d+:\d+)/g
  //   /(\d+:\d+)(-\d+)?((\+\d+:\d+(-\d+)?)+)?/g
  // var firstVerseRegex = /[A-Za-z]+\+?(\d+:\d+)/g;
  // var firstVerseArray = [];
  // var match;
  // while (match = firstVerseRegex.exec(verse)) {
  //   firstVerseArray.push(match[1]);
  // }

  // ([0-9]?[A-Za-z]{1,}|[A-Za-z]{0,})\+([0-9]+:[0-9]+)
  // var regex = /([0-9]?[A-Za-z]{1,}|[A-Za-z]{0,})\+(([0-9]+:[0-9]+)(?:-\d+)?)/g;
  var regex = /([0-9]\+?[A-Za-z]{1,}|[A-Za-z]{0,})\+(([0-9]+:[0-9]+)(?:-\d+)?)/g;
  var booksArray = [];
  var matchVerseArray = [];
  var fullVerseArray = [];
  var lastBook;
  var match;

  // For all results of the regex execution
  while (match = regex.exec(verse)) {
    var book = match[1].replace(/[a-zA-Z]/,function(match){return match.toUpperCase();})
                       .replace(/\+/g, ' ');

    // See if there is a new book for the current verse
    if (book === '') {
      // If the book was not changed
      booksArray.push(lastBook); // Use the last book
    } else {
      // If the book was changed
      booksArray.push(book); // Use the new book
      lastBook = book; // Save the new book
    }

    // Save the full verse
    fullVerseArray.push(match[2]);
    matchVerseArray.push(match[3]);
  }

  console.log('Got books: ' + booksArray);
  console.log('Got first verses: ' + matchVerseArray);

  var data = [verse, booksArray, fullVerseArray, matchVerseArray];
  return data;
}

// Send HTTP Request
function sendRequest(parsedText, parsedBooks, parsedFullVerses, parsedMatchVerses, msg) {
  console.log('In sendRequest()...');
  var body;
  var options = {
    host: 'labs.bible.org',
    path: '/api/?passage=' + parsedText + '&formatting=full',
  }

  console.log('Request URL: labs.bible.org/api/?passage=' + parsedText + '&formatting=full');

  var request = http.get(options, function(response){
    console.log('STATUS: ' + response.statusCode);
    console.log('HEADERS: ' + JSON.stringify(response.headers));

    // Buffer the body entirely for processing as a whole.
    var bodyStream = [];
    response.on('data', function(chunk) {
      // Partially streamed body
      console.log('-----got chunk-----');
      bodyStream.push(chunk);
    }).on('end', function() {
      // Completely streamed body
      console.log('-----finished body-----');
      body = Buffer.concat(bodyStream).toString();
      console.log('BODY: ' + body);
      formatThenReply(body, parsedBooks, parsedFullVerses, parsedMatchVerses, msg);
    })
  });

  request.on('error', function(e) {
    console.log('error occurred in HTTP GET request: ', e.message);
  });
}

function formatThenReply(body, parsedBooks, parsedFullVerses, parsedMatchVerses, msg) {
  console.log('In formatThenReply()...');

  var verse = '';

  console.log('Before sanitization:\n' + body);
  // Replace special characters
  // verse = body.replace(/<\/?b>/g, '*') // Fix bold formatting
  //             .replace(/<\/?i>/g, '_') // Fix italics formatting
  //             .replace(/&#8211;/g, '-') // Handle unicode dash character
  //             .replace(/<h\d>/g, '\n\n>*') // Fix space before headings and start bolding
  //             .replace(/<\/h\d>/g, '*') // End bolding headings
  //             .replace(/<p.{0,}?>/g, '\n>') // Fix newlines
  //             .replace(/<.+?>/g, '') // Remove all remaining HTML tags
  //             .replace(/[\s>]{0,}(\*\d+:\d+\*)/g, '\n>$1') // Move new sections of the same book to new lines
  //             .replace(/^[\s]{0,}(?=>\*)/, ''); // Finally, remove all extra newlines at the beginning of the text

  verse = body.replace(/<\/?b>/g, '*') // Fix bold formatting
              .replace(/<\/?i>/g, '_') // Fix italics formatting
              .replace(/&#8211;/g, '-') // Handle unicode dash character
              .replace(/&#8230;/g, '...') // Handle unicode ellipsis character
              .replace(/(<h\d>[^<>]{0,}<\/h\d>)([^\*]{0,}\*[^:\*]{0,}:([^\*]{0,}){0,}\*)/g,
                       '$2\n>*$1*\n>*$3*') // Fix space before headings and bolding
              .replace(/(<h\d>[^<>]{0,}<\/h\d>(?!\*))(?:[^\*]{0,}\*([^\*]{0,}){0,}\*)/g,
                       '\n>*$1*\n>*$2*') // Fix space before headings and bolding
              .replace(/<p.{0,}?>/g, '\n>') // Fix newlines
              .replace(/<.+?>/g, '') // Remove all remaining HTML tags
              .replace(/[\s>]{0,}(\*\d+:(\d+)\*(?![^A-Za-z]+>))/g,
                       '\n>$1\n>*$2*') // Move new sections of the same book to new lines and copy verse number
              .replace(/^[\s]{0,}(?=>\*)/, ''); // Finally, remove all extra newlines at the beginning of the text

  console.log('After sanitization:\n' + verse);

  // Inject book titles
  for (var i = 0; i < parsedMatchVerses.length; i++) {
    var replaceTarget = '>*' + parsedMatchVerses[i] + '*';
    var replacementString = '\n>*' + parsedBooks[i] + ' ' + parsedFullVerses[i] + '*';

    verse = verse.replace(replaceTarget, replacementString);

    console.log('Changing \"' + replaceTarget + '\" to \"' + replacementString + '\"');
  }

  console.log('After title injection:\n' + verse);

  // // Move extra newlines at the beginning of the formatted verse text
  // while (verse.startsWith('\n>')) {
  //   console.log('Removing newline from beginning of the verse');
  //   verse = verse.replace('\n>', ''); // Remove all leading newlines.
  // }

  // Reply with the formatted verse
  reply(verse, msg);
}

function reply(verse, msg) {
  msg.say('Here\'s your verse!\n' + verse);
}

function parseVersesFromArray(verseArray) {
  var verseString = '';
  for (var i = 0; i < verseArray.length; i++) {
    if (i === verseArray.length - 1) {
      verseString = verseString + verseArray[i];
    } else {
      verseString = verseString + verseArray[i] + '+';
    }
  }

  return verseString;
}

// attach Slapp to express server
var server = slapp.attachToExpress(express())

// start http server
server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log(`Listening on port ${port}`)
})
