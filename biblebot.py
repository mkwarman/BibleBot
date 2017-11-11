import os
import time
import api
import re
from slackclient import SlackClient

# constants
BOT_NAME = os.environ.get('BOT_NAME')#"biblebot"
READ_WEBSOCKET_DELAY = .5 # .5 second delay between reading from firehose
CONNECTION_ATTEMPT_RETRY_DELAY = 1

# globals
global at_bot_id

# instantiate Slack & Twilio clients
slack_client = SlackClient(os.environ.get('SLACK_BOT_TOKEN'))

def handle_text(text, channel, message_data):
    print("Handling text: " + text)
    #bot_match = "<@" + at_bot_id + ">"
    reference_regex = re.compile(r'(?:((?:[0-9] ?)?[A-Za-z]+) ?([\d:-]+))')
    references = reference_regex.findall(text)
    for reference in references:
        handle_reference(reference, channel)

    return True

def handle_reference(reference, channel):
    book = reference[0]
    verse = reference[1]

    print("Found book: " + book + ", verse: " + verse)

def listen_for_text(slack_rtm_output):
    """
    	Listen for messages sent by certian users. If the message was
    	sent by one of those users, then do more.
    """
    output_list = slack_rtm_output
    if output_list and len(output_list) > 0:
        for output in output_list:
            #if output and 'text' in output and 'user' in output and at_target_user_id in output['user']:
            # If there is text present, but that text isnt from this bot,
            if output and 'text' in output and 'user' in output and output['user'] != at_bot_id:
                return output['text'], output['channel'], output
                # return None, None
    return None, None, None

if __name__ == "__main__":
    READ_WEBSOCKET_DELAY = .5 # .5 second delay between reading from firehose
    run = True
    while run:
        try:
            if slack_client.rtm_connect():
                # Startup tasks
                print("BibleBot connected and running!")
                global at_bot_id
                at_bot_id = api.get_user_id(BOT_NAME) # Get the bot's ID
                while run:
                    text, channel, message_data = listen_for_text(slack_client.rtm_read())
                    if text and channel:
                        run = handle_text(text, channel, message_data)
                        if not run:
                            api.send_reply(":broken_heart:", channel)
                    time.sleep(READ_WEBSOCKET_DELAY)
            else:
                print("Connection failed. Invalid Slack token or Bot ID?")

        except (KeyboardInterrupt, SystemExit):
            print ("Stopping...")
            quit()
        except Exception as e:
            print ("Encountered error: " + str(e))

        time.sleep(CONNECTION_ATTEMPT_RETRY_DELAY)
