from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/game/(?P<game_id>\w+)/username/(?P<username>\w+)/userid/(?P<userid>\w+)/$', consumers.GameConsumer.as_asgi()),
]