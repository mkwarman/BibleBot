import os
#import requests
from slackclient import SlackClient

slack_client = SlackClient(os.environ.get('SLACK_BOT_TOKEN'))

# def is_admin(user_id):
#     api_call = slack_client.api_call("users.list")
#     if api_call.get('ok'):
#         users = api_call.get('members')
#         for user in users:
#             if 'id' in user and user.get('id') == user_id:
#                 print("Got target user profile for '" + user['id'])
#                 return user.get('is_admin')

def get_user_id(user_name):
    api_call = slack_client.api_call("users.list")
    if api_call.get('ok'):
        # retrieve all users so we can find our bot
        users = api_call.get('members')
        for user in users:
            if 'name' in user and user.get('name') == user_name:
                user_id = user.get('id')
                print("Got target user id for '" + user['name'] +"': " + user_id)
                return user_id
    else:
        print("could not find bot user with the name " + user_name)

# def get_user_name(user_id):
#     api_call = slack_client.api_call("users.list")
#     if api_call.get('ok'):
#         users = api_call.get('members')
#         for user in users:
#             if 'id' in user and user.get('id') == user_id:
#                 print("Got target user name for '" + user['id'] + "': " + user.get('name'))
#                 return user.get('name')

# def get_channel_name(channel_id):
#     print("channel_id: " + channel_id)
#     api_call = slack_client.api_call("channels.info", channel=channel_id)
#     if api_call.get('ok'):
#         channel = api_call.get('channel')
#         if 'id' in channel and channel.get('id') == channel_id:
#             print("Got target channel name for '" + channel['id'] + "': " + channel.get('name'))
#             return channel.get('name')

#def get_channel_id(channel_name):
#    print("channel_name: " + channel_name)
#    api_call = slack_client.api_call("channels.list")
#    if api_call.get('ok'):
#        channels = api_call.get('channels')
#        for channel in channels:
#            if 'name' in channel and channel.get('name') == channel_name:
#                print("Got channel id for channel: " + channel_name + " (" + channel.get('id') + ")")
#                return channel.get('id')

#def get_conversation_id(conversation_name):
#    print("conversation_name: " + conversation_name)
#    api_call = slack_client.api_call("conversations.list")
#    if api_call.get('ok'):
#        conversations = api_call.get('channels')
#        for conversation in conversations:
#            if 'name' in conversation and conversation.get('name') == conversation_name:
#                print("Got channel id for conversation: " + conversation_name + " (" + conversation.get('id') + ")")
#                return conversation.get('id')

# def get_group_name(group_id):
#     print("group_id: " + group_id)
#     api_call = slack_client.api_call("groups.info", channel=group_id)
#     if api_call.get('ok'):
#         group = api_call.get('group')
#         if 'id' in group and group.get('id') == group_id:
#             print("Got target group name for '" + group['id'] + "': " + group.get('name'))
#             return group.get('name')

# def get_name_from_id(input_id):
#     print("get_name_from_id: " + input_id)
#     if input_id.startswith("U"):
#         return get_user_name(input_id)
#     elif input_id.startswith("C"):
#         return get_channel_name(input_id)
#     elif input_id.startswith("G"):
#         return get_group_name(input_id)
#     elif input_id.startswith("D"):
#         return "direct message"
#     else:
#         print("get_name_from_id encountered unhandled ID")
#         return "unknown"

#def get_id_from_name(input_name):
#    print("get_id_from_name: " + input_name)
#    #if input_name.startswith("U"):
#    #    return get_user_name(input_name)
#    channel_id = get_channel_id(input_name)
#    if channel_id:
#        return channel_id
#    else:
#        return get_group_id(input_name)

# def is_private_channel(channel_id):
#     api_call = slack_client.api_call("channels.info", channel=channel_id)
#     if api_call.get('ok'):
#         channel = api_call.get('channel')
#         if 'is_private' in channel:
#             print("Got privacy status for '" + channel.get('name') + "': " + str(channel.get('is_private')))
#             return channel.get('is_private')

# def is_private(input_id):
#     if input_id.startswith("C"):
#         return is_private_channel(input_id)
#     elif input_id.startswith("G"):
#         return True
#     elif input_id.startswith("D"):
#         return True
#     else:
#         print("is_private encountered unhandled ID")
#         return True

def call_bible_api(query):
    url = ('http://labs.bible.org/api/?passage=%s' %word)
    print(url)
    response = requests.get(url)
    if response.ok:
        return response
    else:
        print("Encountered error while trying to call dictionary API")

def send_reply(text, channel):
    slack_client.api_call("chat.postMessage", channel=channel,
                          text=text, as_user=True)
