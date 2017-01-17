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

// Testing
slapp.command('/bible', /.*/, (msg, text) => {
  console.log('Received slash command for Bible. Command entered: /bible ' + text);
  msg.say('Received slash command for Bible. Command entered: /bible ' + text);

  var parsedVerseData = parseVerseData(text)
  var parsedText = parsedVerseData[0];
  var parsedBooks = parsedVerseData[1];
  var parsedFirstVerses = parsedVerseData[2];

  console.log('Interpreting requested verse as: ' + parsedText);
  msg.say('Interpreting requested verse as: ' + parsedText);

  sendRequest(parsedText, parsedBooks, parsedFirstVerses, msg);
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
  var verse = text.replace(/\s/g, '+')
                  .replace(/([A-Za-z])(?=\d)/g, '$1+');

  // Get books
  var booksArray = verse.match(/[A-Za-z]+/g);

  // Get verses, but only the first verse for each book
  var firstVerseArray = verse.match(/(\d+:\d+)(-\d+)?((\+\d+:\d+(-\d+)?)+)?/g);

  console.log('Got books: ' + booksArray);
  console.log('Got first verses: ' + verseArray);

  var data = [verse, booksArray, firstVerseArray];
  return data;
}

// Send HTTP Request
function sendRequest(parsedText, parsedBooks, parsedFirstVerses, msg) {
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
      reply(body, parsedBooks, parsedFirstVerses, msg);
    })
  });

  request.on('error', function(e) {
    console.log('error occurred in HTTP GET request: ', e.message);
  });
}

function formatReply(body, parsedBooks, parsedFirstVerses, msg) {
  console.log('In reply()...');

  // Replace special characters
  var verse = body.replace(/<\/?b>/g, '*') // Fix bold formatting
                  .replace(/<\/?i>/g, '_') // Fix italics formatting
                  .replace(/&#8211;/g, '-') // Handle unicode dash character
                  .replace(/<h\d>/g, '\n\n>*') // Fix space before headings and start bolding
                  .replace(/<\/h\d>/g, '*') // End bolding headings
                  .replace(/<p.{0,}?>/g, '\n>') // Fix newlines
                  .replace(/<.+?>/g, '') // Remove all remaining HTML tags
                  .replace(/[^>](?=\*\d+:\d+)/, '\n>') // Move new sections of the same book to new lines
                  .replace(/[\s>]+(?=\*)/, ''); // Finally, remove all extra newlines at the beginning of the text

  // Inject book titles
  for (let i of parsedFirstVerses) {
    var replaceTarget = '>*' + parsedFirstVerses[i] + '*';
    var replacementString = '>*' + parsedBooks[i] + ' ' + parsedFirstVerses[i] + '*';

    verse = verse.replace(replaceTarget, replacementString);

    console.log('Changing \"' + replaceTarget + '\" to \"' + replacementString + '\"');
  }

  // // Move extra newlines at the beginning of the formatted verse text
  // while (verse.startsWith('\n>')) {
  //   console.log('Removing newline from beginning of the verse');
  //   verse = verse.replace('\n>', ''); // Remove all leading newlines.
  // }

  // Reply with the formatted verse
  reply(verse, msg);
}

function reply(verse) {
  msg.say('Here\'s your verse!\n>' + verse);
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
