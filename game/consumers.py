import json
from channels.generic.websocket import AsyncWebsocketConsumer


class GameConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        # Get the username, game ID and channel group name
        self.username = self.scope['url_route']['kwargs']['username']
        self.user_id = self.scope['url_route']['kwargs']['userid']
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.group_name = f'game-{self.game_id}'
        # Add this socket to the group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        # Accept connections
        await self.accept()
        # Send a message to all sockets in layer
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'broadcast',
                'message': {
                    'type': 'USER_CONNECTED',
                    'user': {
                        'username': self.username,
                        'user_id': self.user_id
                    },
                    'message': f'User {self.username} has been connected!' 
                }
            }
        )


    async def disconnect(self, code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        # Send a message to all sockets in layer
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'broadcast',
                'message': {
                    'type': 'USER_DISCONNECTED',
                    'user': {
                        'username': self.username,
                        'user_id': self.user_id
                    },
                    'message': f'User {self.username} has been disconnected!' 
                }
            }
        )


    async def receive(self, text_data):
        # Load the message
        text_data_json = json.loads(text_data)
        message = text_data_json['message']
        # Send message to all sockets in group
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'broadcast',
                'message': message
            }
        )


    async def broadcast(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': event['message']
        }))