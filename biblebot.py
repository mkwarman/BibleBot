import os

from slackclient import SlackClient

# constants
BOT_NAME = os.environ.get('BOT_NAME')#"biblebot"

# globals
global at_bot_id

def handle_text(text, channel, message_data):
    print("Handling text")
    bot_match = "<@" + at_bot_id + ">"
    if (text.startswith(bot_match) and not re.search('^ ?(--|\+\+)', text[len(bot_match):])):
        print("Received command: " + text)
        return handle_command(text, channel, message_data)
    elif 'user' in message_data and message_data['user'] not in ignored_users:
        check_user_text(text, channel, message_data, False)

    return True

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
                print("StokeBot connected and running!")
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
